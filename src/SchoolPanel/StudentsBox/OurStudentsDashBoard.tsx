import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Edit2, Lock, Plus, Search, Trash2, Upload } from 'lucide-react';
import type { SchoolStudentRecord } from '../../lib/SupaBaseClient/mockSupabase';
import { parseCsvText, serializeRowsToCsv } from '../../lib/services/planEntitlements';
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
import { useActiveSchool } from '../SchoolContext';

interface StudentFormState {
  full_name: string;
  email: string;
  roll_number: string;
  class_name: string;
  wing: string;
  fee_tier: 'Primary' | 'Secondary' | 'Senior Secondary';
  guardian_contact: string;
  is_active: boolean;
}

const EMPTY_FORM: StudentFormState = {
  full_name: '',
  email: '',
  roll_number: '',
  class_name: 'Grade 10 - A',
  wing: 'Senior Wing',
  fee_tier: 'Senior Secondary',
  guardian_contact: '',
  is_active: true,
};

export default function OurStudentsDashBoard() {
  const { school } = useActiveSchool();
  const [students, setStudents] = useState<SchoolStudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvInput, setCsvInput] = useState(
    'full_name,email,roll_number,class_name,wing,fee_tier,guardian_contact\n'
  );
  const [editing, setEditing] = useState<SchoolStudentRecord | null>(null);
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    const { data, error } = await listSchoolRecords<SchoolStudentRecord>(
      'SchoolStudents',
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
    'school-students-realtime',
    [
      {
        table: 'SchoolStudents',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: (payload) => {
          setStudents((prev) =>
            applyRealtimeChange(prev, payload, 'student_id', {
              filter: (row) => !school || row.school_id === school.school_id,
              sort: (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
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
      if (tierFilter !== 'ALL' && s.fee_tier !== tierFilter) return false;
      if (!q) return true;
      return [s.full_name, s.email, s.roll_number, s.class_name, s.wing].some((v) =>
        String(v || '').toLowerCase().includes(q)
      );
    });
  }, [students, query, tierFilter]);

  if (!school) return null;

  const getFeeForTier = (tier: SchoolStudentRecord['fee_tier']) => {
    if (tier === 'Primary') return school.primery_fee;
    if (tier === 'Secondary') return school.secondary_fee;
    return school.senior_secondary_fee;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (stu: SchoolStudentRecord) => {
    setEditing(stu);
    setForm({
      full_name: stu.full_name,
      email: stu.email,
      roll_number: stu.roll_number,
      class_name: stu.class_name,
      wing: stu.wing,
      fee_tier: stu.fee_tier,
      guardian_contact: stu.guardian_contact,
      is_active: stu.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;

    if (editing) {
      const { data: updated, error } = await updateSchoolRecord<SchoolStudentRecord>(
        'SchoolStudents',
        editing.student_id,
        {
          ...form,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
        }
      );
      if (error) {
        setNotice(error);
        return;
      }
      if (updated) {
        setStudents((prev) =>
          prev.map((item) => (item.student_id === updated.student_id ? updated : item))
        );
      }
      setNotice(`Updated student "${form.full_name.trim()}".`);
    } else {
      const { data: createdList, error } = await createSchoolRecords<SchoolStudentRecord>(
        'SchoolStudents',
        [
          {
            school_id: school.school_id,
            ...form,
            full_name: form.full_name.trim(),
            email: form.email.trim(),
          },
        ]
      );
      if (error) {
        setNotice(error);
        return;
      }
      const created = createdList[0];
      if (created) {
        setStudents((prev) =>
          prev.some((item) => item.student_id === created.student_id)
            ? prev
            : [created, ...prev]
        );
      }
      setNotice(`Enrolled student "${form.full_name.trim()}" (Role: Student).`);
    }
    setModalOpen(false);
  };

  const handleDelete = async (stu: SchoolStudentRecord) => {
    const { error } = await deleteSchoolRecord('SchoolStudents', stu.student_id);
    if (error) {
      setNotice(error);
      return;
    }
    setStudents((prev) => prev.filter((item) => item.student_id !== stu.student_id));
    setNotice(`Removed student "${stu.full_name}".`);
  };

  const handleExportCsv = () => {
    if (!school.is_import_export_allowed) return;
    const csv = serializeRowsToCsv(
      ['full_name', 'email', 'roll_number', 'class_name', 'wing', 'fee_tier', 'guardian_contact'],
      students as unknown as Array<Record<string, unknown>>
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${school.school_title.replace(/\s+/g, '_')}_students.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${students.length} student record(s) to CSV.`);
  };

  const handleImportCsv = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!school.is_import_export_allowed) return;
    const rows = parseCsvText(csvInput);
    if (rows.length === 0) {
      setNotice('No valid CSV rows found. Include header row and at least one student row.');
      return;
    }

    const payloads = rows
      .filter((r) => r.full_name)
      .map((r) => ({
        school_id: school.school_id,
        full_name: r.full_name,
        email: r.email || `student.${Date.now()}@school.edu`,
        roll_number: r.roll_number || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
        class_name: r.class_name || 'Grade 1 - A',
        wing: r.wing || 'Primary Wing',
        fee_tier:
          r.fee_tier === 'Secondary' || r.fee_tier === 'Senior Secondary'
            ? r.fee_tier
            : 'Primary',
        guardian_contact: r.guardian_contact || '',
        is_active: true,
      }));

    if (payloads.length === 0) return;

    const { data: created, error } = await createSchoolRecords<SchoolStudentRecord>(
      'SchoolStudents',
      payloads
    );
    if (error) {
      setNotice(error);
      return;
    }
    setStudents((prev) => {
      const existingIds = new Set(prev.map((s) => s.student_id));
      const fresh = created.filter((s) => !existingIds.has(s.student_id));
      return [...fresh, ...prev];
    });
    setImportModalOpen(false);
    setNotice(`Imported ${created.length} student(s) via CSV.`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Students</h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            Showing {filtered.length} of {students.length} enrolled students · {school.school_title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {school.is_import_export_allowed ? (
            <>
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </>
          ) : (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-medium text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Import/Export disabled by SuperAdmin
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
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
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
            placeholder="Search by name, roll number, class..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {['ALL', 'Primary', 'Secondary', 'Senior Secondary'].map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer whitespace-nowrap ${
                tierFilter === tier
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tier === 'ALL' ? 'All Tiers' : tier}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading students...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No students match your current filter. Click &quot;Add Student&quot; to enroll a student.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[740px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Roll No.</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class &amp; Wing</th>
                <th className="px-4 py-3">Fee Tier</th>
                <th className="px-4 py-3">Guardian Contact</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((stu) => (
                <tr key={stu.student_id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 tabular-nums">
                    {stu.roll_number || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{stu.full_name}</p>
                    <p className="text-xs text-slate-500">{stu.email || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {stu.class_name} · <span className="text-slate-500">{stu.wing}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                    {stu.fee_tier} (₹{getFeeForTier(stu.fee_tier)})
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                    {stu.guardian_contact || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(stu)}
                        aria-label={`Edit ${stu.full_name}`}
                        className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(stu)}
                        aria-label={`Delete ${stu.full_name}`}
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
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editing ? 'Edit Student' : 'Enroll New Student'}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="stu_name" className="mb-1 block text-xs font-semibold text-slate-700">
                  Student Full Name *
                </label>
                <input
                  id="stu_name"
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stu_roll" className="mb-1 block text-xs font-semibold text-slate-700">
                    Roll Number
                  </label>
                  <input
                    id="stu_roll"
                    type="text"
                    value={form.roll_number}
                    onChange={(e) => setForm({ ...form, roll_number: e.target.value })}
                    placeholder="GW-1020"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="stu_tier" className="mb-1 block text-xs font-semibold text-slate-700">
                    Fee Tier
                  </label>
                  <select
                    id="stu_tier"
                    value={form.fee_tier}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fee_tier: e.target.value as 'Primary' | 'Secondary' | 'Senior Secondary',
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Senior Secondary">Senior Secondary</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stu_class" className="mb-1 block text-xs font-semibold text-slate-700">
                    Class
                  </label>
                  <input
                    id="stu_class"
                    type="text"
                    value={form.class_name}
                    onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="stu_wing" className="mb-1 block text-xs font-semibold text-slate-700">
                    Wing
                  </label>
                  <input
                    id="stu_wing"
                    type="text"
                    value={form.wing}
                    onChange={(e) => setForm({ ...form, wing: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stu_email" className="mb-1 block text-xs font-semibold text-slate-700">
                    Student Email
                  </label>
                  <input
                    id="stu_email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="student@school.edu"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="stu_guardian" className="mb-1 block text-xs font-semibold text-slate-700">
                    Guardian Contact
                  </label>
                  <input
                    id="stu_guardian"
                    type="tel"
                    value={form.guardian_contact}
                    onChange={(e) => setForm({ ...form, guardian_contact: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  {editing ? 'Save Student' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importModalOpen && school.is_import_export_allowed && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Import Students via CSV</h2>
            <p className="mt-1 text-xs text-slate-500">
              Paste CSV lines matching the header row to enroll multiple students at once.
            </p>
            <form onSubmit={handleImportCsv} className="mt-4 space-y-4">
              <textarea
                rows={6}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs text-slate-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Import Rows
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
