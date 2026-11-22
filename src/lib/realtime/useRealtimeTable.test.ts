import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRealtimeChange } from './useRealtimeTable';

interface PlanRow {
  service_id: string;
  service_title: string;
  service_charge: number;
  is_active: boolean;
}

test('applyRealtimeChange handles INSERT idempotently without duplicating existing rows', () => {
  const initial: PlanRow[] = [
    { service_id: 'p1', service_title: 'Starter', service_charge: 750, is_active: true },
  ];

  const afterInsert = applyRealtimeChange(
    initial,
    {
      eventType: 'INSERT',
      new: { service_id: 'p2', service_title: 'Growth', service_charge: 1450, is_active: true },
    },
    'service_id',
    { sort: (a, b) => a.service_charge - b.service_charge }
  );
  assert.equal(afterInsert.length, 2);
  assert.deepEqual(
    afterInsert.map((r) => r.service_id),
    ['p1', 'p2']
  );

  // Duplicate INSERT broadcast (e.g., optimistic insert + realtime echo) must NOT duplicate
  const afterDuplicate = applyRealtimeChange(
    afterInsert,
    {
      eventType: 'INSERT',
      new: { service_id: 'p2', service_title: 'Growth Updated', service_charge: 1450, is_active: true },
    },
    'service_id',
    { sort: (a, b) => a.service_charge - b.service_charge }
  );
  assert.equal(afterDuplicate.length, 2);
  assert.equal(afterDuplicate[1].service_title, 'Growth Updated');
});

test('applyRealtimeChange handles UPDATE, filter exclusion, and DELETE cleanly', () => {
  const initial: PlanRow[] = [
    { service_id: 'p1', service_title: 'Starter', service_charge: 750, is_active: true },
    { service_id: 'p2', service_title: 'Enterprise', service_charge: 2499, is_active: true },
  ];

  // UPDATE changes price and re-sorts
  const updated = applyRealtimeChange(
    initial,
    {
      eventType: 'UPDATE',
      new: { service_id: 'p2', service_title: 'Enterprise', service_charge: 500, is_active: true },
    },
    'service_id',
    {
      filter: (r) => r.is_active,
      sort: (a, b) => a.service_charge - b.service_charge,
    }
  );
  assert.deepEqual(
    updated.map((r) => r.service_id),
    ['p2', 'p1']
  );

  // UPDATE failing filter removes row from active view
  const deactivated = applyRealtimeChange(
    updated,
    {
      eventType: 'UPDATE',
      new: { service_id: 'p2', service_title: 'Enterprise', service_charge: 500, is_active: false },
    },
    'service_id',
    { filter: (r) => r.is_active }
  );
  assert.deepEqual(
    deactivated.map((r) => r.service_id),
    ['p1']
  );

  // DELETE removes existing row and is a safe no-op for unknown IDs
  const deleted = applyRealtimeChange(
    deactivated,
    { eventType: 'DELETE', old: { service_id: 'p1' } },
    'service_id'
  );
  assert.equal(deleted.length, 0);

  const noop = applyRealtimeChange(
    deleted,
    { eventType: 'DELETE', old: { service_id: 'missing-id' } },
    'service_id'
  );
  assert.equal(noop.length, 0);
});
