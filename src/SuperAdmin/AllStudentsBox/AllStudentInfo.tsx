import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Users, RotateCcw } from 'lucide-react';
import SupaBaseClientFunction, {
  formatSupabaseError,
} from '../../lib/SupaBaseClient/SupaBaseClientFunction';
import type {
  SchoolRecord,
  StudentsBoxRecord,
} from '../../lib/SupaBaseClient/mockSupabase';
import { listAllSchoolRecords } from '../../lib/services/schoolDirectoryStore';
import { applyRealtimeChange, useRealtimeTables } from '../../lib/realtime/useRealtimeTable';

export default function AllStudentsInfo() {
  const [students, setStudents] = useState<StudentsBoxRecord[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedSchoolId, setSelectedSchoolId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const loadDirectory = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    const supabase = SupaBaseClientFunction();
    try {
      const [studentsRes, schoolsRes] = await Promise.all([
        listAllSchoolRecords<StudentsBoxRecord>('StudentsBox'),
        supabase.from('OurSchools').select('*').order('school_title', { ascending: true }),
      ]);
      if (schoolsRes.error) throw schoolsRes.error;
      if (studentsRes.error) throw new Error(studentsRes.error);
      setSchools((schoolsRes.data as SchoolRecord[]) ?? []);
      setStudents(studentsRes.data);
    } catch (err: unknown) {
      setError(formatSupabaseError(err, 'Failed to load students directory.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory(true);
  }, [loadDirectory]);

  useRealtimeTables(
    'superadmin-all-students',
    [
      {
        table: 'StudentsBox',
        onChange: (payload) =>
          setStudents((prev) => applyRealtimeChange<StudentsBoxRecord>(prev, payload, 'AddNo')),
      },
      {
        table: 'OurSchools',
        onChange: (payload) =>
          setSchools((prev) => applyRealtimeChange<SchoolRecord>(prev, payload, 'school_id')),
      },
    ],
    { onResync: () => void loadDirectory(false) }
  );

  const schoolMap = useMemo(
    () => new Map(schools.map((s) => [s.school_id, s])),
    [schools]
  );

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    schools.forEach((s) => {
      if (s.loc_state?.trim()) set.add(s.loc_state.trim());
    });
    students.forEach((st) => {
      if (st.StnState?.trim()) set.add(st.StnState.trim());
    });
    return Array.from(set).sort();
  }, [schools, students]);

  const districtOptions = useMemo(() => {
    const set = new Set<string>();
    schools.forEach((s) => {
      if (selectedState !== 'ALL' && s.loc_state?.trim() !== selectedState) return;
      if (s.loc_district?.trim()) set.add(s.loc_district.trim());
    });
    students.forEach((st) => {
      if (selectedState !== 'ALL' && st.StnState?.trim() !== selectedState) return;
      if (st.StnDistrict?.trim()) set.add(st.StnDistrict.trim());
    });
    return Array.from(set).sort();
  }, [schools, students, selectedState]);

  const schoolOptions = useMemo(() => {
    return schools.filter((s) => {
      if (selectedState !== 'ALL' && s.loc_state?.trim() !== selectedState) return false;
      if (selectedDistrict !== 'ALL' && s.loc_district?.trim() !== selectedDistrict) return false;
      return true;
    });
  }, [schools, selectedState, selectedDistrict]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((st) => {
      const school = st.school_id ? schoolMap.get(st.school_id) : undefined;
      const stState = (school?.loc_state || st.StnState || '').trim();
      const stDistrict = (school?.loc_district || st.StnDistrict || '').trim();

      if (selectedState !== 'ALL' && stState !== selectedState) return false;
      if (selectedDistrict !== 'ALL' && stDistrict !== selectedDistrict) return false;
      if (selectedSchoolId !== 'ALL' && st.school_id !== selectedSchoolId) return false;
      if (selectedStatus === 'ACTIVE' && st.IsActive === false) return false;
      if (selectedStatus === 'INACTIVE' && st.IsActive !== false) return false;

      if (!q) return true;
      return [
        st.AddNo,
        st.StudentName,
        st.StudentEmail,
        st.FatherName,
        st.StnDistrict,
        st.StnState,
        school?.school_title,
        school?.loc_city_village,
      ].some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [
    students,
    schoolMap,
    searchQuery,
    selectedState,
    selectedDistrict,
    selectedSchoolId,
    selectedStatus,
  ]);

  const handleReset = () => {
    setSearchQuery('');
    setSelectedState('ALL');
    setSelectedDistrict('ALL');
    setSelectedSchoolId('ALL');
    setSelectedStatus('ALL');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            All Students (StudentsBox)
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            Showing {filteredStudents.length} of {students.length} students across {schools.length}{' '}
            schools
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          Reset Filters
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="all-student-search" className="mb-1 block text-xs font-medium text-slate-600">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="all-student-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="AddNo, student name, father name, email, or school..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="student-state-filter" className="mb-1 block text-xs font-medium text-slate-600">
            State
          </label>
          <select
            id="student-state-filter"
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setSelectedDistrict('ALL');
              setSelectedSchoolId('ALL');
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All States</option>
            {stateOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="student-district-filter"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            District
          </label>
          <select
            id="student-district-filter"
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              setSelectedSchoolId('ALL');
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Districts</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="student-school-filter"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            School
          </label>
          <select
            id="student-school-filter"
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Schools</option>
            {schoolOptions.map((sc) => (
              <option key={sc.school_id} value={sc.school_id}>
                {sc.school_title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:col-span-2 lg:col-span-5">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                selectedStatus === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'All Students' : status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">No students found</p>
            <p className="mt-1 text-xs text-slate-500">
              Students enrolled in <code className="font-mono">StudentsBox</code> from any School
              Dashboard appear here automatically.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">AddNo</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Father Name</th>
                <th className="px-4 py-3">School &amp; Location</th>
                <th className="px-4 py-3 text-right">Grand Points</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((st) => {
                const school = st.school_id ? schoolMap.get(st.school_id) : undefined;
                return (
                  <tr key={st.AddNo} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700 tabular-nums">
                      {st.AddNo}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{st.StudentName || '—'}</p>
                      <p className="text-xs text-slate-500">{st.StudentEmail || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{st.FatherName || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {school?.school_title || st.school_id || 'Unassigned'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[
                          school?.loc_city_village,
                          school?.loc_district || st.StnDistrict,
                          school?.loc_state || st.StnState,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {st.Grand_Total_Points ?? 0} pts
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span
                        className={st.IsActive !== false ? 'text-emerald-700' : 'text-slate-400'}
                      >
                        {st.IsActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}