import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ROLES,
  getDashboardPathForRole,
  inferRoleFromEmail,
  isGmailAddress,
  normalizeRole,
  resolveUserRoleAccess,
} from './roleResolver';
import { createMockSupabaseClient, DEFAULT_SCHOOLS } from '../SupaBaseClient/mockSupabase';

test('isGmailAddress accurately separates Gmail from non-Gmail domains', () => {
  assert.equal(isGmailAddress('principal@gmail.com'), true);
  assert.equal(isGmailAddress('School.Admin@GMAIL.COM '), true);
  assert.equal(isGmailAddress('user@googlemail.com'), true);
  assert.equal(isGmailAddress('admin@schoolgrid.edu'), false);
  assert.equal(isGmailAddress('gmail@myschool.org'), false);
  assert.equal(isGmailAddress(''), false);
});

test('normalizeRole standardizes SuperAdmin, School, Teacher, and Student roles', () => {
  assert.equal(normalizeRole('SuperAdmin'), ROLES.SUPER_ADMIN);
  assert.equal(normalizeRole('super-admin'), ROLES.SUPER_ADMIN);
  assert.equal(normalizeRole('Admin'), ROLES.SUPER_ADMIN);
  assert.equal(normalizeRole('School'), ROLES.SCHOOL);
  assert.equal(normalizeRole('school_admin'), ROLES.SCHOOL);
  assert.equal(normalizeRole('principal'), ROLES.SCHOOL);
  assert.equal(normalizeRole('teacher'), ROLES.TEACHER);
  assert.equal(normalizeRole('student'), ROLES.STUDENT);
  assert.equal(normalizeRole(''), null);
});

test('inferRoleFromEmail routes emails to the right role', () => {
  assert.equal(inferRoleFromEmail('school@demo.edu'), ROLES.SCHOOL);
  assert.equal(inferRoleFromEmail('principal.sharma@academy.org'), ROLES.SCHOOL);
  assert.equal(inferRoleFromEmail('teacher.sarah@greenwood.edu'), ROLES.TEACHER);
  assert.equal(inferRoleFromEmail('student.aarav@greenwood.edu'), ROLES.STUDENT);
  assert.equal(inferRoleFromEmail('admin@schoolgrid.edu'), ROLES.SUPER_ADMIN);
});

test('resolveUserRoleAccess matches auth user UUID against public.school_user_profile for all 4 roles', async () => {
  const mockClient = createMockSupabaseClient(DEFAULT_SCHOOLS) as unknown as SupabaseClient;

  const superAdmin = await resolveUserRoleAccess(
    '00000000-0000-4000-8000-000000000001',
    'Student',
    undefined,
    'student@ignored.com',
    mockClient
  );
  assert.equal(superAdmin.role, ROLES.SUPER_ADMIN);
  assert.equal(superAdmin.dashboardPath, '/super-admin-dashboard');
  assert.equal(superAdmin.source, 'school_user_profile');

  const school = await resolveUserRoleAccess(
    '00000000-0000-4000-8000-000000000101',
    undefined,
    undefined,
    'random@gmail.com',
    mockClient
  );
  assert.equal(school.role, ROLES.SCHOOL);
  assert.equal(school.dashboardPath, '/school-dashboard');
  assert.equal(school.schoolId, 'sch-101');
  assert.equal(school.source, 'school_user_profile');

  const teacher = await resolveUserRoleAccess(
    '00000000-0000-4000-8000-000000000201',
    undefined,
    undefined,
    'random@gmail.com',
    mockClient
  );
  assert.equal(teacher.role, ROLES.TEACHER);
  assert.equal(teacher.dashboardPath, '/teacher-dashboard');
  assert.equal(teacher.schoolId, 'sch-101');
  assert.equal(teacher.source, 'school_user_profile');

  const student = await resolveUserRoleAccess(
    '00000000-0000-4000-8000-000000000301',
    undefined,
    undefined,
    'random@gmail.com',
    mockClient
  );
  assert.equal(student.role, ROLES.STUDENT);
  assert.equal(student.dashboardPath, '/student-dashboard');
  assert.equal(student.schoolId, 'sch-101');
  assert.equal(student.source, 'school_user_profile');
});

test('resolveUserRoleAccess blocks inactive school_user_profile accounts', async () => {
  const mockClient = createMockSupabaseClient(DEFAULT_SCHOOLS) as unknown as SupabaseClient;
  await mockClient
    .from('school_user_profile')
    .insert([
      {
        user_uuid: '00000000-0000-4000-8000-000000000999',
        full_name: 'Suspended Staff',
        school_id: 'sch-101',
        user_role: 'Teacher',
        is_active: false,
      },
    ])
    .select();

  await assert.rejects(
    () =>
      resolveUserRoleAccess(
        '00000000-0000-4000-8000-000000000999',
        undefined,
        undefined,
        'teacher@x.com',
        mockClient
      ),
    /currently inactive/
  );
});

test('resolveUserRoleAccess falls back cleanly when no profile row exists', async () => {
  const superAdmin = await resolveUserRoleAccess('u1', 'Student', 'SuperAdmin', 'school@x.com', null);
  assert.equal(superAdmin.role, ROLES.SUPER_ADMIN);
  assert.equal(superAdmin.dashboardPath, '/super-admin-dashboard');
  assert.equal(superAdmin.source, 'metadata');

  const teacher = await resolveUserRoleAccess('u3', undefined, undefined, 'teacher.ravi@x.edu', null);
  assert.equal(teacher.role, ROLES.TEACHER);
  assert.equal(getDashboardPathForRole(teacher.role), '/teacher-dashboard');
  assert.equal(teacher.source, 'email_fallback');
});
