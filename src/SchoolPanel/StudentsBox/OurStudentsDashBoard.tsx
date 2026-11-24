import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Edit2, KeyRound, Lock, Plus, Search, Trash2 } from 'lucide-react';
import type { StudentsBoxRecord } from '../../lib/SupaBaseClient/mockSupabase';
import { serializeRowsToCsv } from '../../lib/services/planEntitlements';
import {
  createSchoolRecords,
  deleteSchoolRecord,
  listSchoolRecords,
  updateSchoolRecord,
} from '../../lib/services/schoolDirectoryStore';
import {
  applyRealtimeChange,
  useRealtimeTables,
} from '../../lib/realtime/useRealtimeTable';
import {
  buildStudentInsertPayload,
  provisionSupabaseAccountAndProfile,
} from '../../lib/auth/userProvisioning';
import { isSafeHttpUrl } from '../../lib/GooglDrive/GoogleDrive';
import { useActiveSchool } from '../SchoolContext';

interface StudentFormState {
  AddNo: string;
  StudentName: string;
  StudentEmail: string;
  password: string;
  FatherName: string;
  StnState: string;
  StnDistrict: string;
  Stn_Class: string;
  Stn_Dob: string;
  Student_Photo_Urls: string;
  IsActive: boolean;
}

const EMPTY_FORM: StudentFormState = {
  AddNo: '',
  StudentName: '',
  StudentEmail: '',
  password: '',
  FatherName: '',
  StnState: '',
  StnDistrict: '',
  Stn_Class: '',
  Stn_Dob: '',
  Student_Photo_Urls: '',
  IsActive: true,
};

export default function OurStudentsDashBoard() {
  const { school } = useActiveSchool();
  const [students, setStudents] = useState<StudentsBoxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentsBoxRecord | null>(null);
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    const { data, error } = await listSchoolRecords<StudentsBoxRecord>(
      'StudentsBox',
      school.school_id
    );
    if (error) {
      setNotice(error);
    }
    setStudents(data);
    setLoading(false);
  }, [school]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useRealtimeTables(
    'school-students-box-realtime',
    [
      {
        table: 'StudentsBox',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: (payload) => {
          setStudents((prev) =>
            applyRealtimeChange(prev, payload, 'AddNo', {
              filter: (row) => !school || row.school_id === school.school_id,
              sort: (a, b) => String(b.AddNo ?? '').localeCompare(String(a.AddNo ?? '')),
            })
          );
        },
      },
    ],
    { enabled: Boolean(school), onResync: () => void loadStudents() }
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (statusFilter === 'ACTIVE' && s.IsActive === false) return false;
      if (statusFilter === 'INACTIVE' && s.IsActive !== false) return false;
      if (!q) return true;
      return [
        s.AddNo,
        s.StudentName,
        s.StudentEmail,
        s.FatherName,
        s.StnState,
        s.StnDistrict,
      ].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [students, query, statusFilter]);

  if (!school) return null;

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setForm({
      ...EMPTY_FORM,
      StnState: school.loc_state || '',
      StnDistrict: school.loc_district || '',
    });
    setModalOpen(true);
  };

  const openEdit = (stu: StudentsBoxRecord) => {
    setEditing(stu);
    setFormError(null);
    setForm({
      AddNo: stu.AddNo,
      StudentName: stu.StudentName || '',
      StudentEmail: stu.StudentEmail || '',
      password: '',
      FatherName: stu.FatherName || '',
      StnState: stu.StnState || '',
      StnDistrict: stu.StnDistrict || '',
      Stn_Class: stu.Stn_Class || '',
      Stn_Dob: stu.Stn_Dob || '',
      Student_Photo_Urls: stu.Student_Photo_Urls || '',
      IsActive: stu.IsActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!form.AddNo.trim() || !form.StudentName.trim() || !form.StudentEmail.trim()) {
      setFormError('Admission No (AddNo), Student Name, and Student Email are required.');
      return;
    }
    if (form.Student_Photo_Urls.trim() && !isSafeHttpUrl(form.Student_Photo_Urls.trim())) {
      setFormError('Student photo URL must be a valid http:// or https:// Drive link.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { data: updated, error } = await updateSchoolRecord<StudentsBoxRecord>(
          'StudentsBox',
          editing.AddNo,
          {
            StudentName: form.StudentName.trim(),
            StudentEmail: form.StudentEmail.trim().toLowerCase(),
            FatherName: form.FatherName.trim() || null,
            StnState: form.StnState.trim() || '',
            StnDistrict: form.StnDistrict.trim() || '',
            Stn_Class: form.Stn_Class.trim() || null,
            Stn_Dob: form.Stn_Dob.trim() || null,
            Student_Photo_Urls: form.Student_Photo_Urls.trim() || null,
            IsActive: form.IsActive,
          }
        );
        if (error) {
          setFormError(error);
          return;
        }
        if (updated) {
          setStudents((prev) =>
            prev.map((item) => (item.AddNo === updated.AddNo ? updated : item))
          );
        }
        setNotice(`Updated student "${form.StudentName.trim()}" (${editing.AddNo}).`);
      } else {
        if (form.password.length < 6) {
          setFormError('Password must be at least 6 characters to create the student login account.');
          return;
        }

        // Step 1 + 2: Create Supabase auth.users -> pick user_uuid -> save school_user_info (Role: Student)
        const provisioned = await provisionSupabaseAccountAndProfile({
          email: form.StudentEmail.trim(),
          password: form.password,
          fullName: form.StudentName.trim(),
          role: 'Student',
          schoolId: school.school_id,
        });

        // Step 3: Insert into public."StudentsBox" with REQUIRED AddNo, school_id, and stn_user_id
        const studentRow = buildStudentInsertPayload({
          AddNo: form.AddNo.trim(),
          school_id: school.school_id,
          stn_user_id: provisioned.user_uuid,
          StudentName: form.StudentName.trim(),
          StudentEmail: form.StudentEmail.trim(),
          FatherName: form.FatherName.trim() || null,
          StnState: form.StnState.trim() || '',
          StnDistrict: form.StnDistrict.trim() || '',
          Stn_Class: form.Stn_Class.trim() || null,
          Stn_Dob: form.Stn_Dob.trim() || null,
          Student_Photo_Urls: form.Student_Photo_Urls.trim() || null,
          IsActive: form.IsActive,
        });

        const { data: createdList, error } = await createSchoolRecords<StudentsBoxRecord>(
          'StudentsBox',
          [studentRow]
        );
        if (error) {
          setFormError(error);
          return;
        }
        const created = createdList[0];
        if (created) {
          setStudents((prev) =>
            prev.some((item) => item.AddNo === created.AddNo) ? prev : [created, ...prev]
          );
        }
        setNotice(
          `Created auth account + school_user_info (Role: Student, stn_user_id: ${provisioned.user_uuid.slice(0, 8)}...) and enrolled "${form.StudentName.trim()}" (${form.AddNo.trim()}) in StudentsBox.`
        );
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to enroll student.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stu: StudentsBoxRecord) => {
    const { error } = await deleteSchoolRecord('StudentsBox', stu.AddNo);
    if (error) {
      setNotice(error);
      return;
    }
    setStudents((prev) => prev.filter((item) => item.AddNo !== stu.AddNo));
    setNotice(`Removed student "${stu.StudentName || stu.AddNo}".`);
  };

  const handleExportCsv = () => {
    if (!school.is_import_export_allowed) return;
    const csv = serializeRowsToCsv(
      [
        'AddNo',
        'StudentName',
        'StudentEmail',
        'FatherName',
        'school_id',
        'stn_user_id',
        'StnState',
        'StnDistrict',
        'Stn_Dob',
        'Grand_Total_Points',
        'Student_Photo_Urls',
      ],
      students as unknown as Array<Record<string, unknown>>
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${school.school_title.replace(/\s+/g, '_')}_StudentsBox.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${students.length} student record(s) to CSV.`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Students
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            Showing {filtered.length} of {students.length} enrolled students · {school.school_title}{' '}
            · Links required <code className="font-mono">school_id</code> &amp;{' '}
            <code className="font-mono">stn_user_id</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {school.is_import_export_allowed ? (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          ) : (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-medium text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Export disabled by SuperAdmin
            </span>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Student
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by AddNo, student name, father name..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'ALL' ? 'All Students' : tab === 'ACTIVE' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading students...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No students found. Click &quot;Add Student&quot; to create an auth account and enroll a student.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">AddNo</th>
                <th className="px-4 py-3">Student &amp; Email</th>
                <th className="px-4 py-3">Father Name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Grand Points</th>
                <th className="px-4 py-3">Auth User ID</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((stu) => (
                <tr key={stu.AddNo} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                    {stu.AddNo}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {stu.Student_Photo_Urls && isSafeHttpUrl(stu.Student_Photo_Urls) && (
                        <img
                          src={stu.Student_Photo_Urls}
                          alt={stu.StudentName || stu.AddNo}
                          className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{stu.StudentName || '—'}</p>
                        <p className="text-xs text-slate-500">{stu.StudentEmail || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{stu.FatherName || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {[stu.StnDistrict, stu.StnState].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700 tabular-nums">
                    {stu.Grand_Total_Points ?? 0} pts
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {stu.stn_user_id ? `${stu.stn_user_id.slice(0, 8)}...` : 'Linked'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(stu)}
                        aria-label={`Edit ${stu.StudentName || stu.AddNo}`}
                        className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(stu)}
                        aria-label={`Delete ${stu.StudentName || stu.AddNo}`}
                        className="rounded p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Student Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editing ? 'Edit Student' : 'Enroll New Student (Creates Auth Account)'}
            </h2>
            {!editing && (
              <p className="mt-1 text-xs text-slate-500">
                Creates Supabase auth user → saves <code className="font-mono">school_user_info</code>{' '}
                (role: Student) → links required <code className="font-mono">school_id</code> &amp;{' '}
                <code className="font-mono">stn_user_id</code> in <code className="font-mono">StudentsBox</code>.
              </p>
            )}

            {formError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="stu_addno" className="mb-1 block text-xs font-semibold text-slate-700">
                    Admission No (AddNo) *
                  </label>
                  <input
                    id="stu_addno"
                    type="text"
                    required
                    disabled={Boolean(editing)}
                    value={form.AddNo}
                    onChange={(e) => setForm({ ...form, AddNo: e.target.value })}
                    placeholder="GW-2026-101"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="stu_name" className="mb-1 block text-xs font-semibold text-slate-700">
                    Student Name *
                  </label>
                  <input
                    id="stu_name"
                    type="text"
                    required
                    value={form.StudentName}
                    onChange={(e) => setForm({ ...form, StudentName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="stu_email" className="mb-1 block text-xs font-semibold text-slate-700">
                    Student Email *
                  </label>
                  <input
                    id="stu_email"
                    type="email"
                    required
                    value={form.StudentEmail}
                    onChange={(e) => setForm({ ...form, StudentEmail: e.target.value })}
                    placeholder="student@school.edu"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                {!editing && (
                  <div>
                    <label
                      htmlFor="stu_password"
                      className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700"
                    >
                      <KeyRound className="h-3 w-3 text-indigo-600" />
                      Login Password *
                    </label>
                    <input
                      id="stu_password"
                      type="password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min. 6 characters"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="stu_father" className="mb-1 block text-xs font-semibold text-slate-700">
                    Father Name
                  </label>
                  <input
                    id="stu_father"
                    type="text"
                    value={form.FatherName}
                    onChange={(e) => setForm({ ...form, FatherName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="stu_dob" className="mb-1 block text-xs font-semibold text-slate-700">
                    Date of Birth
                  </label>
                  <input
                    id="stu_dob"
                    type="date"
                    value={form.Stn_Dob}
                    onChange={(e) => setForm({ ...form, Stn_Dob: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stu_state" className="mb-1 block text-xs font-semibold text-slate-700">
                    State
                  </label>
                  <input
                    id="stu_state"
                    type="text"
                    value={form.StnState}
                    onChange={(e) => setForm({ ...form, StnState: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="stu_district" className="mb-1 block text-xs font-semibold text-slate-700">
                    District
                  </label>
                  <input
                    id="stu_district"
                    type="text"
                    value={form.StnDistrict}
                    onChange={(e) => setForm({ ...form, StnDistrict: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="stu_photo" className="mb-1 block text-xs font-semibold text-slate-700">
                  Student Photo URL (Public Google Drive Link)
                </label>
                <input
                  id="stu_photo"
                  type="url"
                  value={form.Student_Photo_Urls}
                  onChange={(e) => setForm({ ...form, Student_Photo_Urls: e.target.value })}
                  placeholder="https://drive.google.com/uc?export=view&id=..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Provisioning...' : editing ? 'Save Student' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
