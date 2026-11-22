import { SupaBaseClientFunction } from '../SupaBaseClient/SupaBaseClientFunction';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = SupaBaseClientFunction();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    requireAuth?: boolean;
  }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options?.requireAuth !== false) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !payload?.success) {
    throw new ApiRequestError(
      res.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.message ?? `Request failed with HTTP ${res.status}`
    );
  }

  return payload.data as T;
}

export interface HealthData {
  status: string;
  database: {
    mode: 'turso' | 'local_file' | 'memory';
    target: string;
    migrationsApplied: number;
  };
  activeSchoolsCount: number;
  supabaseAuthConfigured: boolean;
}

export interface PublicSchoolSummary {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  city: string | null;
  state: string | null;
  country: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  about_summary: string | null;
  established_year: number | null;
  wing_count: number;
  programme_count: number;
}

export interface PublicSchoolWebsiteData {
  school: PublicSchoolSummary & {
    email: string | null;
    phone: string | null;
    website_url: string | null;
  };
  wings: Array<{
    id: string;
    name: string;
    slug: string;
    wing_type: string;
    description: string | null;
  }>;
  programmes: Array<{
    id: string;
    wing_id: string | null;
    title: string;
    slug: string;
    summary: string | null;
    description: string | null;
    programme_type: string;
    registration_required: number;
    start_at: string | null;
    end_at: string | null;
    venue: string | null;
    max_participants: number | null;
    published_at: string | null;
  }>;
  achievements: Array<{
    id: string;
    title: string;
    description: string | null;
    achievement_level: string;
    achieved_on: string | null;
    recipient_type: string;
    recipient_name: string | null;
  }>;
  news: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body_markdown: string;
    published_at: string | null;
  }>;
  notices: Array<{
    id: string;
    title: string;
    body: string;
    priority: string;
    is_pinned: number;
    publish_at: string | null;
    created_at: string;
  }>;
}

export interface OnboardingRequestItem {
  id: string;
  school_name: string;
  requested_slug: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewed_at: string | null;
  rejection_reason: string | null;
  provisioned_school_id: string | null;
  created_at: string;
}

export interface ProvisionedSchoolResponse {
  school: {
    id: string;
    name: string;
    slug: string;
    status: string;
    email: string;
  };
  initialInvitation: {
    invitationId: string;
    email: string;
    roleCode: string;
    expiresAt: string;
    rawToken: string;
  };
}

export interface AuditLogItem {
  id: string;
  scope: string;
  school_id: string | null;
  school_name?: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface OutboxEventItem {
  id: string;
  school_id: string | null;
  event_type: string;
  payload_json: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  idempotency_key: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface TursoSchoolSummary {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  status: 'pending' | 'active' | 'suspended' | 'archived';
  school_code: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  member_count: number;
  wing_count: number;
  programme_count: number;
  created_at: string;
}
