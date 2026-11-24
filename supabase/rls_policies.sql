-- ============================================================================
-- SchoolGrid — Supabase Schema Helper & Row Level Security (RLS) Script
-- Matches: school_user_info, OurSchools, SchoolInfo, SchoolTeachers,
--          StudentsBox, SchoolClasses, and school_drive_files
-- Run in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 0. Public Google Drive Links Table (stores unrestricted "anyone with link" URLs)
CREATE TABLE IF NOT EXISTS public.school_drive_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  school_id uuid NULL REFERENCES public."OurSchools" (school_id) ON UPDATE CASCADE ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  folder_name text NOT NULL DEFAULT 'Admissions',
  mime_type text NULL,
  size_label text NULL,
  owner_gmail text NULL,
  access_mode text NOT NULL DEFAULT 'anyone_with_link',
  public_link text NOT NULL,
  direct_url text NULL,
  linked_table text NULL DEFAULT 'school_drive_files',
  linked_record_id text NULL,
  CONSTRAINT school_drive_files_pkey PRIMARY KEY (id)
);

-- 1. Helper: check if the authenticated user is an active SuperAdmin in school_user_info
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_user_info
    WHERE user_uuid = auth.uid()
      AND lower(user_role) IN ('superadmin', 'super_admin', 'superadmi')
      AND is_active = true
  );
$$;

-- 2. Helper: resolve the authenticated user's school_id across OurSchools, SchoolTeachers, StudentsBox
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT school_id FROM public."OurSchools" WHERE user_uuid = auth.uid() LIMIT 1),
    (SELECT school_id FROM public."SchoolTeachers" WHERE user_id = auth.uid() LIMIT 1),
    (SELECT school_id FROM public."StudentsBox" WHERE stn_user_id = auth.uid() LIMIT 1)
  );
$$;

-- 3. Enable RLS on all tables
ALTER TABLE IF EXISTS public.school_user_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."OurSchools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SchoolInfo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SchoolClasses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SchoolTeachers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."StudentsBox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_drive_files ENABLE ROW LEVEL SECURITY;

-- 4. school_user_info: user reads own row; SuperAdmin & School Admins manage provisioned accounts
DROP POLICY IF EXISTS "user_info_select_own_or_superadmin" ON public.school_user_info;
CREATE POLICY "user_info_select_own_or_superadmin"
  ON public.school_user_info
  FOR SELECT
  USING (user_uuid = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "user_info_insert_authenticated" ON public.school_user_info;
CREATE POLICY "user_info_insert_authenticated"
  ON public.school_user_info
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR user_uuid = auth.uid()
    OR (
      EXISTS (SELECT 1 FROM public."OurSchools" WHERE user_uuid = auth.uid() AND is_approved = true)
      AND lower(user_role) IN ('teacher', 'student')
    )
  );

DROP POLICY IF EXISTS "user_info_manage_superadmin" ON public.school_user_info;
CREATE POLICY "user_info_manage_superadmin"
  ON public.school_user_info
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 5. OurSchools & SchoolInfo: public can request school (is_approved = false); SuperAdmin approves/manages all
DROP POLICY IF EXISTS "schools_select_tenant_or_approved" ON public."OurSchools";
CREATE POLICY "schools_select_tenant_or_approved"
  ON public."OurSchools"
  FOR SELECT
  USING (
    is_approved = true
    OR user_uuid = auth.uid()
    OR school_id = public.current_user_school_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "schools_insert_request_or_superadmin" ON public."OurSchools";
CREATE POLICY "schools_insert_request_or_superadmin"
  ON public."OurSchools"
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (user_uuid = auth.uid() AND is_approved = false)
  );

DROP POLICY IF EXISTS "schools_update_owner_or_superadmin" ON public."OurSchools";
CREATE POLICY "schools_update_owner_or_superadmin"
  ON public."OurSchools"
  FOR UPDATE
  USING (user_uuid = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_uuid = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "schools_delete_superadmin" ON public."OurSchools";
CREATE POLICY "schools_delete_superadmin"
  ON public."OurSchools"
  FOR DELETE
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "school_info_tenant_or_superadmin" ON public."SchoolInfo";
CREATE POLICY "school_info_tenant_or_superadmin"
  ON public."SchoolInfo"
  FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_super_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_super_admin());

-- 6. SchoolTeachers (requires school_id + user_id) & StudentsBox (requires AddNo + school_id + stn_user_id)
DROP POLICY IF EXISTS "teachers_tenant_isolation" ON public."SchoolTeachers";
CREATE POLICY "teachers_tenant_isolation"
  ON public."SchoolTeachers"
  FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR user_id = auth.uid()
    OR public.is_super_admin()
  )
  WITH CHECK (
    (school_id = public.current_user_school_id() OR public.is_super_admin())
    AND school_id IS NOT NULL
    AND user_id IS NOT NULL
  );

DROP POLICY IF EXISTS "students_box_tenant_isolation" ON public."StudentsBox";
CREATE POLICY "students_box_tenant_isolation"
  ON public."StudentsBox"
  FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR stn_user_id = auth.uid()
    OR public.is_super_admin()
  )
  WITH CHECK (
    (school_id = public.current_user_school_id() OR public.is_super_admin())
    AND school_id IS NOT NULL
    AND stn_user_id IS NOT NULL
  );

-- 7. SchoolClasses & school_drive_files
DROP POLICY IF EXISTS "classes_tenant_isolation" ON public."SchoolClasses";
CREATE POLICY "classes_tenant_isolation"
  ON public."SchoolClasses"
  FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_super_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "drive_files_public_read_and_school_write" ON public.school_drive_files;
CREATE POLICY "drive_files_public_read_and_school_write"
  ON public.school_drive_files
  FOR SELECT
  USING (access_mode = 'anyone_with_link' OR school_id = public.current_user_school_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "drive_files_school_manage" ON public.school_drive_files;
CREATE POLICY "drive_files_school_manage"
  ON public.school_drive_files
  FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_super_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_super_admin());
