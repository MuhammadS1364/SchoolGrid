-- ============================================================================
-- SchoolGrid — Supabase Row Level Security (RLS) Hardening Script
-- Run this in Supabase Dashboard -> SQL Editor to enforce database-level RLS
-- ============================================================================

-- 1. Helper: check if the authenticated user is an active SuperAdmin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_user_profile
    WHERE user_uuid = auth.uid()
      AND lower(role) IN ('superadmin', 'super_admin')
      AND is_active = true
  );
$$;

-- 2. Helper: resolve the authenticated user's active school_id
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id
  FROM public.school_user_profile
  WHERE user_uuid = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- 3. Enable RLS on all application tables
ALTER TABLE IF EXISTS public.school_user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."OurServicesBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."OurServiceHolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."OurSchools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SchoolClasses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SchoolTeachers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SchoolStudents" ENABLE ROW LEVEL SECURITY;

-- 4. school_user_profile: users read own profile; SuperAdmin manages all
DROP POLICY IF EXISTS "profile_select_own_or_superadmin" ON public.school_user_profile;
CREATE POLICY "profile_select_own_or_superadmin"
  ON public.school_user_profile
  FOR SELECT
  USING (user_uuid = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "profile_manage_superadmin" ON public.school_user_profile;
CREATE POLICY "profile_manage_superadmin"
  ON public.school_user_profile
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 5. OurServicesBook: public can read active plans; SuperAdmin manages plans
DROP POLICY IF EXISTS "services_public_read" ON public."OurServicesBook";
CREATE POLICY "services_public_read"
  ON public."OurServicesBook"
  FOR SELECT
  USING (is_active = true OR public.is_super_admin());

DROP POLICY IF EXISTS "services_superadmin_write" ON public."OurServicesBook";
CREATE POLICY "services_superadmin_write"
  ON public."OurServicesBook"
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 6. OurServiceHolder: public can submit purchase request; SuperAdmin reviews
DROP POLICY IF EXISTS "holder_public_insert" ON public."OurServiceHolder";
CREATE POLICY "holder_public_insert"
  ON public."OurServiceHolder"
  FOR INSERT
  WITH CHECK (status = 'pending_approval');

DROP POLICY IF EXISTS "holder_superadmin_all" ON public."OurServiceHolder";
CREATE POLICY "holder_superadmin_all"
  ON public."OurServiceHolder"
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 7. OurSchools: tenant isolation by school_id or SuperAdmin
DROP POLICY IF EXISTS "schools_tenant_select" ON public."OurSchools";
CREATE POLICY "schools_tenant_select"
  ON public."OurSchools"
  FOR SELECT
  USING (school_id = public.current_user_school_id() OR user_uuid = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "schools_superadmin_manage" ON public."OurSchools";
CREATE POLICY "schools_superadmin_manage"
  ON public."OurSchools"
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 8. SchoolClasses, SchoolTeachers, SchoolStudents: strict tenant isolation
DROP POLICY IF EXISTS "classes_tenant_isolation" ON public."SchoolClasses";
CREATE POLICY "classes_tenant_isolation"
  ON public."SchoolClasses"
  FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_super_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "teachers_tenant_isolation" ON public."SchoolTeachers";
CREATE POLICY "teachers_tenant_isolation"
  ON public."SchoolTeachers"
  FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_super_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "students_tenant_isolation" ON public."SchoolStudents";
CREATE POLICY "students_tenant_isolation"
  ON public."SchoolStudents"
  FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_super_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_super_admin());
