import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Database,
  ArrowRight,
  Package,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import SupaBaseClientFunction, {
  formatSupabaseError,
} from '../../lib/SupaBaseClient/SupaBaseClientFunction';
import type {
  SchoolRecord,
  SchoolTeacherRecord,
  SchoolUserProfileRecord,
  ServiceHolderRecord,
  ServicePlanRecord,
  StudentsBoxRecord,
} from '../../lib/SupaBaseClient/mockSupabase';
import { isMissingTableError, listAllSchoolRecords } from '../../lib/services/schoolDirectoryStore';
import {
  fetchTursoSchoolClasses,
  type TursoSchoolClass,
} from '../../lib/services/tursoSchoolData';
import { applyRealtimeChange, useRealtimeTables } from '../../lib/realtime/useRealtimeTable';

type Icon = ComponentType<{ className?: string }>;
type DbTab = 'schools' | 'users' | 'teachers' | 'students' | 'classes';

interface StatCardProps {
  title: string;
  value: string;
  caption: string;
  icon: Icon;
  tone?: 'default' | 'green' | 'orange' | 'blue' | 'purple';
}

interface ActivityItem {
  id: string;
  initials: string;
  avatarClass: string;
  content: ReactNode;
  createdAt: string;
  badge: { label: string; variant: 'primary' | 'muted' | 'outline' | 'amber' };
}

const TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-white border-slate-200',
  green: 'bg-emerald-50/60 border-emerald-200',
  orange: 'bg-amber-50/60 border-amber-200',
  blue: 'bg-blue-50/60 border-blue-200',
  purple: 'bg-violet-50/60 border-violet-200',
};

function StatCard({ title, value, caption, icon: IconComp, tone = 'default' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${TONES[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <IconComp className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Badge({
  variant,
  children,
}: {
  variant: ActivityItem['badge']['variant'];
  children: ReactNode;
}) {
  const styles = {
    primary: 'bg-indigo-600 text-white',
    muted: 'bg-slate-100 text-slate-700',
    outline: 'border border-slate-300 bg-white text-slate-700',
    amber: 'bg-amber-100 text-amber-800',
  } as const;
  return (
    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}

function getInitials(label: string | null | undefined, fallback: string): string {
  const cleaned = (label ?? '').trim();
  if (!cleaned) return fallback;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Recently';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard() {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [users, setUsers] = useState<SchoolUserProfileRecord[]>([]);
  const [plans, setPlans] = useState<ServicePlanRecord[]>([]);
  const [holders, setHolders] = useState<ServiceHolderRecord[]>([]);
  const [teachers, setTeachers] = useState<SchoolTeacherRecord[]>([]);
  const [students, setStudents] = useState<StudentsBoxRecord[]>([]);
  const [classes, setClasses] = useState<TursoSchoolClass[]>([]);
  const [activeDbTab, setActiveDbTab] = useState<DbTab>('schools');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    const supabase = SupaBaseClientFunction();
    try {
      const [
        schoolsRes,
        usersRes,
        plansRes,
        holdersRes,
        teachersRes,
        studentsRes,
        tursoClasses,
      ] = await Promise.all([
        supabase.from('OurSchools').select('*').order('created_at', { ascending: false }),
        supabase.from('school_user_info').select('*').order('created_at', { ascending: false }),
        supabase.from('OurServicesBook').select('*').order('service_charge', { ascending: true }),
        supabase.from('OurServiceHolder').select('*').order('created_at', { ascending: false }),
        listAllSchoolRecords<SchoolTeacherRecord>('SchoolTeachers'),
        listAllSchoolRecords<StudentsBoxRecord>('StudentsBox'),
        fetchTursoSchoolClasses({}),
      ]);

      if (schoolsRes.error && !isMissingTableError(schoolsRes.error)) throw schoolsRes.error;

      setSchools((schoolsRes.data as SchoolRecord[]) ?? []);
      setUsers(
        usersRes.error ? [] : ((usersRes.data as unknown as SchoolUserProfileRecord[]) ?? [])
      );
      setPlans(plansRes.error ? [] : ((plansRes.data as ServicePlanRecord[]) ?? []));
      setHolders(holdersRes.error ? [] : ((holdersRes.data as ServiceHolderRecord[]) ?? []));
      setTeachers(teachersRes.data);
      setStudents(studentsRes.data);
      setClasses(tursoClasses);
    } catch (err: unknown) {
      setError(formatSupabaseError(err, 'Failed to load full platform database metrics.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData(true);
  }, [loadDashboardData]);

  // Real-time subscriptions across core platform tables
  useRealtimeTables(
    'superadmin-dashboard-overview',
    [
      {
        table: 'OurSchools',
        onChange: (payload) =>
          setSchools((prev) => applyRealtimeChange<SchoolRecord>(prev, payload, 'school_id')),
      },
      {
        table: 'school_user_info',
        onChange: (payload) =>
          setUsers((prev) =>
            applyRealtimeChange<SchoolUserProfileRecord>(prev, payload, 'profile_uuid')
          ),
      },
      {
        table: 'OurServicesBook',
        onChange: (payload) =>
          setPlans((prev) =>
            applyRealtimeChange<ServicePlanRecord>(prev, payload, 'service_id', {
              sort: (a, b) => Number(a.service_charge ?? 0) - Number(b.service_charge ?? 0),
            })
          ),
      },
      {
        table: 'OurServiceHolder',
        onChange: (payload) =>
          setHolders((prev) =>
            applyRealtimeChange<ServiceHolderRecord>(prev, payload, 'holder_id')
          ),
      },
      {
        table: 'SchoolTeachers',
        onChange: (payload) =>
          setTeachers((prev) =>
            applyRealtimeChange<SchoolTeacherRecord>(prev, payload, 'teacher_id')
          ),
      },
      {
        table: 'StudentsBox',
        onChange: (payload) =>
          setStudents((prev) => applyRealtimeChange<StudentsBoxRecord>(prev, payload, 'AddNo')),
      },
    ],
    { onResync: () => void loadDashboardData(false) }
  );

  const schoolLookup = useMemo(
    () => new Map(schools.map((s) => [s.school_id, s])),
    [schools]
  );

  const metrics = useMemo(() => {
    const approvedSchools = schools.filter((s) => s.is_approved).length;
    const pendingSchools = schools.length - approvedSchools;
    const activePlans = plans.filter((p) => p.is_active !== false).length;
    const pendingHolders = holders.filter((h) => h.status === 'pending_approval').length;
    const activeUsers = users.filter((u) => u.is_active !== false).length;
    const activeStudents = students.filter((s) => s.IsActive !== false).length;
    const activeTeachers = teachers.filter((t) => t.is_active !== false).length;
    const totalClassSlots = classes.length;

    return {
      approvedSchools,
      pendingSchools,
      activePlans,
      pendingHolders,
      activeUsers,
      activeStudents,
      activeTeachers,
      totalClassSlots,
    };
  }, [schools, plans, holders, users, students, teachers, classes]);

  const primaryStats: StatCardProps[] = [
    {
      title: 'Registered Schools',
      value: schools.length.toLocaleString(),
      caption: `${metrics.approvedSchools} approved · ${metrics.pendingSchools} pending`,
      icon: Building2,
    },
    {
      title: 'Total Students (StudentsBox)',
      value: students.length.toLocaleString(),
      caption: `${metrics.activeStudents} active across all schools`,
      icon: Users,
    },
    {
      title: 'Teachers & Staff',
      value: teachers.length.toLocaleString(),
      caption: `${metrics.activeTeachers} active in SchoolTeachers`,
      icon: GraduationCap,
    },
    {
      title: 'Turso Classes',
      value: metrics.totalClassSlots.toLocaleString(),
      caption: 'Synced from Turso SchoolClasses',
      icon: BookOpen,
    },
  ];

  const secondaryStats: StatCardProps[] = [
    {
      title: 'Portal Users (school_user_info)',
      value: users.length.toLocaleString(),
      caption: `${metrics.activeUsers} active accounts across all roles`,
      icon: ShieldCheck,
      tone: 'blue',
    },
    {
      title: 'Approved Schools',
      value: metrics.approvedSchools.toLocaleString(),
      caption: 'Verified for School Dashboard',
      icon: CheckCircle2,
      tone: 'green',
    },
    {
      title: 'Pending Plan Approvals',
      value: metrics.pendingHolders.toLocaleString(),
      caption: `${holders.length} total service requests`,
      icon: Clock,
      tone: 'orange',
    },
    {
      title: 'Active Database Tables',
      value: '5 Core',
      caption: 'OurSchools · Users · Teachers · StudentsBox · Turso',
      icon: Database,
      tone: 'purple',
    },
  ];

  const stateChartData = useMemo(() => {
    const map = new Map<string, { state: string; approved: number; pending: number }>();
    schools.forEach((school) => {
      const stateName = school.loc_state?.trim() || 'Unspecified';
      const entry = map.get(stateName) ?? { state: stateName, approved: 0, pending: 0 };
      if (school.is_approved) {
        entry.approved += 1;
      } else {
        entry.pending += 1;
      }
      map.set(stateName, entry);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.approved + b.pending - (a.approved + a.pending)
    );
  }, [schools]);

  const recentActivities = useMemo<ActivityItem[]>(() => {
    const planLookup = new Map(plans.map((p) => [p.service_id, p.service_title]));
    const items: ActivityItem[] = [];

    holders.slice(0, 4).forEach((h) => {
      const planName = (h.service_id && planLookup.get(h.service_id)) || 'Service Plan';
      const statusLabel =
        h.status === 'pending_approval'
          ? 'Pending'
          : h.status === 'approved'
            ? 'Approved'
            : h.status === 'school_registered'
              ? 'Onboarded'
              : h.status || 'Updated';
      items.push({
        id: `holder-${h.holder_id}`,
        initials: getInitials(h.holder_fullname, 'SH'),
        avatarClass: 'bg-amber-600',
        content: (
          <>
            <span className="font-medium text-slate-900">
              {h.holder_fullname || h.holder_email || 'Applicant'}
            </span>{' '}
            <span className="text-slate-500">requested</span>{' '}
            <span className="font-medium text-slate-900">{planName}</span>
          </>
        ),
        createdAt: h.created_at,
        badge: {
          label: statusLabel,
          variant: h.status === 'pending_approval' ? 'amber' : 'primary',
        },
      });
    });

    schools.slice(0, 6).forEach((s) => {
      items.push({
        id: `school-${s.school_id}`,
        initials: getInitials(s.school_title, 'SC'),
        avatarClass: 'bg-indigo-600',
        content: (
          <>
            <span className="font-medium text-slate-900">{s.school_title || 'Untitled School'}</span>{' '}
            <span className="text-slate-500">registered in</span>{' '}
            <span className="font-medium text-slate-900">
              {[s.loc_district, s.loc_state].filter(Boolean).join(', ') || 'SchoolGrid'}
            </span>
          </>
        ),
        createdAt: s.created_at,
        badge: {
          label: s.is_approved ? 'Approved' : 'Review',
          variant: s.is_approved ? 'muted' : 'outline',
        },
      });
    });

    teachers.slice(0, 4).forEach((t) => {
      items.push({
        id: `teacher-${t.teacher_id}`,
        initials: getInitials(t.teacher_full_name || t.full_name, 'TR'),
        avatarClass: 'bg-emerald-600',
        content: (
          <>
            <span className="font-medium text-slate-900">
              {t.teacher_full_name || t.full_name}
            </span>{' '}
            <span className="text-slate-500">joined</span>{' '}
            <span className="font-medium text-slate-900">
              {schoolLookup.get(t.school_id)?.school_title || t.school_id}
            </span>
          </>
        ),
        createdAt: t.created_at,
        badge: { label: 'Teacher', variant: 'muted' },
      });
    });

    return items
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, 6);
  }, [holders, schools, teachers, plans, schoolLookup]);

  return (
    <div className="min-h-full bg-slate-50/40">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              SuperAdmin Full Database
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Platform-wide governance across all schools, users, teachers, StudentsBox records, and
              Turso classes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/super-admin-dashboard/services"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Package className="h-3.5 w-3.5" />
              Plans &amp; Approvals
            </Link>
            <Link
              to="/super-admin-dashboard/schools"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Manage Schools
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500">Loading full database metrics...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {primaryStats.map((s) => (
                <StatCard key={s.title} {...s} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {secondaryStats.map((s) => (
                <StatCard key={s.title} {...s} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-900">
                    Schools by State &amp; Approval Status
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Live distribution from OurSchools grouped by state
                  </p>

                  {stateChartData.length === 0 ? (
                    <div className="mt-6 flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                      No schools registered yet. New schools appear here automatically.
                    </div>
                  ) : (
                    <div className="mt-6 h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stateChartData}
                          margin={{ top: 8, right: 16, bottom: 0, left: -12 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="state"
                            tick={{ fontSize: 11, fill: '#475569' }}
                            axisLine={{ stroke: '#94a3b8' }}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            axisLine={{ stroke: '#94a3b8' }}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              fontSize: 12,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
                          <Bar
                            dataKey="approved"
                            name="Approved Schools"
                            fill="#4f46e5"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="pending"
                            name="Pending Approval"
                            fill="#f59e0b"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>
              </div>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Live updates across schools, teachers, and service holders
                </p>

                {recentActivities.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-500">No activity recorded yet.</p>
                ) : (
                  <ul className="mt-6 space-y-5">
                    {recentActivities.map((a) => (
                      <li key={a.id} className="flex items-start gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${a.avatarClass}`}
                        >
                          {a.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug">{a.content}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatTimestamp(a.createdAt)}
                          </p>
                        </div>
                        <Badge variant={a.badge.variant}>{a.badge.label}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Full Platform Database Explorer (All Tables) */}
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Full Database Explorer</h2>
                  <p className="text-xs text-slate-500">
                    SuperAdmin view across every table in Supabase &amp; Turso
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'schools', label: `OurSchools (${schools.length})` },
                      { id: 'users', label: `school_user_info (${users.length})` },
                      { id: 'teachers', label: `SchoolTeachers (${teachers.length})` },
                      { id: 'students', label: `StudentsBox (${students.length})` },
                      { id: 'classes', label: `Turso Classes (${classes.length})` },
                    ] as Array<{ id: DbTab; label: string }>
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDbTab(tab.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        activeDbTab === tab.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                {activeDbTab === 'schools' && (
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-3">School Title</th>
                        <th className="px-4 py-3">Manager</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schools.map((s) => (
                        <tr key={s.school_id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {s.school_title}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{s.school_manager || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{s.schoole_gmail || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {[s.loc_district, s.loc_state].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            <span className={s.is_approved ? 'text-emerald-700' : 'text-amber-700'}>
                              {s.is_approved ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeDbTab === 'users' && (
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Full Name</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Auth User UUID</th>
                        <th className="px-4 py-3">Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.profile_uuid} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {u.full_name || '—'}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-indigo-700">
                            {u.user_role || '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            {u.user_uuid || '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            <span
                              className={
                                u.is_active !== false ? 'text-emerald-700' : 'text-rose-600'
                              }
                            >
                              {u.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeDbTab === 'teachers' && (
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Teacher</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">School</th>
                        <th className="px-4 py-3">Auth User ID</th>
                        <th className="px-4 py-3 text-right">Wage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers.map((t) => (
                        <tr key={t.teacher_id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {t.teacher_full_name || t.full_name}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {t.teacher_email || t.email || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {schoolLookup.get(t.school_id)?.school_title || t.school_id}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {t.user_id ? `${t.user_id.slice(0, 12)}...` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                            ₹{Number(t.monthly_wage ?? 5500).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeDbTab === 'students' && (
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-3">AddNo</th>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">School</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3 text-right">Grand Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((st) => (
                        <tr key={st.AddNo} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-mono font-semibold text-indigo-700">
                            {st.AddNo}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{st.StudentName || '—'}</p>
                            <p className="text-[11px] text-slate-500">{st.StudentEmail || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {(st.school_id && schoolLookup.get(st.school_id)?.school_title) ||
                              st.school_id ||
                              '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {[st.StnDistrict, st.StnState].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {st.Grand_Total_Points ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeDbTab === 'classes' && (
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Class Title</th>
                        <th className="px-4 py-3">Sub Title</th>
                        <th className="px-4 py-3">School</th>
                        <th className="px-4 py-3 text-right">Students</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            No classes stored in Turso SchoolClasses yet.
                          </td>
                        </tr>
                      ) : (
                        classes.map((c) => (
                          <tr key={c.class_id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {c.class_title}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">{c.sub_title}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {(c.school_id && schoolLookup.get(c.school_id)?.school_title) ||
                                c.school_id ||
                                '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                              {c.total_students}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              <span
                                className={
                                  c.is_active === 1 ? 'text-emerald-700' : 'text-slate-400'
                                }
                              >
                                {c.is_active === 1 ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}