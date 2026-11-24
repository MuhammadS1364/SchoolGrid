-- ============================================================================
-- SchoolGrid — Turso (libSQL / SQLite) Table Commands
-- Run these in your Turso CLI (`turso db shell <db-name>`) or Turso Studio.
-- ============================================================================

-- 1. Recommended column on your existing `SchoolClasses` table so classes can
--    be filtered directly per school (in addition to `class_teacher_id`):
--    (Skip if you already added `school_id`.)
ALTER TABLE `SchoolClasses` ADD COLUMN `school_id` text;
CREATE INDEX IF NOT EXISTS `idx_schoolclasses_school_id` ON `SchoolClasses` (`school_id`);
CREATE INDEX IF NOT EXISTS `idx_schoolclasses_teacher_id` ON `SchoolClasses` (`class_teacher_id`);
CREATE INDEX IF NOT EXISTS `idx_schoolinfo_school_id` ON `SchoolInfo` (`school_id`);

-- 2. FeatureBox (from your ERD — campus/plan features catalog)
CREATE TABLE IF NOT EXISTS `FeatureBox` (
  `feature_id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  `created_at` text DEFAULT (strftime('%d %m %Y %H:%M:%S', 'now', '+5 hours', '+30 minutes')) NOT NULL,
  `feature_title` text NOT NULL,
  `is_active` integer DEFAULT 1,
  CONSTRAINT "FeatureBox_is_active_check" CHECK(is_active IN (0, 1))
);

-- 3. Services Catalog (`OurServicesBook` — hold until ready to migrate Services to Turso)
CREATE TABLE IF NOT EXISTS `OurServicesBook` (
  `service_id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  `created_at` text DEFAULT (strftime('%d %m %Y %H:%M:%S', 'now', '+5 hours', '+30 minutes')) NOT NULL,
  `service_title` text NOT NULL,
  `service_subtitle` text,
  `monthly_charge` integer DEFAULT 0,
  `yearly_charge` integer DEFAULT 0,
  `feature_list` text,
  `is_active` integer DEFAULT 1,
  CONSTRAINT "OurServicesBook_is_active_check" CHECK(is_active IN (0, 1))
);

-- 4. School Subscriptions & Payment Approvals (`OurServiceHolder`)
CREATE TABLE IF NOT EXISTS `OurServiceHolder` (
  `holder_id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  `created_at` text DEFAULT (strftime('%d %m %Y %H:%M:%S', 'now', '+5 hours', '+30 minutes')) NOT NULL,
  `service_id` text REFERENCES `OurServicesBook`(`service_id`) ON DELETE SET NULL,
  `school_id` text,
  `holder_fullname` text NOT NULL,
  `holder_email` text NOT NULL,
  `holder_phone` text,
  `plain_type` text DEFAULT 'monthly' CHECK(plain_type IN ('monthly', 'yearly')),
  `duration_count` integer DEFAULT 1,
  `total_charge` integer DEFAULT 0,
  `payment_method` text DEFAULT 'UPI',
  `payment_ref` text,
  `status` text DEFAULT 'pending_approval' CHECK(status IN ('pending_approval', 'approved', 'rejected', 'school_registered')),
  `plan_start_date` text,
  `plan_end_date` text
);
CREATE INDEX IF NOT EXISTS `idx_service_holder_school` ON `OurServiceHolder` (`school_id`, `status`);

-- 5. Public Google Drive File Links (`school_drive_files` — stores "Anyone with the link" URLs)
CREATE TABLE IF NOT EXISTS `school_drive_files` (
  `id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  `created_at` text DEFAULT (strftime('%d %m %Y %H:%M:%S', 'now', '+5 hours', '+30 minutes')) NOT NULL,
  `school_id` text NOT NULL,
  `drive_file_id` text NOT NULL,
  `file_name` text NOT NULL,
  `folder_name` text DEFAULT 'Admissions',
  `mime_type` text DEFAULT 'application/octet-stream',
  `size_label` text,
  `owner_gmail` text,
  `access_mode` text DEFAULT 'anyone_with_link',
  `public_link` text NOT NULL,
  `direct_url` text,
  `linked_table` text DEFAULT 'school_drive_files',
  `linked_record_id` text
);
CREATE INDEX IF NOT EXISTS `idx_drive_files_school` ON `school_drive_files` (`school_id`, `created_at`);
