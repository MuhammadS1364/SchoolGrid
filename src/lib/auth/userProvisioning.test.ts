import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProvisionableRole,
  validateProvisionUserInput,
  buildSchoolAndInfoPayloads,
  buildTeacherInsertPayload,
  buildStudentInsertPayload,
} from './userProvisioning';

describe('userProvisioning pure validation & ERD payload builders', () => {
  it('normalizes SuperAdmin, School, Teacher, and Student roles cleanly', () => {
    assert.equal(normalizeProvisionableRole('SuperAdmi'), 'SuperAdmin');
    assert.equal(normalizeProvisionableRole('super_admin'), 'SuperAdmin');
    assert.equal(normalizeProvisionableRole('School'), 'School');
    assert.equal(normalizeProvisionableRole('Teacher'), 'Teacher');
    assert.equal(normalizeProvisionableRole('Student'), 'Student');
    assert.throws(() => normalizeProvisionableRole('Guest'), /Invalid role/);
  });

  it('validates email, minimum 6-char password, and full name', () => {
    const valid = validateProvisionUserInput({
      email: ' Principal@School.edu ',
      password: 'secret-password',
      fullName: ' Dr. Alam ',
      role: 'School',
    });
    assert.equal(valid.email, 'principal@school.edu');
    assert.equal(valid.fullName, 'Dr. Alam');
    assert.equal(valid.role, 'School');

    assert.throws(
      () =>
        validateProvisionUserInput({
          email: 'bad-email',
          password: 'secret-password',
          fullName: 'Test',
          role: 'Teacher',
        }),
      /valid email/
    );

    assert.throws(
      () =>
        validateProvisionUserInput({
          email: 'teacher@school.edu',
          password: '123',
          fullName: 'Test',
          role: 'Teacher',
        }),
      /at least 6 characters/
    );
  });

  it('builds exact OurSchools and SchoolInfo payloads requiring user_uuid', () => {
    const { ourSchoolsRow, buildSchoolInfoRow } = buildSchoolAndInfoPayloads({
      school_title: 'Sunrise Academy',
      school_manager: 'Ms. Khan',
      user_uuid: 'auth-user-uuid-1',
      schoole_gmail: 'Sunrise@Gmail.com',
      logo_url: 'https://drive.google.com/uc?export=view&id=logo123',
      total_class: 12,
      primery_class_fee: 600,
      seconday_class_fee: 900,
      about_school: 'Modern K-12 campus',
      school_vission: 'Excellence for all',
      school_mission: 'Empower learners',
      is_computer_lab: true,
      is_library: true,
    });

    assert.equal(ourSchoolsRow.user_uuid, 'auth-user-uuid-1');
    assert.equal(ourSchoolsRow.schoole_gmail, 'sunrise@gmail.com');
    assert.equal(ourSchoolsRow.logo_url, 'https://drive.google.com/uc?export=view&id=logo123');
    assert.equal(ourSchoolsRow.is_approved, false);

    const info = buildSchoolInfoRow('school-uuid-99');
    assert.equal(info.school_id, 'school-uuid-99');
    assert.equal(info.total_class, 12);
    assert.equal(info.primery_class_fee, 600);
    assert.equal(info.seconday_class_fee, 900);
    assert.equal(info.school_vission, 'Excellence for all');
    assert.equal(info.school_mission, 'Empower learners');

    assert.throws(
      () =>
        buildSchoolAndInfoPayloads({
          school_title: 'No Auth School',
          user_uuid: '',
          schoole_gmail: 'a@b.com',
        }),
      /user_uuid/
    );
  });

  it('enforces required school_id and user_id on SchoolTeachers payload', () => {
    const payload = buildTeacherInsertPayload({
      school_id: 'school-1',
      user_id: 'auth-teacher-1',
      teacher_full_name: 'Aarav Verma',
      teacher_email: 'Aarav@School.edu',
      teacher_contact: '9876543210',
      monthly_wage: 28000,
    });
    assert.equal(payload.school_id, 'school-1');
    assert.equal(payload.user_id, 'auth-teacher-1');
    assert.equal(payload.teacher_email, 'aarav@school.edu');
    assert.equal(payload.monthly_wage, 28000);

    assert.throws(
      () =>
        buildTeacherInsertPayload({
          school_id: '',
          user_id: 'auth-teacher-1',
          teacher_full_name: 'Missing School',
          teacher_email: 'a@b.com',
        }),
      /school_id is required/
    );

    assert.throws(
      () =>
        buildTeacherInsertPayload({
          school_id: 'school-1',
          user_id: '',
          teacher_full_name: 'Missing Auth',
          teacher_email: 'a@b.com',
        }),
      /user_id/
    );
  });

  it('enforces required AddNo, school_id, and stn_user_id on StudentsBox payload', () => {
    const payload = buildStudentInsertPayload({
      AddNo: 'ADM-2026-009',
      school_id: 'school-1',
      stn_user_id: 'auth-student-1',
      StudentName: 'Zoya Siddiqui',
      StudentEmail: 'Zoya@School.edu',
      FatherName: 'Imran Siddiqui',
      StnState: 'UP',
      StnDistrict: 'Lucknow',
      Stn_Dob: '2012-08-14',
    });

    assert.equal(payload.AddNo, 'ADM-2026-009');
    assert.equal(payload.school_id, 'school-1');
    assert.equal(payload.stn_user_id, 'auth-student-1');
    assert.equal(payload.StudentEmail, 'zoya@school.edu');
    assert.equal(payload.Grand_Total_Points, 0);
    assert.equal(payload.IsActive, true);

    assert.throws(
      () =>
        buildStudentInsertPayload({
          AddNo: '',
          school_id: 'school-1',
          stn_user_id: 'auth-student-1',
          StudentName: 'No AddNo',
          StudentEmail: 'a@b.com',
        }),
      /AddNo/
    );

    assert.throws(
      () =>
        buildStudentInsertPayload({
          AddNo: 'ADM-1',
          school_id: '',
          stn_user_id: 'auth-student-1',
          StudentName: 'No School',
          StudentEmail: 'a@b.com',
        }),
      /school_id is required/
    );

    assert.throws(
      () =>
        buildStudentInsertPayload({
          AddNo: 'ADM-1',
          school_id: 'school-1',
          stn_user_id: '',
          StudentName: 'No Auth',
          StudentEmail: 'a@b.com',
        }),
      /stn_user_id/
    );
  });
});
