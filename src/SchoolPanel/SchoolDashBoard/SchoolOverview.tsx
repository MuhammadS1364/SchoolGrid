import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { listSchoolRecords } from '../../lib/services/schoolDirectoryStore';
import {
  fetchTursoSchoolClasses,
  type TursoSchoolClass,
} from '../../lib/services/tursoSchoolData';
import type {
  SchoolTeacherRecord,
  StudentsBoxRecord,
} from '../../lib/SupaBaseClient/mockSupabase';
import { useRealtimeTables } from '../../lib/realtime/useRealtimeTable';
import { useActiveSchool } from '../SchoolContext';

export default function SchoolOverview() {
  const { school, schoolInfo } = useActiveSchool();
  const [teachers, setTeachers] = useState<SchoolTeacherRecord[]>([]);
  const [students, setStudents] = useState<StudentsBoxRecord[]>([]);
  const [classes, setClasses] = useState<TursoSchoolClass[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);

  const loadSchoolData = useCallback(async () => {
    if (!school) return;
    setLoadingTables(true);
    try {
      const [tRes, sRes] = await Promise.all([
        listSchoolRecords<SchoolTeacherRecord>('SchoolTeachers', school.school_id),
        listSchoolRecords<StudentsBoxRecord>('StudentsBox', school.school_id),
      ]);
      const teacherIds = tRes.data.map((t) => t.teacher_id).filter(Boolean);
      const tursoClasses = await fetchTursoSchoolClasses({
        schoolId: school.school_id,
        teacherIds,
      });
      setTeachers(tRes.data);
      setStudents(sRes.data);
      setClasses(tursoClasses);
    } finally {
      setLoadingTables(false);
    }
  }, [school]);

  useEffect(() => {
    void loadSchoolData();
  }, [loadSchoolData]);

  useRealtimeTables(
    'school-overview-realtime',
    [
      {
        table: 'SchoolTeachers',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: () => void loadSchoolData(),
      },
      {
        table: 'StudentsBox',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: () => void loadSchoolData(),
      },
    ],
    { enabled: Boolean(school), onResync: () => void loadSchoolData() }
  );

  if (!school) return null;

  const primaryFee = schoolInfo?.primery_class_fee ?? school.primery_fee ?? 550;
  const secondaryFee = schoolInfo?.seconday_class_fee ?? school.secondary_fee ?? 750;
  const totalClassesTarget = schoolInfo?.total_class ?? school.total_class ?? 5;
  const hasComputerLab =
    schoolInfo !== null ? schoolInfo.is_computer_lab === 1 : Boolean(school.is_computer_lab);
  const hasLibrary =
    schoolInfo !== null ? schoolInfo.is_library === 1 : Boolean(school.is_library);

  const teacherNameById = new Map(
    teachers.map((t) => [t.teacher_id, t.teacher_full_name || t.full_name || 'Faculty'])
  );

  const featureRows = [
    {
      name: 'Google Drive Sync',
      enabled: school.is_gdrive_allowed,
      detail: school.is_gdrive_allowed
        ? `Public link folder via ${school.schoole_gmail || 'school Gmail'}`
        : 'Disabled by SuperAdmin',
    },
    {
      name: 'Import / Export CSV',
      enabled: school.is_import_export_allowed,
      detail: school.is_import_export_allowed
        ? 'Bulk CSV import & export unlocked'
        : 'Disabled by SuperAdmin',
    },
    {
      name: 'Email Service',
      enabled: school.is_email_service,
      detail: school.is_email_service
        ? 'Broadcast announcements active'
        : 'Disabled by SuperAdmin',
    },
    {
      name: 'Collaboration Workspace',
      enabled: school.is_collaburation_allowed,
      detail: school.is_collaburation_allowed
        ? 'Cross-wing faculty notes enabled'
        : 'Disabled by SuperAdmin',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">School Overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete school profile, teachers, students, and Turso classes scoped strictly to{' '}
            {school.school_title}.
          </p>
        </div>

        <Link
          to="/school-dashboard/features"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
        >
          Open Feature Workspace
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/school-dashboard/teachers"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500">Teachers</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {teachers.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Supabase · SchoolTeachers</p>
        </Link>

        <Link
          to="/school-dashboard/students"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500">Students</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {students.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Supabase · StudentsBox</p>
        </Link>

        <Link
          to="/school-dashboard/classes"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500">Classes</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {classes.length} / {totalClassesTarget}
          </p>
          <p className="mt-1 text-xs text-slate-500">Turso · SchoolClasses</p>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">Campus Facilities</p>
          <p className="mt-1.5 text-base font-bold text-slate-900">
            {hasComputerLab ? 'Computer Lab' : 'No Lab'} · {hasLibrary ? 'Library' : 'No Library'}
          </p>
          <p className="mt-1 text-xs text-slate-500">Turso · SchoolInfo</p>
        </div>
      </div>

      {/* About, Vision & Mission from Turso SchoolInfo */}
      {(schoolInfo?.about_school || schoolInfo?.school_vission || schoolInfo?.school_mission) && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {schoolInfo.about_school && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-500">About School</p>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                {schoolInfo.about_school}
              </p>
            </div>
          )}
          {schoolInfo.school_vission && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-500">Vision</p>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                {schoolInfo.school_vission}
              </p>
            </div>
          )}
          {schoolInfo.school_mission && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-500">Mission</p>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                {schoolInfo.school_mission}
              </p>
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Read-Only Plan Entitlements */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Plan Feature Entitlements</h2>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Read-only (SuperAdmin only)
            </span>
          </div>

          <ul className="mt-4 divide-y divide-slate-100">
            {featureRows.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.detail}</p>
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    row.enabled ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {row.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Fee Structure & Institutional Details (OurSchools + Turso SchoolInfo) */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            Fee Structure &amp; Profile
          </h2>

          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Primary Class Fee</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                ₹{primaryFee} / month
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Secondary Class Fee</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                ₹{secondaryFee} / month
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Total Classes (SchoolInfo)</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {totalClassesTarget}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">School Account Email</dt>
              <dd className="font-medium text-slate-900">{school.schoole_gmail || '—'}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Address</dt>
              <dd className="max-w-[60%] truncate text-right text-slate-700">
                {school.local_address ||
                  [school.loc_city_village, school.loc_district, school.loc_state]
                    .filter(Boolean)
                    .join(', ') ||
                  '—'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Full School Data Tables (Strictly Scoped to This School's school_id) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Teachers Table */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              Teachers ({teachers.length})
            </h2>
            <Link
              to="/school-dashboard/teachers"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Manage All
            </Link>
          </div>
          {loadingTables ? (
            <div className="p-5 text-xs text-slate-500">Loading teachers...</div>
          ) : teachers.length === 0 ? (
            <div className="p-5 text-xs text-slate-500">No teachers registered for this school yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Wage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachers.slice(0, 6).map((t) => (
                    <tr key={t.teacher_id}>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {t.teacher_full_name || t.full_name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {t.teacher_email || t.email || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                        ₹{Number(t.monthly_wage ?? 5500).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Turso SchoolClasses Table */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              Classes &amp; Units ({classes.length})
            </h2>
            <Link
              to="/school-dashboard/classes"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Manage All
            </Link>
          </div>
          {loadingTables ? (
            <div className="p-5 text-xs text-slate-500">Loading classes...</div>
          ) : classes.length === 0 ? (
            <div className="p-5 text-xs text-slate-500">No classes created in Turso yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Class</th>
                    <th className="px-4 py-2.5 font-semibold">Teacher</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.slice(0, 6).map((c) => (
                    <tr key={c.class_id}>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {c.class_title} ({c.sub_title})
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {(c.class_teacher_id && teacherNameById.get(c.class_teacher_id)) || 'Unassigned'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                        {c.total_students}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Students Table from Supabase StudentsBox */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">
            Enrolled Students ({students.length})
          </h2>
          <Link
            to="/school-dashboard/students"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Manage All
          </Link>
        </div>
        {loadingTables ? (
          <div className="p-5 text-xs text-slate-500">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="p-5 text-xs text-slate-500">
            No students enrolled in StudentsBox for this school yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">AddNo</th>
                  <th className="px-4 py-2.5 font-semibold">Student Name</th>
                  <th className="px-4 py-2.5 font-semibold">Father Name</th>
                  <th className="px-4 py-2.5 font-semibold">District</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Grand Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.slice(0, 8).map((st) => (
                  <tr key={st.AddNo}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-indigo-700">
                      {st.AddNo}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {st.StudentName || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{st.FatherName || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{st.StnDistrict || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {st.Grand_Total_Points ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
