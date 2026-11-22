import crypto from 'node:crypto';
import type { SqlExecutor } from '../db/client';

const SENSITIVE_KEY_PATTERN = /(token|password|secret|authorization|cookie|refresh_token|access_token|api_key)/i;

export function sanitizeAuditMetadata(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;

  const cleanObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = cleanObject(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        out[key] = value.map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? cleanObject(item as Record<string, unknown>)
            : item
        );
      } else {
        out[key] = value;
      }
    }
    return out;
  };

  return cleanObject(input as Record<string, unknown>);
}

export interface AuditEntryInput {
  scope: 'platform' | 'school';
  schoolId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only audit log writer. Never exposes or updates prior audit entries.
 */
export async function writeAuditLog(
  executor: SqlExecutor,
  entry: AuditEntryInput
): Promise<string> {
  const id = `aud_${crypto.randomUUID()}`;
  const sanitized = sanitizeAuditMetadata(entry.metadata ?? null);

  await executor.execute({
    sql: `INSERT INTO audit_logs (
      id, scope, school_id, actor_user_id, action, entity_type, entity_id,
      metadata_json, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      entry.scope,
      entry.schoolId ?? null,
      entry.actorUserId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      sanitized ? JSON.stringify(sanitized) : null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
    ],
  });

  return id;
}

export interface OutboxEventInput {
  schoolId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

/**
 * Enqueues a transactional outbox event so external side-effects (email, storage sync)
 * are decoupled from DB writes and safely retriable.
 */
export async function enqueueOutboxEvent(
  executor: SqlExecutor,
  input: OutboxEventInput
): Promise<string> {
  const id = `out_${crypto.randomUUID()}`;
  const sanitizedPayload = sanitizeAuditMetadata(input.payload) ?? {};
  const idempotencyKey =
    input.idempotencyKey ?? `${input.eventType}:${input.schoolId ?? 'platform'}:${crypto.randomUUID()}`;

  await executor.execute({
    sql: `INSERT OR IGNORE INTO outbox_events (
      id, school_id, event_type, payload_json, status, idempotency_key
    ) VALUES (?, ?, ?, ?, 'pending', ?)`,
    args: [
      id,
      input.schoolId ?? null,
      input.eventType,
      JSON.stringify(sanitizedPayload),
      idempotencyKey,
    ],
  });

  return id;
}
