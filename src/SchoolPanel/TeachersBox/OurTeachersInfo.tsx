import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Edit2, Lock, Plus, Search, Trash2 } from 'lucide-react';
import type { SchoolTeacherRecord } from '../../lib/SupaBaseClient/mockSupabase';
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
import { useActiveSchool } from '../SchoolContext';

interface TeacherFormState {
  full_name: string;
  email: string;
  subject: string;
  phone: string;
  wing: string;
  is_active: boolean;
}

const EMPTY_FORM: TeacherFormState = {
  full_name: '',
  email: '',
  subject: '',
  phone: '',
  wing: 'Science Wing',
  is_active: true,
};

export default function OurTeachersInfo() {
  const { school } = useActiveSchool();
  const [teachers, setTeachers] = useState<SchoolTeacherRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolTeacherRecord | null>(null);
  const [form, setForm] = useState<TeacherFormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTeachers = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    const { data, error } = await listSchoolRecords<SchoolTeacherRecord>(
      'SchoolTeachers',
      school.school_id
    );
    if (error) {
      setNotice(error);
    }
    setTeachers(data);
    setLoading(false);
  }, [school]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  useRealtimeTables(
    'school-teachers-realtime',
    [
      {
        table: 'SchoolTeachers',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: (payload) => {
          setTeachers((prev) =>
            applyRealtimeChange(prev, payload, 'teacher_id', {
              filter: (row) => !school || row.school_id === school.school_id,
              sort: (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
            })
          );
        },
      },
    ],
    { enabled: Boolean(school), onResync: () => void loadTeachers() }
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      [t.full_name, t.email, t.subject, t.wing, t.phone].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [teachers, query]);

  if (!school) return null;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (t: SchoolTeacherRecord) => {
    setEditing(t);
    setForm({
      full_name: t.full_name,
      email: t.email,
      subject: t.subject,
      phone: t.phone,
      wing: t.wing,
      is_active: t.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) return;

    if (editing) {
      const { data: updated, error } = await updateSchoolRecord<SchoolTeacherRecord>(
        'SchoolTeachers',
        editing.teacher_id,
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
        setTeachers((prev) =>
          prev.map((item) => (item.teacher_id === updated.teacher_id ? updated : item))
        );
      }
      setNotice(`Updated teacher "${form.full_name.trim()}".`);
    } else {
      const { data: createdList, error } = await createSchoolRecords<SchoolTeacherRecord>(
        'SchoolTeachers',
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
        setTeachers((prev) =>
          prev.some((item) => item.teacher_id === created.teacher_id)
            ? prev
            : [created, ...prev]
        );
      }
      setNotice(`Added teacher "${form.full_name.trim()}" (Role: Teacher).`);
    }
    setModalOpen(false);
  };

  const handleDelete = async (t: SchoolTeacherRecord) => {
    const { error } = await deleteSchoolRecord('SchoolTeachers', t.teacher_id);
    if (error) {
      setNotice(error);
      return;
    }
    setTeachers((prev) => prev.filter((item) => item.teacher_id !== t.teacher_id));
    setNotice(`Removed teacher "${t.full_name}".`);
  };

  const handleExportCsv = () => {
    if (!school.is_import_export_allowed) return;
    const csv = serializeRowsToCsv(
      ['full_name', 'email', 'subject', 'phone', 'wing'],
      teachers as unknown as Array<Record<string, unknown>>
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${school.school_title.replace(/\s+/g, '_')}_teachers.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Teachers</h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            {filtered.length} of {teachers.length} faculty members · {school.school_title}
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
            Add Teacher
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

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teachers by name, subject, email..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading teachers...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No teachers found. Click &quot;Add Teacher&quot; to register faculty.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Name &amp; Email</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Wing</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.teacher_id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{t.full_name}</p>
                    <p className="text-xs text-slate-500">{t.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{t.subject || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{t.wing || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                    {t.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span className={t.is_active ? 'text-emerald-700' : 'text-slate-400'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        aria-label={`Edit ${t.full_name}`}
                        className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t)}
                        aria-label={`Delete ${t.full_name}`}
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

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editing ? 'Edit Teacher' : 'Add New Teacher'}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="tch_name" className="mb-1 block text-xs font-semibold text-slate-700">
                  Full Name *
                </label>
                <input
                  id="tch_name"
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="tch_email" className="mb-1 block text-xs font-semibold text-slate-700">
                  Email *
                </label>
                <input
                  id="tch_email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="teacher.name@school.edu"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tch_subject" className="mb-1 block text-xs font-semibold text-slate-700">
                    Subject
                  </label>
                  <input
                    id="tch_subject"
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="tch_wing" className="mb-1 block text-xs font-semibold text-slate-700">
                    Wing
                  </label>
                  <input
                    id="tch_wing"
                    type="text"
                    value={form.wing}
                    onChange={(e) => setForm({ ...form, wing: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="tch_phone" className="mb-1 block text-xs font-semibold text-slate-700">
                  Phone
                </label>
                <input
                  id="tch_phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
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
                  {editing ? 'Save Teacher' : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
