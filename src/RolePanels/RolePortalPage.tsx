import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, LogOut, Users } from 'lucide-react';
import SupaBaseClientFunction from '../lib/SupaBaseClient/SupaBaseClientFunction';
import type {
  SchoolClassRecord,
  SchoolStudentRecord,
} from '../lib/SupaBaseClient/mockSupabase';
import {
  applyRealtimeChange,
  useRealtimeTables,
} from '../lib/realtime/useRealtimeTable';
import { useAuth } from '../lib/auth/AuthContext';

interface RolePortalPageProps {
  role: 'Teacher' | 'Student';
}

export default function RolePortalPage({ role }: RolePortalPageProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const userEmail = user?.email ?? '';
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [students, setStudents] = useState<SchoolStudentRecord[]>([]);

  const loadPortalData = useCallback(async () => {
    const supabase = SupaBaseClientFunction();
    const [cRes, sRes] = await Promise.all([
      supabase.from('SchoolClasses').select('*'),
      supabase.from('SchoolStudents').select('*'),
    ]);
    if (!cRes.error) {
      setClasses((cRes.data as SchoolClassRecord[]) || []);
    }
    if (!sRes.error) {
      setStudents((sRes.data as SchoolStudentRecord[]) || []);
    }
  }, []);

  useEffect(() => {
    void loadPortalData();
  }, [loadPortalData]);

  useRealtimeTables(
    `role-portal-${role.toLowerCase()}-realtime`,
    [
      {
        table: 'SchoolClasses',
        onChange: (payload) => {
          setClasses((prev) => applyRealtimeChange(prev, payload, 'class_id'));
        },
      },
      {
        table: 'SchoolStudents',
        onChange: (payload) => {
          setStudents((prev) => applyRealtimeChange(prev, payload, 'student_id'));
        },
      },
    ],
    { onResync: () => void loadPortalData() }
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SchoolGrid
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="text-slate-900 font-semibold whitespace-nowrap">
              {role} Portal
            </span>
            <Link to="/school-dashboard" className="hover:text-slate-900 whitespace-nowrap">
              School Panel
            </Link>
            <Link to="/services" className="hover:text-slate-900 whitespace-nowrap">
              Plans
            </Link>
          </nav>

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
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {role} Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as {userEmail || `${role.toLowerCase()}@schoolgrid.edu`} · Role: {role}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              Assigned Classes
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {classes.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Users className="h-4 w-4 text-indigo-600" />
              Enrolled Students
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {students.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              Academic Session
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              2026–27
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">
            {role === 'Teacher' ? 'Your Active Class Schedule' : 'Your Classes & Sections'}
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">Class</th>
                  <th className="py-2.5 pr-4">Wing</th>
                  <th className="py-2.5 pr-4">Level</th>
                  <th className="py-2.5 pr-4">Instructor</th>
                  <th className="py-2.5 text-right">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((cls) => (
                  <tr key={cls.class_id}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{cls.class_name}</td>
                    <td className="py-3 pr-4 text-slate-600">{cls.wing}</td>
                    <td className="py-3 pr-4 text-slate-600">{cls.level}</td>
                    <td className="py-3 pr-4 text-slate-700">{cls.teacher_name}</td>
                    <td className="py-3 text-right font-mono text-xs text-slate-600">
                      {cls.room_no}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
