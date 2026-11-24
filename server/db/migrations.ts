import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { enforceForeignKeys } from './client';

export interface MigrationSpec {
  version: string;
  name: string;
  statements: string[];
}

export const MIGRATIONS: MigrationSpec[] = [
  {
    version: '001',
    name: 'platform_identity_and_schools',
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        supabase_auth_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        phone TEXT,
        avatar_file_id TEXT,
        account_status TEXT NOT NULL DEFAULT 'active'
          CHECK (account_status IN ('active', 'suspended', 'disabled')),
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status)`,
      `CREATE TABLE IF NOT EXISTS schools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT,
        slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'active', 'suspended', 'archived')),
        school_code TEXT UNIQUE,
        email TEXT,
        phone TEXT,
        website_url TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        postal_code TEXT,
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        primary_color TEXT,
        secondary_color TEXT,
        logo_file_id TEXT,
        banner_file_id TEXT,
        about_summary TEXT,
        established_year INTEGER,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        approved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        approved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status)`,
      `CREATE TABLE IF NOT EXISTS platform_roles (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS platform_permissions (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        module TEXT NOT NULL,
        description TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS platform_role_permissions (
        platform_role_id TEXT NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
        platform_permission_id TEXT NOT NULL REFERENCES platform_permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (platform_role_id, platform_permission_id)
      )`,
      `CREATE TABLE IF NOT EXISTS platform_user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform_role_id TEXT NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'revoked')),
        granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        revoked_at TEXT,
        UNIQUE(user_id, platform_role_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_platform_user_roles_user ON platform_user_roles(user_id, status)`,
    ],
  },
  {
    version: '002',
    name: 'tenant_rbac_onboarding_and_invitations',
    statements: [
      `CREATE TABLE IF NOT EXISTS school_memberships (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        membership_status TEXT NOT NULL DEFAULT 'active'
          CHECK (membership_status IN ('invited', 'active', 'suspended', 'revoked')),
        is_primary_school INTEGER NOT NULL DEFAULT 0 CHECK (is_primary_school IN (0, 1)),
        joined_at TEXT,
        invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, user_id),
        UNIQUE(school_id, id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_school_memberships_user ON school_memberships(user_id, membership_status)`,
      `CREATE INDEX IF NOT EXISTS idx_school_memberships_school ON school_memberships(school_id, membership_status)`,
      `CREATE TABLE IF NOT EXISTS school_roles (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, code),
        UNIQUE(school_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        module TEXT NOT NULL,
        description TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS role_permissions (
        school_role_id TEXT NOT NULL REFERENCES school_roles(id) ON DELETE CASCADE,
        permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (school_role_id, permission_id)
      )`,
      `CREATE TABLE IF NOT EXISTS membership_roles (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        membership_id TEXT NOT NULL,
        school_role_id TEXT NOT NULL,
        assigned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(membership_id, school_role_id),
        FOREIGN KEY (school_id, membership_id) REFERENCES school_memberships(school_id, id) ON DELETE CASCADE,
        FOREIGN KEY (school_id, school_role_id) REFERENCES school_roles(school_id, id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_membership_roles_school ON membership_roles(school_id, membership_id)`,
      `CREATE TABLE IF NOT EXISTS school_invitations (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        school_role_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
        expires_at TEXT NOT NULL,
        invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        accepted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (school_id, school_role_id) REFERENCES school_roles(school_id, id) ON DELETE RESTRICT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_school_invitations_school_email ON school_invitations(school_id, email, status)`,
      `CREATE TABLE IF NOT EXISTS school_onboarding_requests (
        id TEXT PRIMARY KEY,
        school_name TEXT NOT NULL,
        requested_slug TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
        reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TEXT,
        rejection_reason TEXT,
        provisioned_school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_onboarding_status ON school_onboarding_requests(status, created_at)`,
      `CREATE TABLE IF NOT EXISTS school_settings (
        school_id TEXT PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
        public_site_enabled INTEGER NOT NULL DEFAULT 1 CHECK (public_site_enabled IN (0, 1)),
        public_news_enabled INTEGER NOT NULL DEFAULT 1 CHECK (public_news_enabled IN (0, 1)),
        public_gallery_enabled INTEGER NOT NULL DEFAULT 1 CHECK (public_gallery_enabled IN (0, 1)),
        public_achievements_enabled INTEGER NOT NULL DEFAULT 1 CHECK (public_achievements_enabled IN (0, 1)),
        public_programmes_enabled INTEGER NOT NULL DEFAULT 1 CHECK (public_programmes_enabled IN (0, 1)),
        student_self_registration_enabled INTEGER NOT NULL DEFAULT 1 CHECK (student_self_registration_enabled IN (0, 1)),
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
    ],
  },
  {
    version: '003',
    name: 'school_structure_wings_students_and_staff',
    statements: [
      `CREATE TABLE IF NOT EXISTS school_years (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, name),
        UNIQUE(school_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS school_classes (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        grade_level INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, name),
        UNIQUE(school_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS school_sections (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        class_id TEXT NOT NULL,
        name TEXT NOT NULL,
        capacity INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, class_id, name),
        UNIQUE(school_id, id),
        FOREIGN KEY (school_id, class_id) REFERENCES school_classes(school_id, id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS wings (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        wing_type TEXT NOT NULL DEFAULT 'general'
          CHECK (wing_type IN ('academic', 'cultural', 'sports', 'club', 'administrative', 'general')),
        description TEXT,
        lead_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'inactive', 'archived')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT,
        UNIQUE(school_id, slug),
        UNIQUE(school_id, id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_wings_school_status ON wings(school_id, status)`,
      `CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        wing_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'inactive', 'archived')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, name),
        UNIQUE(school_id, id),
        FOREIGN KEY (school_id, wing_id) REFERENCES wings(school_id, id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        admission_no TEXT NOT NULL,
        roll_no TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT,
        date_of_birth TEXT,
        gender TEXT,
        class_id TEXT,
        section_id TEXT,
        guardian_name TEXT,
        guardian_phone TEXT,
        guardian_email TEXT,
        photo_file_id TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
        joined_date TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT,
        UNIQUE(school_id, admission_no),
        UNIQUE(school_id, id),
        FOREIGN KEY (school_id, class_id) REFERENCES school_classes(school_id, id) ON DELETE SET NULL,
        FOREIGN KEY (school_id, section_id) REFERENCES school_sections(school_id, id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_students_school_status ON students(school_id, status)`,
      `CREATE TABLE IF NOT EXISTS staff_profiles (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        employee_code TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        designation TEXT NOT NULL,
        department TEXT,
        bio TEXT,
        is_public_visible INTEGER NOT NULL DEFAULT 0 CHECK (is_public_visible IN (0, 1)),
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'inactive')),
        joined_date TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, employee_code),
        UNIQUE(school_id, id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_staff_school_status ON staff_profiles(school_id, status)`,
    ],
  },
  {
    version: '004',
    name: 'programmes_achievements_news_notices_and_gallery',
    statements: [
      `CREATE TABLE IF NOT EXISTS programme_categories (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        UNIQUE(school_id, slug),
        UNIQUE(school_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS programmes (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        wing_id TEXT,
        category_id TEXT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        summary TEXT,
        description TEXT,
        programme_type TEXT NOT NULL DEFAULT 'event'
          CHECK (programme_type IN ('event', 'competition', 'workshop', 'seminar', 'sports', 'cultural', 'other')),
        visibility TEXT NOT NULL DEFAULT 'school_only'
          CHECK (visibility IN ('public', 'school_only', 'wing_only')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'completed', 'cancelled', 'archived')),
        registration_required INTEGER NOT NULL DEFAULT 0 CHECK (registration_required IN (0, 1)),
        registration_open_at TEXT,
        registration_close_at TEXT,
        start_at TEXT,
        end_at TEXT,
        venue TEXT,
        max_participants INTEGER,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT,
        UNIQUE(school_id, slug),
        UNIQUE(school_id, id),
        FOREIGN KEY (school_id, wing_id) REFERENCES wings(school_id, id) ON DELETE SET NULL,
        FOREIGN KEY (school_id, category_id) REFERENCES programme_categories(school_id, id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_programmes_school_status ON programmes(school_id, status, visibility, start_at)`,
      `CREATE TABLE IF NOT EXISTS programme_registrations (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        programme_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        registered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'waitlisted')),
        notes TEXT,
        registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, programme_id, student_id),
        FOREIGN KEY (school_id, programme_id) REFERENCES programmes(school_id, id) ON DELETE CASCADE,
        FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        programme_id TEXT,
        wing_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        achievement_level TEXT NOT NULL DEFAULT 'school'
          CHECK (achievement_level IN ('school', 'district', 'state', 'national', 'international')),
        achieved_on TEXT,
        recipient_type TEXT NOT NULL DEFAULT 'student'
          CHECK (recipient_type IN ('student', 'team', 'staff', 'school')),
        student_id TEXT,
        team_id TEXT,
        recipient_name TEXT,
        visibility TEXT NOT NULL DEFAULT 'school_only'
          CHECK (visibility IN ('public', 'school_only')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'archived')),
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT,
        UNIQUE(school_id, id),
        FOREIGN KEY (school_id, programme_id) REFERENCES programmes(school_id, id) ON DELETE SET NULL,
        FOREIGN KEY (school_id, wing_id) REFERENCES wings(school_id, id) ON DELETE SET NULL,
        FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE SET NULL,
        FOREIGN KEY (school_id, team_id) REFERENCES teams(school_id, id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_achievements_school_pub ON achievements(school_id, status, visibility, achieved_on)`,
      `CREATE TABLE IF NOT EXISTS content_pages (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        body_markdown TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'public'
          CHECK (visibility IN ('public', 'school_only')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'archived')),
        published_at TEXT,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, slug)
      )`,
      `CREATE TABLE IF NOT EXISTS news_posts (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        excerpt TEXT,
        body_markdown TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'public'
          CHECK (visibility IN ('public', 'school_only')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'archived')),
        published_at TEXT,
        author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT,
        UNIQUE(school_id, slug)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_news_school_pub ON news_posts(school_id, status, visibility, published_at)`,
      `CREATE TABLE IF NOT EXISTS notices (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal'
          CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        audience TEXT NOT NULL DEFAULT 'school_all'
          CHECK (audience IN ('public', 'school_all', 'students', 'staff', 'wing')),
        wing_id TEXT,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'expired', 'archived')),
        is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
        publish_at TEXT,
        expires_at TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (school_id, wing_id) REFERENCES wings(school_id, id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notices_school_pub ON notices(school_id, status, audience, is_pinned)`,
      `CREATE TABLE IF NOT EXISTS gallery_albums (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        visibility TEXT NOT NULL DEFAULT 'public'
          CHECK (visibility IN ('public', 'school_only')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'archived')),
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(school_id, slug),
        UNIQUE(school_id, id)
      )`,
    ],
  },
  {
    version: '005',
    name: 'storage_audit_outbox_and_idempotency',
    statements: [
      `CREATE TABLE IF NOT EXISTS storage_connections (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'google_drive'
          CHECK (provider IN ('google_drive')),
        provider_account_email TEXT NOT NULL,
        root_folder_id TEXT NOT NULL,
        encrypted_refresh_token TEXT,
        token_expires_at TEXT,
        status TEXT NOT NULL DEFAULT 'connected'
          CHECK (status IN ('connected', 'expired', 'revoked', 'error')),
        connected_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        connected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        storage_provider TEXT NOT NULL DEFAULT 'google_drive'
          CHECK (storage_provider IN ('google_drive')),
        provider_file_id TEXT NOT NULL,
        folder_key TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'private'
          CHECK (visibility IN ('public', 'school_only', 'private')),
        uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at TEXT,
        UNIQUE(school_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK (scope IN ('platform', 'school')),
        school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        metadata_json TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_school_time ON audit_logs(school_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_scope_time ON audit_logs(scope, created_at)`,
      `CREATE TABLE IF NOT EXISTS outbox_events (
        id TEXT PRIMARY KEY,
        school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        available_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        processed_at TEXT,
        last_error TEXT,
        idempotency_key TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status, available_at)`,
      `CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        response_status INTEGER,
        response_json TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
    ],
  },
  {
    version: '006',
    name: 'turso_school_info_and_classes',
    statements: [
      `CREATE TABLE IF NOT EXISTS \`SchoolInfo\` (
        \`school_info_id\` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        \`created_at\` text DEFAULT (strftime('%d %m %Y %H:%M:%S', 'now', '+5 hours', '+30 minutes')) NOT NULL,
        \`school_id\` text,
        \`total_class\` integer DEFAULT 5,
        \`primery_class_fee\` integer DEFAULT 550,
        \`seconday_class_fee\` integer DEFAULT 750,
        \`insta_id_link\` text,
        \`facebook_link\` text,
        \`youtube_link\` text,
        \`is_computer_lab\` integer DEFAULT 0,
        \`is_library\` integer DEFAULT 0,
        \`about_school\` text,
        \`school_vission\` text,
        \`school_mission\` text,
        CONSTRAINT "SchoolInfo_check_1" CHECK(is_computer_lab IN (0, 1)),
        CONSTRAINT "SchoolInfo_check_2" CHECK(is_library IN (0, 1))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_turso_schoolinfo_school_id ON \`SchoolInfo\`(\`school_id\`)`,
      `CREATE TABLE IF NOT EXISTS \`SchoolClasses\` (
        \`class_id\` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        \`created_at\` text DEFAULT (strftime('%d %m %Y %H:%M:%S', 'now', '+5 hours', '+30 minutes')) NOT NULL,
        \`school_id\` text,
        \`class_title\` text DEFAULT 'Seconday First Year',
        \`class_teacher_id\` text,
        \`total_students\` integer DEFAULT 0,
        \`sub_title\` text DEFAULT 'U1',
        \`is_active\` integer DEFAULT 1,
        CONSTRAINT "SchoolClasses_check_3" CHECK(is_active IN (0, 1))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_turso_schoolclasses_school_id ON \`SchoolClasses\`(\`school_id\`)`,
      `CREATE INDEX IF NOT EXISTS idx_turso_schoolclasses_teacher_id ON \`SchoolClasses\`(\`class_teacher_id\`)`,
    ],
  },
];

export const PLATFORM_ROLES = [
  { id: 'pr_super_admin', code: 'super_admin', name: 'Super Admin', description: 'Full platform governance and tenant provisioning' },
  { id: 'pr_support', code: 'platform_support', name: 'Platform Support', description: 'Assist schools with onboarding and operational troubleshooting' },
  { id: 'pr_auditor', code: 'platform_auditor', name: 'Platform Auditor', description: 'Read-only access to platform telemetry and audit logs' },
] as const;

export const PLATFORM_PERMISSIONS = [
  { id: 'pp_schools_read', code: 'platform.schools.read', module: 'schools', description: 'View all schools' },
  { id: 'pp_schools_create', code: 'platform.schools.create', module: 'schools', description: 'Provision new schools' },
  { id: 'pp_schools_manage', code: 'platform.schools.manage', module: 'schools', description: 'Update, suspend, or archive schools' },
  { id: 'pp_onboarding_review', code: 'platform.onboarding.review', module: 'onboarding', description: 'Approve or reject school onboarding requests' },
  { id: 'pp_audit_read', code: 'platform.audit.read', module: 'audit', description: 'Inspect platform and school audit logs' },
  { id: 'pp_outbox_manage', code: 'platform.outbox.manage', module: 'outbox', description: 'Inspect and retry background outbox jobs' },
  { id: 'pp_settings_manage', code: 'platform.settings.manage', module: 'settings', description: 'Manage global system settings' },
] as const;

export const SCHOOL_PERMISSIONS = [
  { id: 'sp_school_read', code: 'school.read', module: 'school', description: 'View school dashboard & settings' },
  { id: 'sp_school_manage', code: 'school.manage', module: 'school', description: 'Manage school profile & settings' },
  { id: 'sp_users_invite', code: 'users.invite', module: 'users', description: 'Invite members and assign roles' },
  { id: 'sp_wings_manage', code: 'wings.manage', module: 'wings', description: 'Create and manage wings and teams' },
  { id: 'sp_classes_manage', code: 'classes.manage', module: 'classes', description: 'Manage classes and sections' },
  { id: 'sp_students_read', code: 'students.read', module: 'students', description: 'View student directory' },
  { id: 'sp_students_manage', code: 'students.manage', module: 'students', description: 'Add and update students' },
  { id: 'sp_staff_manage', code: 'staff.manage', module: 'staff', description: 'Manage staff profiles' },
  { id: 'sp_programmes_manage', code: 'programmes.manage', module: 'programmes', description: 'Create, edit, and publish programmes' },
  { id: 'sp_programmes_register', code: 'programmes.register', module: 'programmes', description: 'Register students for programmes' },
  { id: 'sp_achievements_manage', code: 'achievements.manage', module: 'achievements', description: 'Create and publish achievements' },
  { id: 'sp_content_manage', code: 'content.manage', module: 'content', description: 'Create and publish news, notices, and pages' },
  { id: 'sp_storage_manage', code: 'storage.manage', module: 'storage', description: 'Manage Google Drive storage connection' },
  { id: 'sp_audit_read', code: 'audit.read', module: 'audit', description: 'Read school-scoped audit logs' },
] as const;

export const DEFAULT_SCHOOL_ROLE_BUNDLES: Record<string, { name: string; description: string; permissionIds: string[] }> = {
  school_admin: {
    name: 'School Admin',
    description: 'Full institutional governance within this school',
    permissionIds: SCHOOL_PERMISSIONS.map((p) => p.id),
  },
  wing_manager: {
    name: 'Wing Manager',
    description: 'Manage wings, programmes, participants, and achievements',
    permissionIds: [
      'sp_school_read',
      'sp_wings_manage',
      'sp_students_read',
      'sp_programmes_manage',
      'sp_programmes_register',
      'sp_achievements_manage',
    ],
  },
  teacher: {
    name: 'Teacher',
    description: 'View classes, students, and register participants in programmes',
    permissionIds: [
      'sp_school_read',
      'sp_students_read',
      'sp_programmes_register',
      'sp_achievements_manage',
    ],
  },
  content_manager: {
    name: 'Content Manager',
    description: 'Manage news posts, notices, gallery albums, and public pages',
    permissionIds: [
      'sp_school_read',
      'sp_content_manage',
      'sp_achievements_manage',
    ],
  },
  student: {
    name: 'Student',
    description: 'View school programmes, notices, achievements, and register for activities',
    permissionIds: ['sp_school_read', 'sp_programmes_register'],
  },
};

export async function runMigrations(client: Client, options?: { seedDemoSchool?: boolean }): Promise<void> {
  await enforceForeignKeys(client);

  await client.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`
  );

  const existing = await client.execute('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(existing.rows.map((r) => String(r.version)));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    for (const stmt of migration.statements) {
      await client.execute(stmt);
    }
    await client.execute({
      sql: 'INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (?, ?)',
      args: [migration.version, migration.name],
    });
  }

  // Seed platform roles and permissions idempotently
  for (const role of PLATFORM_ROLES) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO platform_roles (id, code, name, description) VALUES (?, ?, ?, ?)',
      args: [role.id, role.code, role.name, role.description],
    });
  }

  for (const perm of PLATFORM_PERMISSIONS) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO platform_permissions (id, code, module, description) VALUES (?, ?, ?, ?)',
      args: [perm.id, perm.code, perm.module, perm.description],
    });
    // Grant all platform permissions to super_admin
    await client.execute({
      sql: 'INSERT OR IGNORE INTO platform_role_permissions (platform_role_id, platform_permission_id) VALUES (?, ?)',
      args: ['pr_super_admin', perm.id],
    });
  }

  // Support gets read + onboarding review
  for (const permId of ['pp_schools_read', 'pp_onboarding_review', 'pp_audit_read']) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO platform_role_permissions (platform_role_id, platform_permission_id) VALUES (?, ?)',
      args: ['pr_support', permId],
    });
  }

  // Auditor gets read-only
  for (const permId of ['pp_schools_read', 'pp_audit_read']) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO platform_role_permissions (platform_role_id, platform_permission_id) VALUES (?, ?)',
      args: ['pr_auditor', permId],
    });
  }

  for (const perm of SCHOOL_PERMISSIONS) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO permissions (id, code, module, description) VALUES (?, ?, ?, ?)',
      args: [perm.id, perm.code, perm.module, perm.description],
    });
  }

  await client.execute({
    sql: `INSERT OR IGNORE INTO system_settings (key, value_json) VALUES (?, ?)`,
    args: ['platform_config', JSON.stringify({ allowPublicOnboarding: true, inviteExpiryHours: 72 })],
  });

  if (options?.seedDemoSchool !== false) {
    await seedInitialDemoDataIfEmpty(client);
  }
}

async function seedInitialDemoDataIfEmpty(client: Client): Promise<void> {
  const countRes = await client.execute('SELECT COUNT(*) AS cnt FROM schools');
  const count = Number(countRes.rows[0]?.cnt ?? 0);
  if (count > 0) return;

  const schoolId = 'sch_greenwood_001';
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO schools (
      id, name, short_name, slug, status, school_code, email, phone,
      city, state, country, timezone, primary_color, secondary_color,
      about_summary, established_year, approved_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, 'Asia/Kolkata', '#1d4ed8', '#0f172a', ?, ?, ?, ?, ?)`,
    args: [
      schoolId,
      'Greenwood International Academy',
      'Greenwood',
      'greenwood-academy',
      'GWIA-2026',
      'greenwood.academy@gmail.com',
      '+91 98765 43210',
      'Bengaluru',
      'Karnataka',
      'India',
      'A multi-wing senior secondary institution blending STEM robotics, performing arts, and athletics with transparent parent-campus communications.',
      2008,
      now,
      now,
      now,
    ],
  });

  await client.execute({
    sql: `INSERT INTO school_settings (
      school_id, public_site_enabled, public_news_enabled, public_gallery_enabled,
      public_achievements_enabled, public_programmes_enabled, student_self_registration_enabled
    ) VALUES (?, 1, 1, 1, 1, 1, 1)`,
    args: [schoolId],
  });

  for (const [code, bundle] of Object.entries(DEFAULT_SCHOOL_ROLE_BUNDLES)) {
    const roleId = `sr_${schoolId}_${code}`;
    await client.execute({
      sql: 'INSERT OR IGNORE INTO school_roles (id, school_id, code, name, description, is_system) VALUES (?, ?, ?, ?, ?, 1)',
      args: [roleId, schoolId, code, bundle.name, bundle.description],
    });
    for (const permId of bundle.permissionIds) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO role_permissions (school_role_id, permission_id) VALUES (?, ?)',
        args: [roleId, permId],
      });
    }
  }

  // Seed wings
  const wings = [
    { id: 'wng_stem_001', name: 'STEM & Robotics Wing', slug: 'stem-robotics', type: 'academic', desc: 'Applied science, robotics competitions, and Olympiad mentorship.' },
    { id: 'wng_cult_001', name: 'Arts & Cultural Wing', slug: 'arts-cultural', type: 'cultural', desc: 'Debate, classical music, theatre, and literary festivals.' },
    { id: 'wng_sport_001', name: 'Athletics & Sports Wing', slug: 'athletics-sports', type: 'sports', desc: 'Inter-school track, basketball, chess, and swimming programmes.' },
  ];
  for (const w of wings) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO wings (id, school_id, name, slug, wing_type, description, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      args: [w.id, schoolId, w.name, w.slug, w.type, w.desc],
    });
  }

  // Seed published public programmes + 1 internal draft (must never appear publicly)
  await client.execute({
    sql: `INSERT OR IGNORE INTO programmes (
      id, school_id, wing_id, title, slug, summary, description, programme_type,
      visibility, status, registration_required, start_at, end_at, venue, max_participants, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'competition', 'public', 'published', 1, '2026-12-10T09:00:00Z', '2026-12-11T17:00:00Z', 'Innovation Auditorium', 120, ?)`,
    args: [
      'prg_robotics_001',
      schoolId,
      'wng_stem_001',
      'Annual Inter-School Robotics Expo 2026',
      'robotics-expo-2026',
      'Autonomous line-followers, IoT climate sensors, and live student demos.',
      'Students from Grades 6 to 12 collaborate in teams of four to prototype real-world engineering solutions.',
      now,
    ],
  });

  await client.execute({
    sql: `INSERT OR IGNORE INTO programmes (
      id, school_id, wing_id, title, slug, summary, description, programme_type,
      visibility, status, registration_required, start_at, end_at, venue, max_participants, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'cultural', 'public', 'published', 1, '2026-12-18T10:00:00Z', '2026-12-18T18:00:00Z', 'Main Amphitheatre', 200, ?)`,
    args: [
      'prg_literary_001',
      schoolId,
      'wng_cult_001',
      'Winter Literary & Debate Conclave',
      'winter-literary-conclave',
      'Parliamentary debate, slam poetry, and editorial journalism showcase.',
      'Open to senior school students and visiting parents with guest jury panels.',
      now,
    ],
  });

  await client.execute({
    sql: `INSERT OR IGNORE INTO programmes (
      id, school_id, wing_id, title, slug, summary, programme_type, visibility, status
    ) VALUES (?, ?, ?, 'Internal Staff Planning Workshop (Draft)', 'internal-staff-draft', 'Private draft not visible on public site.', 'workshop', 'school_only', 'draft')`,
    args: ['prg_draft_001', schoolId, 'wng_stem_001'],
  });

  // Seed achievements
  await client.execute({
    sql: `INSERT OR IGNORE INTO achievements (
      id, school_id, programme_id, wing_id, title, description, achievement_level,
      achieved_on, recipient_type, recipient_name, visibility, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'state', '2026-10-14', 'team', 'Greenwood Autonomous Squad', 'public', 'published')`,
    args: [
      'ach_state_001',
      schoolId,
      'prg_robotics_001',
      'wng_stem_001',
      '1st Place — State Robotics Championship',
      'Won Gold Medal out of 64 participating schools across Karnataka.',
    ],
  });

  // Seed news posts
  await client.execute({
    sql: `INSERT OR IGNORE INTO news_posts (
      id, school_id, title, slug, excerpt, body_markdown, visibility, status, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'public', 'published', ?)`,
    args: [
      'news_lab_001',
      schoolId,
      'New Solar-Powered STEM Maker Lab Inaugurated',
      'solar-stem-maker-lab-2026',
      'Equipped with 3D printers, microcontroller kits, and collaborative workbenches for Grades 5–12.',
      'Greenwood International Academy officially opened its 4,000 sq. ft. STEM Maker Lab powered entirely by rooftop solar panels.',
      now,
    ],
  });

  // Seed public notice
  await client.execute({
    sql: `INSERT OR IGNORE INTO notices (
      id, school_id, title, body, priority, audience, status, is_pinned, publish_at
    ) VALUES (?, ?, ?, ?, 'high', 'public', 'published', 1, ?)`,
    args: [
      'not_adm_001',
      schoolId,
      'Academic Session 2026–27 Admissions & Campus Tours Open',
      'Campus tours run every Saturday from 10:00 AM to 1:00 PM. Register at the admissions desk or contact greenwood.academy@gmail.com.',
      now,
    ],
  });

  // Seed sample onboarding request awaiting SuperAdmin review
  await client.execute({
    sql: `INSERT OR IGNORE INTO school_onboarding_requests (
      id, school_name, requested_slug, contact_name, contact_email, contact_phone, city, state, country, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    args: [
      'onb_sunrise_001',
      'Sunrise Public Senior Secondary School',
      'sunrise-public',
      'Meera Deshmukh',
      'principal@sunrisepublic.edu',
      '+91 98201 55432',
      'Pune',
      'Maharashtra',
      'India',
      'Requesting 5 wings (STEM, Cultural, Sports, Eco Club, Editorial) with Google Drive archiving.',
    ],
  });

  // Seed initial audit log entry
  await client.execute({
    sql: `INSERT OR IGNORE INTO audit_logs (id, scope, school_id, action, entity_type, entity_id, metadata_json)
          VALUES (?, 'platform', ?, 'school.seeded', 'school', ?, ?)`,
    args: [
      `aud_${crypto.randomUUID().slice(0, 8)}`,
      schoolId,
      schoolId,
      JSON.stringify({ slug: 'greenwood-academy', source: 'initial_bootstrap' }),
    ],
  });
}
