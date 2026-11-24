import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Layers,
  LogOut,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react';
import SupaBaseClientFunction, {
  isUsingMockSupabase,
} from '../lib/SupaBaseClient/SupaBaseClientFunction';
import type {
  SchoolRecord,
  SchoolTeacherRecord,
  StudentsBoxRecord,
} from '../lib/SupaBaseClient/mockSupabase';
import { useAuth } from '../lib/auth/AuthContext';
import { canAccessDashboard } from '../lib/auth/roleResolver';
import { isSafeHttpUrl } from '../lib/GooglDrive/GoogleDrive';
import {
  fetchTursoSchoolClasses,
  fetchTursoSchoolInfo,
  type TursoSchoolClass,
  type TursoSchoolInfo,
} from '../lib/services/tursoSchoolData';

interface RolePortalPageProps {
  role: 'Wing' | 'Teacher' | 'Student';
}

export default function RolePortalPage({ role }: RolePortalPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    userId,
    role: activeRole,
    dashboardPath,
    schoolId: authSchoolId,
    fullName: authFullName,
    loading: authLoading,
    signOut,
  } = useAuth();
  const isSandboxPreview = searchParams.get('sandbox') === '1' || isUsingMockSupabase();

  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<TursoSchoolInfo | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<SchoolTeacherRecord | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentsBoxRecord | null>(null);
  const [classes, setClasses] = useState<TursoSchoolClass[]>([]);
  const [schoolTeachers, setSchoolTeachers] = useState<SchoolTeacherRecord[]>([]);
  const [schoolStudents, setSchoolStudents] = useState<StudentsBoxRecord[]>([]);

  const loadRoleDashboard = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      const supabase = SupaBaseClientFunction();
      let resolvedSchoolId: string | null = authSchoolId ?? null;
      let myTeacher: SchoolTeacherRecord | null = null;
      let myStudent: StudentsBoxRecord | null = null;

      // 1. Resolve role-specific row & school_id using auth.users.id (userId)
      if (role === 'Teacher') {
        if (userId) {
          const { data } = await supabase
            .from('SchoolTeachers')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          myTeacher = (data as SchoolTeacherRecord | null) ?? null;
        }
        if (!myTeacher && !userId) {
          const { data } = await supabase.from('SchoolTeachers').select('*').limit(1);
          myTeacher = (data?.[0] as SchoolTeacherRecord | undefined) ?? null;
        }
        setTeacherProfile(myTeacher);
        resolvedSchoolId = resolvedSchoolId ?? myTeacher?.school_id ?? null;
      } else if (role === 'Student') {
        if (userId) {
          const { data } = await supabase
            .from('StudentsBox')
            .select('*')
            .eq('stn_user_id', userId)
            .maybeSingle();
          myStudent = (data as StudentsBoxRecord | null) ?? null;
        }
        if (!myStudent && !userId) {
          const { data } = await supabase.from('StudentsBox').select('*').limit(1);
          myStudent = (data?.[0] as StudentsBoxRecord | undefined) ?? null;
        }
        setStudentProfile(myStudent);
        resolvedSchoolId = resolvedSchoolId ?? myStudent?.school_id ?? null;
      } else {
        // Wing coordinator / staff member — pick linked school_id (or sandbox fallback)
        if (!resolvedSchoolId && userId) {
          const { data: tch } = await supabase
            .from('SchoolTeachers')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          if (tch) {
            myTeacher = tch as SchoolTeacherRecord;
            resolvedSchoolId = myTeacher.school_id ?? null;
          }
        }
        if (!resolvedSchoolId && !userId) {
          const { data } = await supabase.from('OurSchools').select('school_id').limit(1);
          resolvedSchoolId = (data?.[0] as { school_id?: string } | undefined)?.school_id ?? null;
        }
        setTeacherProfile(myTeacher);
      }

      // 2. Load the linked school from Supabase OurSchools + Turso SchoolInfo
      if (resolvedSchoolId) {
        const [{ data: schData }, tursoInfo] = await Promise.all([
          supabase.from('OurSchools').select('*').eq('school_id', resolvedSchoolId).maybeSingle(),
          fetchTursoSchoolInfo(resolvedSchoolId),
        ]);
        setSchool((schData as SchoolRecord | null) ?? null);
        setSchoolInfo(tursoInfo);

        // 3. Load role-scoped data for THIS school_id
        if (role === 'Teacher' || role === 'Wing') {
          const [teachersRes, studentsRes] = await Promise.all([
            supabase.from('SchoolTeachers').select('*').eq('school_id', resolvedSchoolId),
            supabase.from('StudentsBox').select('*').eq('school_id', resolvedSchoolId),
          ]);
          const loadedTeachers = (teachersRes.data as SchoolTeacherRecord[]) || [];
          const teacherIds =
            role === 'Teacher' && myTeacher?.teacher_id
              ? [myTeacher.teacher_id]
              : loadedTeachers.map((t) => t.teacher_id).filter(Boolean);

          const tursoClasses = await fetchTursoSchoolClasses({
            schoolId: resolvedSchoolId,
            teacherIds,
          });
          setSchoolTeachers(loadedTeachers);
          setSchoolStudents((studentsRes.data as StudentsBoxRecord[]) || []);
          setClasses(tursoClasses);
        } else {
          const tursoClasses = await fetchTursoSchoolClasses({
            schoolId: resolvedSchoolId,
            classId: myStudent?.Stn_Class ?? undefined,
          });
          setSchoolTeachers([]);
          setSchoolStudents([]);
          setClasses(tursoClasses);
        }
      } else {
        setSchool(null);
        setSchoolInfo(null);
        setClasses([]);
        setSchoolTeachers([]);
        setSchoolStudents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, authSchoolId, role, userId]);

  useEffect(() => {
    void loadRoleDashboard();
  }, [loadRoleDashboard]);

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
        Verifying session...
      </div>
    );
  }

  if (user && !canAccessDashboard(activeRole, role)) {
    return <Navigate to={dashboardPath} replace />;
  }

  if (!user && !isSandboxPreview) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const displayName =
    role === 'Teacher'
      ? teacherProfile?.teacher_full_name || teacherProfile?.full_name || authFullName || 'Teacher'
      : role === 'Student'
        ? studentProfile?.StudentName || authFullName || 'Student'
        : authFullName || teacherProfile?.teacher_full_name || 'Wing Coordinator';

  const displayEmail =
    role === 'Teacher'
      ? teacherProfile?.teacher_email || user?.email || ''
      : role === 'Student'
        ? studentProfile?.StudentEmail || user?.email || ''
        : user?.email || teacherProfile?.teacher_email || '';

  const avatarUrl =
    role === 'Teacher' || role === 'Wing'
      ? teacherProfile?.teacher_img
      : studentProfile?.Student_Photo_Urls;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SchoolGrid
          </Link>

          <div className="hidden md:flex items-center gap-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{role} Portal</span>
            {school && (
              <>
                <span className="text-slate-300">·</span>
                <span className="truncate max-w-[280px]">{school.school_title}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Identity Header */}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {avatarUrl && isSafeHttpUrl(avatarUrl) ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-14 w-14 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-bold text-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{displayName}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {role} Dashboard {displayEmail ? `· ${displayEmail}` : ''}
                {role === 'Student' && studentProfile?.AddNo
                  ? ` · Admission No: ${studentProfile.AddNo}`
                  : ''}
              </p>
            </div>
          </div>

          {school && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
              {school.logo_url && isSafeHttpUrl(school.logo_url) ? (
                <img
                  src={school.logo_url}
                  alt={school.school_title}
                  className="h-9 w-9 rounded-md border border-slate-200 object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5 text-indigo-600" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {school.school_title}
                </p>
                <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {[school.loc_city_village, school.loc_district, school.loc_state]
                    .filter(Boolean)
                    .join(', ') || school.school_type || 'Active Campus'}
                </p>
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading your {role.toLowerCase()} dashboard &amp; linked school records...
          </div>
        ) : !school ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
            <h2 className="text-base font-bold text-slate-900">No School Linked Yet</h2>
            <p className="text-sm text-slate-500">
              Your account ({displayEmail || 'authenticated user'}) was verified in{' '}
              <code className="font-mono">school_user_info</code>, but no linked{' '}
              <code className="font-mono">school_id</code> was found in your school tables. Ask your
              School Administrator to link your account.
            </p>
          </div>
        ) : role === 'Teacher' || role === 'Wing' ? (
          <>
            {/* Teacher / Wing KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  School Classes (Turso)
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {classes.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Users className="h-4 w-4 text-indigo-600" />
                  School Students
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {schoolStudents.length}
                </p>
              </div>

              {role === 'Wing' ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <GraduationCap className="h-4 w-4 text-indigo-600" />
                      School Faculty
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {schoolTeachers.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      Campus Facilities
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-900">
                      {schoolInfo?.is_computer_lab === 1 ? 'Computer Lab' : 'No Lab'} ·{' '}
                      {schoolInfo?.is_library === 1 ? 'Library' : 'No Library'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <GraduationCap className="h-4 w-4 text-indigo-600" />
                      Monthly Wage
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      ₹{Number(teacherProfile?.monthly_wage ?? 5500).toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <CalendarDays className="h-4 w-4 text-indigo-600" />
                      Joined On
                    </div>
                    <p className="mt-2 font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {teacherProfile?.joined_at || '—'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Assigned Classes from Turso SchoolClasses */}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-bold text-slate-900">
                Classes &amp; Units ({school.school_title})
              </h2>
              {classes.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No classes assigned in Turso <code className="font-mono">SchoolClasses</code> yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="py-2.5 pr-4">Class Title</th>
                        <th className="py-2.5 pr-4">Sub Title</th>
                        <th className="py-2.5 pr-4">Assignment</th>
                        <th className="py-2.5 text-right">Students</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classes.map((cls) => {
                        const isMyClass =
                          (teacherProfile?.teacher_id &&
                            cls.class_teacher_id === teacherProfile.teacher_id) ||
                          (teacherProfile?.class_id && cls.class_id === teacherProfile.class_id);
                        return (
                          <tr key={cls.class_id}>
                            <td className="py-3 pr-4 font-semibold text-slate-900">
                              {cls.class_title}
                            </td>
                            <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                              {cls.sub_title || 'U1'}
                            </td>
                            <td className="py-3 pr-4">
                              {isMyClass ? (
                                <span className="text-xs font-semibold text-emerald-700">
                                  Class Teacher
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">School Class</span>
                              )}
                            </td>
                            <td className="py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                              {cls.total_students}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* School Students from Supabase StudentsBox */}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-bold text-slate-900">
                Students in {school.school_title}
              </h2>
              {schoolStudents.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No students enrolled in <code className="font-mono">StudentsBox</code> for this
                  school yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="py-2.5 pr-4">AddNo</th>
                        <th className="py-2.5 pr-4">Student Name</th>
                        <th className="py-2.5 pr-4">Father Name</th>
                        <th className="py-2.5 pr-4">District</th>
                        <th className="py-2.5 text-right">Grand Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schoolStudents.map((stu) => (
                        <tr key={stu.AddNo}>
                          <td className="py-3 pr-4 font-mono text-xs font-semibold text-indigo-700">
                            {stu.AddNo}
                          </td>
                          <td className="py-3 pr-4 font-semibold text-slate-900">
                            {stu.StudentName}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{stu.FatherName || '—'}</td>
                          <td className="py-3 pr-4 text-slate-600">{stu.StnDistrict || '—'}</td>
                          <td className="py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {stu.Grand_Total_Points ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {/* Student Scorecard KPIs from Supabase StudentsBox */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Trophy className="h-4 w-4 text-indigo-600" />
                  Grand Total Points
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {studentProfile?.Grand_Total_Points ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Award className="h-4 w-4 text-indigo-600" />
                  Achievements ({studentProfile?.Achievements_Counts ?? 0})
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {studentProfile?.Achievements_Points ?? 0} pts
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Users className="h-4 w-4 text-indigo-600" />
                  Outreach ({studentProfile?.OutReach_Count ?? 0})
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {studentProfile?.OutReach_Points ?? 0} pts
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <CalendarDays className="h-4 w-4 text-indigo-600" />
                  Programmes
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {studentProfile?.Resluted_Count ?? 0} / {studentProfile?.Registration_Count ?? 0}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Resulted / Registered</p>
              </div>
            </div>

            {/* Student Personal & School Info */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
                  Student Profile
                </h2>
                <dl className="mt-4 divide-y divide-slate-100 text-sm">
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">Admission No (AddNo)</dt>
                    <dd className="font-mono font-semibold text-slate-900">
                      {studentProfile?.AddNo || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">Father&apos;s Name</dt>
                    <dd className="font-medium text-slate-900">
                      {studentProfile?.FatherName || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">Date of Birth</dt>
                    <dd className="font-mono text-slate-900">{studentProfile?.Stn_Dob || '—'}</dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">District / State</dt>
                    <dd className="text-slate-900">
                      {[studentProfile?.StnDistrict, studentProfile?.StnState]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">Assigned Class (Turso)</dt>
                    <dd className="font-medium text-slate-900">
                      {classes[0]
                        ? `${classes[0].class_title} (${classes[0].sub_title})`
                        : studentProfile?.Stn_Class || 'Not assigned yet'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
                  My School Details (Turso SchoolInfo)
                </h2>
                <dl className="mt-4 divide-y divide-slate-100 text-sm">
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">School</dt>
                    <dd className="font-semibold text-slate-900">{school.school_title}</dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">Manager / Principal</dt>
                    <dd className="text-slate-900">{school.school_manager || '—'}</dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-slate-500">Facilities</dt>
                    <dd className="text-slate-900">
                      {schoolInfo?.is_computer_lab === 1 ? 'Computer Lab' : 'No Lab'} ·{' '}
                      {schoolInfo?.is_library === 1 ? 'Library' : 'No Library'}
                    </dd>
                  </div>
                  {schoolInfo?.school_vission && (
                    <div className="py-2.5">
                      <dt className="text-xs font-semibold text-slate-500">Vision</dt>
                      <dd className="mt-1 text-slate-700">{schoolInfo.school_vission}</dd>
                    </div>
                  )}
                  {schoolInfo?.school_mission && (
                    <div className="py-2.5">
                      <dt className="text-xs font-semibold text-slate-500">Mission</dt>
                      <dd className="mt-1 text-slate-700">{schoolInfo.school_mission}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
