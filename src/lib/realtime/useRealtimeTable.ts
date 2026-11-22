import { useEffect, useRef } from 'react';
import SupaBaseClientFunction from '../SupaBaseClient/SupaBaseClientFunction';

export interface RealtimeChangePayload<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new?: Partial<T> | Record<string, unknown> | null;
  old?: Partial<T> | Record<string, unknown> | null;
}

export interface ApplyRealtimeOptions<T> {
  filter?: (row: T) => boolean;
  sort?: (a: T, b: T) => number;
}

/**
 * Pure, idempotent reducer for Supabase postgres_changes payloads.
 * Guards against duplicate INSERTs during reconnection races or optimistic updates.
 */
export function applyRealtimeChange<T extends object>(
  currentRows: T[],
  payload: RealtimeChangePayload<T>,
  primaryKey: keyof T,
  options?: ApplyRealtimeOptions<T>
): T[] {
  const { eventType } = payload;
  const newRow = payload.new as T | null | undefined;
  const oldRow = payload.old as Partial<T> | null | undefined;
  const filter = options?.filter;
  const sort = options?.sort;

  let next = currentRows;

  if (eventType === 'INSERT' && newRow && newRow[primaryKey] !== undefined) {
    if (filter && !filter(newRow)) {
      return currentRows;
    }
    const id = newRow[primaryKey];
    const exists = currentRows.some((item) => item[primaryKey] === id);
    if (exists) {
      next = currentRows.map((item) => (item[primaryKey] === id ? { ...item, ...newRow } : item));
    } else {
      next = [newRow, ...currentRows];
    }
  } else if (eventType === 'UPDATE' && newRow && newRow[primaryKey] !== undefined) {
    const id = newRow[primaryKey];
    const passesFilter = !filter || filter(newRow);
    const exists = currentRows.some((item) => item[primaryKey] === id);

    if (!passesFilter) {
      next = exists ? currentRows.filter((item) => item[primaryKey] !== id) : currentRows;
    } else if (exists) {
      next = currentRows.map((item) => (item[primaryKey] === id ? { ...item, ...newRow } : item));
    } else {
      next = [newRow, ...currentRows];
    }
  } else if (eventType === 'DELETE') {
    const deletedId = oldRow?.[primaryKey] ?? newRow?.[primaryKey];
    if (deletedId !== undefined) {
      const exists = currentRows.some((item) => item[primaryKey] === deletedId);
      if (!exists) return currentRows;
      next = currentRows.filter((item) => item[primaryKey] !== deletedId);
    }
  }

  if (sort && next !== currentRows) {
    return [...next].sort(sort);
  }
  return next;
}

export interface TableSubscriptionConfig {
  table: string;
  schema?: string;
  filter?: string;
  onChange: (payload: RealtimeChangePayload) => void;
}

/**
 * Subscribes a React component to one or more Supabase Realtime postgres_changes tables.
 * Uses stable callback refs so channels do not churn on every render, and triggers
 * optional onResync when the channel transitions back to SUBSCRIBED after a reconnect.
 */
export function useRealtimeTables(
  channelBaseName: string,
  subscriptions: TableSubscriptionConfig[],
  options?: { enabled?: boolean; onResync?: () => void }
): void {
  const enabled = options?.enabled ?? true;
  const subsRef = useRef(subscriptions);
  subsRef.current = subscriptions;

  const resyncRef = useRef(options?.onResync);
  resyncRef.current = options?.onResync;

  const tablesKey = subscriptions
    .map((s) => `${s.schema ?? 'public'}.${s.table}:${s.filter ?? ''}`)
    .join('|');

  useEffect(() => {
    if (!enabled || !tablesKey) return;

    const supabase = SupaBaseClientFunction();
    const channelId = `${channelBaseName}-${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase.channel(channelId);
    let hasSubscribedOnce = false;

    subsRef.current.forEach((sub, idx) => {
      const filterConfig: {
        event: '*';
        schema: string;
        table: string;
        filter?: string;
      } = {
        event: '*',
        schema: sub.schema ?? 'public',
        table: sub.table,
      };
      if (sub.filter) {
        filterConfig.filter = sub.filter;
      }

      channel = channel.on('postgres_changes', filterConfig, (payload: RealtimeChangePayload) => {
        subsRef.current[idx]?.onChange(payload);
      });
    });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        if (hasSubscribedOnce) {
          // Resync authoritative server state after reconnection
          resyncRef.current?.();
        }
        hasSubscribedOnce = true;
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelBaseName, tablesKey, enabled]);
}
