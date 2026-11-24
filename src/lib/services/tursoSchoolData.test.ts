import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { runMigrations } from '../../../server/db/migrations';
import {
  normalizeTursoSchoolClass,
  normalizeTursoSchoolInfo,
  toSqliteBit,
} from './tursoSchoolData';

describe('Turso SchoolInfo & SchoolClasses normalization and schema migration 006', () => {
  it('converts boolean/integer values to SQLite 0/1 bits safely', () => {
    assert.equal(toSqliteBit(true), 1);
    assert.equal(toSqliteBit(1), 1);
    assert.equal(toSqliteBit('1'), 1);
    assert.equal(toSqliteBit(false), 0);
    assert.equal(toSqliteBit(0), 0);
    assert.equal(toSqliteBit(null), 0);
  });

  it('normalizes Turso SchoolInfo and SchoolClasses rows accurately', () => {
    const info = normalizeTursoSchoolInfo({
      school_info_id: 'info-1',
      created_at: '23 11 2026 10:00:00',
      school_id: 'sch-101',
      total_class: 12,
      primery_class_fee: 600,
      seconday_class_fee: 850,
      is_computer_lab: 1,
      is_library: 0,
      about_school: 'Campus overview',
      school_vission: 'Lead with knowledge',
      school_mission: 'Empower students',
    });
    assert.ok(info);
    assert.equal(info.is_computer_lab, 1);
    assert.equal(info.is_library, 0);
    assert.equal(info.primery_class_fee, 600);
    assert.equal(info.seconday_class_fee, 850);

    const cls = normalizeTursoSchoolClass({
      class_id: 'cls-1',
      created_at: '23 11 2026 10:05:00',
      school_id: 'sch-101',
      class_title: 'Seconday First Year',
      class_teacher_id: 'tch-1',
      total_students: 42,
      sub_title: 'U1',
      is_active: 1,
    });
    assert.equal(cls.class_title, 'Seconday First Year');
    assert.equal(cls.sub_title, 'U1');
    assert.equal(cls.total_students, 42);
    assert.equal(cls.is_active, 1);
  });

  it('applies Turso migration 006 and enforces CHECK constraints on SchoolInfo & SchoolClasses', async () => {
    const client = createClient({ url: ':memory:' });
    await runMigrations(client);

    await client.execute({
      sql: `INSERT INTO \`SchoolInfo\` (\`school_id\`, \`total_class\`, \`primery_class_fee\`, \`seconday_class_fee\`, \`is_computer_lab\`, \`is_library\`, \`about_school\`)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ['sch-101', 10, 550, 750, 1, 1, 'Greenwood Turso profile'],
    });

    const infoRes = await client.execute({
      sql: `SELECT * FROM \`SchoolInfo\` WHERE \`school_id\` = ?`,
      args: ['sch-101'],
    });
    assert.equal(infoRes.rows.length, 1);
    assert.ok(String(infoRes.rows[0].school_info_id).length >= 32);
    assert.ok(String(infoRes.rows[0].created_at).length > 0);
    assert.equal(Number(infoRes.rows[0].is_computer_lab), 1);

    // Reject invalid CHECK value (2) for is_computer_lab
    await assert.rejects(
      () =>
        client.execute({
          sql: `INSERT INTO \`SchoolInfo\` (\`school_id\`, \`is_computer_lab\`) VALUES ('sch-bad', 2)`,
        }),
      /CHECK/i
    );

    await client.execute({
      sql: `INSERT INTO \`SchoolClasses\` (\`school_id\`, \`class_title\`, \`class_teacher_id\`, \`total_students\`, \`sub_title\`, \`is_active\`)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['sch-101', 'Seconday First Year', 'tch-1', 38, 'U1', 1],
    });
    const clsRes = await client.execute({
      sql: `SELECT * FROM \`SchoolClasses\` WHERE \`school_id\` = ?`,
      args: ['sch-101'],
    });
    assert.equal(clsRes.rows.length, 1);
    assert.equal(clsRes.rows[0].class_title, 'Seconday First Year');
    assert.equal(clsRes.rows[0].sub_title, 'U1');

    client.close();
  });
});
