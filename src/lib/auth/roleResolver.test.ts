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

test('resolveUserRoleAccess resolves school_id & entity IDs from school_user_info -> SchoolTeachers / StudentsBox', async () => {
  const mockClient = createMockSupabaseClient(DEFAULT_SCHOOLS) as unknown as SupabaseClient;

  // Insert teacher in school_user_info + SchoolTeachers
  const teacherAuthId = '00000000-0000-4000-8000-000000000777';
  await mockClient.from('school_user_info').insert([
    {
      user_uuid: teacherAuthId,
      full_name: 'Prof. Imran Khan',
      user_role: 'Teacher',
      is_active: true,
    },
  ]);
  await mockClient.from('SchoolTeachers').insert([
    {
      teacher_id: 'tch-777',
      teacher_full_name: 'Prof. Imran Khan',
      teacher_email: 'imran@greenwood.edu',
      school_id: 'sch-101',
      user_id: teacherAuthId,
      class_id: 'cls-101',
      is_active: true,
    },
  ]);

  const teacherAccess = await resolveUserRoleAccess(teacherAuthId, undefined, undefined, 'imran@gmail.com', mockClient);
  assert.equal(teacherAccess.role, ROLES.TEACHER);
  assert.equal(teacherAccess.dashboardPath, '/teacher-dashboard');
  assert.equal(teacherAccess.schoolId, 'sch-101');
  assert.equal(teacherAccess.teacherId, 'tch-777');
  assert.equal(teacherAccess.classId, 'cls-101');

  // Insert student in school_user_info + StudentsBox
  const studentAuthId = '00000000-0000-4000-8000-000000000888';
  await mockClient.from('school_user_info').insert([
    {
      user_uuid: studentAuthId,
      full_name: 'Ayesha Rahman',
      user_role: 'Student',
      is_active: true,
    },
  ]);
  await mockClient.from('StudentsBox').insert([
    {
      AddNo: 'ADM-2026-888',
      StudentName: 'Ayesha Rahman',
      StudentEmail: 'ayesha@greenwood.edu',
      school_id: 'sch-101',
      stn_user_id: studentAuthId,
      Stn_Class: 'cls-102',
      IsActive: true,
    },
  ]);

  const studentAccess = await resolveUserRoleAccess(studentAuthId, undefined, undefined, 'ayesha@gmail.com', mockClient);
  assert.equal(studentAccess.userId, studentAuthId);
  assert.equal(studentAccess.role, ROLES.STUDENT);
  assert.equal(studentAccess.dashboardPath, '/student-dashboard');
  assert.equal(studentAccess.schoolId, 'sch-101');
  assert.equal(studentAccess.studentAddNo, 'ADM-2026-888');
  assert.equal(studentAccess.classId, 'cls-102');
});

test('normalizeRole & canAccessDashboard enforce strict role boundaries including Wing role', async () => {
  const { canAccessDashboard } = await import('./roleResolver');
  assert.equal(normalizeRole('Wing'), ROLES.WING);
  assert.equal(normalizeRole('wing_manager'), ROLES.WING);
  assert.equal(normalizeRole('coordinator'), ROLES.WING);
  assert.equal(getDashboardPathForRole(ROLES.WING), '/wing-dashboard');

  // SuperAdmin can access full platform database & inspect all areas
  assert.equal(canAccessDashboard('SuperAdmin', 'SuperAdmin'), true);
  assert.equal(canAccessDashboard('SuperAdmin', 'School'), true);
  assert.equal(canAccessDashboard('SuperAdmin', 'Wing'), true);

  // School is locked to School/Wing areas and CANNOT access SuperAdmin
  assert.equal(canAccessDashboard('School', 'SuperAdmin'), false);
  assert.equal(canAccessDashboard('School', 'School'), true);
  assert.equal(canAccessDashboard('School', 'Teacher'), false);

  // Wing, Teacher, Student CANNOT access SuperAdmin or School Admin dashboard
  assert.equal(canAccessDashboard('Wing', 'SuperAdmin'), false);
  assert.equal(canAccessDashboard('Wing', 'School'), false);
  assert.equal(canAccessDashboard('Wing', 'Wing'), true);
  assert.equal(canAccessDashboard('Teacher', 'SuperAdmin'), false);
  assert.equal(canAccessDashboard('Teacher', 'School'), false);
  assert.equal(canAccessDashboard('Teacher', 'Teacher'), true);
  assert.equal(canAccessDashboard('Student', 'SuperAdmin'), false);
  assert.equal(canAccessDashboard('Student', 'School'), false);
  assert.equal(canAccessDashboard('Student', 'Student'), true);
});

test('resolveUserRoleAccess picks userId and linked school_id for Wing/email-matched school members', async () => {
  const mockClient = createMockSupabaseClient(DEFAULT_SCHOOLS) as unknown as SupabaseClient;
  const wingAuthId = '00000000-0000-4000-8000-000000000555';
  await mockClient.from('school_user_info').insert([
    {
      user_uuid: wingAuthId,
      full_name: 'Science Wing Head',
      user_role: 'Wing',
      is_active: true,
    },
  ]);

  const wingAccess = await resolveUserRoleAccess(
    wingAuthId,
    undefined,
    undefined,
    'teacher.sarah@greenwood.edu',
    mockClient
  );
  assert.equal(wingAccess.userId, wingAuthId);
  assert.equal(wingAccess.role, ROLES.WING);
  assert.equal(wingAccess.dashboardPath, '/wing-dashboard');
  assert.equal(wingAccess.schoolId, 'sch-101');
});

