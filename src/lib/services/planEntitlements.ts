export interface PlanFeatureFlags {
  is_gdrive_allowed: boolean;
  is_import_export_allowed: boolean;
  allowed_count_wing: number;
  is_email_service: boolean;
  is_collaburation_allowed: boolean;
}

export type PlanDurationType = 'Monthly' | 'Quarterly' | 'Yearly';

/**
 * Parses comma- or newline-separated feature_list text from OurServicesBook
 * into clean display items.
 */
export function parseFeatureList(featureList?: string | null): string[] {
  if (!featureList) return [];
  return featureList
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Derives school feature entitlements from an OurServicesBook plan's feature_list.
 */
export function deriveEntitlementsFromFeatureList(featureList?: string | null): PlanFeatureFlags {
  const items = parseFeatureList(featureList).map((s) => s.toLowerCase());
  const joined = items.join(' | ');

  const wingMatch = joined.match(/(\d+)\s*wings?/i);
  const parsedWings = wingMatch ? Number.parseInt(wingMatch[1], 10) : 7;

  return {
    is_gdrive_allowed: /google\s*drive|gdrive/.test(joined),
    is_import_export_allowed: /import\s*[/&-]?\s*export|csv/.test(joined),
    allowed_count_wing: Number.isFinite(parsedWings) && parsedWings > 0 ? parsedWings : 7,
    is_email_service: /email\s*service|email\s*notif|mail\s*service/.test(joined),
    is_collaburation_allowed: /collab|team\s*space/.test(joined),
  };
}

/**
 * Computes subscription end_at date (YYYY-MM-DD) given a start date and plan type.
 */
export function computePlanEndDate(startedAt: string, plainType: PlanDurationType): string {
  const base = startedAt ? new Date(`${startedAt}T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const monthsToAdd = plainType === 'Yearly' ? 12 : plainType === 'Quarterly' ? 3 : 1;
  base.setUTCMonth(base.getUTCMonth() + monthsToAdd);
  return base.toISOString().slice(0, 10);
}

/**
 * Computes total plan charge based on base monthly service_charge and duration.
 */
export function computeTotalCharge(monthlyCharge: number, plainType: PlanDurationType): number {
  const base = Number.isFinite(monthlyCharge) && monthlyCharge > 0 ? monthlyCharge : 0;
  if (plainType === 'Quarterly') return Math.round(base * 3 * 0.95);
  if (plainType === 'Yearly') return Math.round(base * 12 * 0.85);
  return base;
}

/**
 * Serializes records to CSV for schools with is_import_export_allowed = true.
 */
export function serializeRowsToCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>
): string {
  const escapeCell = (val: unknown): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.map(escapeCell).join(',');
  const dataLines = rows.map((row) => headers.map((h) => escapeCell(row[h])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Parses simple CSV text into key-value records using the first row as headers.
 */
export function parseCsvText(csvText: string): Array<Record<string, string>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] ?? '';
    });
    return record;
  });
}
