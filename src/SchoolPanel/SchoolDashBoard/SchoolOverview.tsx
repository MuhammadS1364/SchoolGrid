import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { listSchoolRecords } from '../../lib/services/schoolDirectoryStore';
import { useRealtimeTables } from '../../lib/realtime/useRealtimeTable';
import { useActiveSchool } from '../SchoolContext';

export default function SchoolOverview() {
  const { school } = useActiveSchool();
  const [counts, setCounts] = useState({ teachers: 0, students: 0, classes: 0 });

  const loadCounts = useCallback(async () => {
    if (!school) return;
    const [t, s, c] = await Promise.all([
      listSchoolRecords('SchoolTeachers', school.school_id),
      listSchoolRecords('SchoolStudents', school.school_id),
      listSchoolRecords('SchoolClasses', school.school_id),
    ]);
    setCounts({
      teachers: t.data.length,
      students: s.data.length,
      classes: c.data.length,
    });
  }, [school]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useRealtimeTables(
    'school-overview-realtime',
    [
      {
        table: 'SchoolTeachers',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: () => void loadCounts(),
      },
      {
        table: 'SchoolStudents',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: () => void loadCounts(),
      },
      {
        table: 'SchoolClasses',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: () => void loadCounts(),
      },
    ],
    { enabled: Boolean(school), onResync: () => void loadCounts() }
  );

  if (!school) return null;

  const featureRows = [
    {
      name: 'Google Drive Sync',
      enabled: school.is_gdrive_allowed,
      detail: school.is_gdrive_allowed
        ? `Linked via ${school.schoole_gmail || 'school Gmail'}`
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            School Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage teachers, students, classes, and plan-enabled tools for {school.school_title}.
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
            {counts.teachers}
          </p>
          <p className="mt-1 text-xs text-slate-500">Manage faculty records</p>
        </Link>

        <Link
          to="/school-dashboard/students"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500">Students</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {counts.students}
          </p>
          <p className="mt-1 text-xs text-slate-500">Manage student roster</p>
        </Link>

        <Link
          to="/school-dashboard/classes"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500">Classes &amp; Wings</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {counts.classes} / {school.allowed_count_wing}
          </p>
          <p className="mt-1 text-xs text-slate-500">Allowed wing quota</p>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">Campus Facilities</p>
          <p className="mt-1.5 text-base font-bold text-slate-900">
            {school.is_computer_lab ? 'Computer Lab' : 'No Lab'} ·{' '}
            {school.is_library ? 'Library' : 'No Library'}
          </p>
          <p className="mt-1 text-xs text-slate-500">{school.school_type || 'School'}</p>
        </div>
      </div>

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

        {/* Fee Structure & Institutional Details */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            Fee Structure &amp; Profile
          </h2>

          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Primary Fee</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                ₹{school.primery_fee} / month
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Secondary Fee</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                ₹{school.secondary_fee} / month
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Senior Secondary Fee</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                ₹{school.senior_secondary_fee} / month
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
    </div>
  );
}
