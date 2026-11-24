import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Edit2, KeyRound, Lock, Plus, Search, Trash2 } from 'lucide-react';
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
import {
  buildTeacherInsertPayload,
  provisionSupabaseAccountAndProfile,
} from '../../lib/auth/userProvisioning';
import { isSafeHttpUrl } from '../../lib/GooglDrive/GoogleDrive';
import { useActiveSchool } from '../SchoolContext';

interface TeacherFormState {
  teacher_full_name: string;
  teacher_email: string;
  password: string;
  teacher_contact: string;
  monthly_wage: number;
  joined_at: string;
  left_at: string;
  teacher_img: string;
  class_id: string;
  is_active: boolean;
}

const EMPTY_FORM: TeacherFormState = {
  teacher_full_name: '',
  teacher_email: '',
  password: '',
  teacher_contact: '',
  monthly_wage: 5500,
  joined_at: new Date().toISOString().slice(0, 10),
  left_at: '',
  teacher_img: '',
  class_id: '',
  is_active: true,
};

function getTeacherName(t: SchoolTeacherRecord): string {
  return t.teacher_full_name || t.full_name || 'Unnamed Teacher';
}

function getTeacherEmail(t: SchoolTeacherRecord): string {
  return t.teacher_email || t.email || '—';
}

function getTeacherContact(t: SchoolTeacherRecord): string {
  return t.teacher_contact || t.phone || '—';
}

export default function OurTeachersInfo() {
  const { school } = useActiveSchool();
  const [teachers, setTeachers] = useState<SchoolTeacherRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolTeacherRecord | null>(null);
  const [form, setForm] = useState<TeacherFormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
      [getTeacherName(t), getTeacherEmail(t), getTeacherContact(t), t.user_id, t.subject, t.wing].some(
        (v) => String(v || '').toLowerCase().includes(q)
      )
    );
  }, [teachers, query]);

  if (!school) return null;

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setForm({
      ...EMPTY_FORM,
      joined_at: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openEdit = (t: SchoolTeacherRecord) => {
    setEditing(t);
    setFormError(null);
    setForm({
      teacher_full_name: getTeacherName(t),
      teacher_email: t.teacher_email || t.email || '',
      password: '',
      teacher_contact: t.teacher_contact || t.phone || '',
      monthly_wage: Number(t.monthly_wage ?? 5500),
      joined_at: t.joined_at || new Date().toISOString().slice(0, 10),
      left_at: t.left_at || '',
      teacher_img: t.teacher_img || '',
      class_id: t.class_id || '',
      is_active: t.is_active !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!form.teacher_full_name.trim() || !form.teacher_email.trim()) {
      setFormError('Teacher full name and email are required.');
      return;
    }
    if (form.teacher_img.trim() && !isSafeHttpUrl(form.teacher_img.trim())) {
      setFormError('Teacher photo URL must be a valid http:// or https:// Drive link.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updatePayload: Record<string, unknown> = {
          teacher_full_name: form.teacher_full_name.trim(),
          teacher_email: form.teacher_email.trim().toLowerCase(),
          teacher_contact: form.teacher_contact.trim() || null,
          monthly_wage: Number(form.monthly_wage) || 5500,
          joined_at: form.joined_at || null,
          left_at: form.left_at || null,
          teacher_img: form.teacher_img.trim() || null,
          class_id: form.class_id.trim() || null,
          is_active: form.is_active,
        };
        const { data: updated, error } = await updateSchoolRecord<SchoolTeacherRecord>(
          'SchoolTeachers',
          editing.teacher_id,
          updatePayload
        );
        if (error) {
          setFormError(error);
          return;
        }
        if (updated) {
          setTeachers((prev) =>
            prev.map((item) => (item.teacher_id === updated.teacher_id ? updated : item))
          );
        }
        setNotice(`Updated teacher "${form.teacher_full_name.trim()}".`);
      } else {
        if (form.password.length < 6) {
          setFormError('Password must be at least 6 characters to create the teacher login account.');
          return;
        }

        // Step 1 + 2: Create Supabase auth.users row -> capture user_uuid -> insert public.school_user_info
        const provisioned = await provisionSupabaseAccountAndProfile({
          email: form.teacher_email.trim(),
          password: form.password,
          fullName: form.teacher_full_name.trim(),
          role: 'Teacher',
          schoolId: school.school_id,
        });

        // Step 3: Insert into public."SchoolTeachers" with REQUIRED school_id AND user_id
        const teacherRow = buildTeacherInsertPayload({
          school_id: school.school_id,
          user_id: provisioned.user_uuid,
          teacher_full_name: form.teacher_full_name.trim(),
          teacher_email: form.teacher_email.trim(),
          teacher_contact: form.teacher_contact.trim() || null,
          class_id: form.class_id.trim() || null,
          is_active: form.is_active,
          monthly_wage: Number(form.monthly_wage) || 5500,
          joined_at: form.joined_at || null,
          left_at: form.left_at || null,
          teacher_img: form.teacher_img.trim() || null,
        });

        const { data: createdList, error } = await createSchoolRecords<SchoolTeacherRecord>(
          'SchoolTeachers',
          [teacherRow]
        );
        if (error) {
          setFormError(error);
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
        setNotice(
          `Created auth account + school_user_info (Role: Teacher, user_id: ${provisioned.user_uuid.slice(0, 8)}...) and added "${form.teacher_full_name.trim()}" to SchoolTeachers.`
        );
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save teacher.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: SchoolTeacherRecord) => {
    const { error } = await deleteSchoolRecord('SchoolTeachers', t.teacher_id);
    if (error) {
      setNotice(error);
      return;
    }
    setTeachers((prev) => prev.filter((item) => item.teacher_id !== t.teacher_id));
    setNotice(`Removed teacher "${getTeacherName(t)}".`);
  };

  const handleExportCsv = () => {
    if (!school.is_import_export_allowed) return;
    const csv = serializeRowsToCsv(
      ['teacher_full_name', 'teacher_email', 'teacher_contact', 'school_id', 'user_id', 'monthly_wage', 'joined_at', 'teacher_img'],
      teachers.map((t) => ({
        teacher_full_name: getTeacherName(t),
        teacher_email: getTeacherEmail(t),
        teacher_contact: getTeacherContact(t),
        school_id: t.school_id,
        user_id: t.user_id || '',
        monthly_wage: t.monthly_wage ?? 5500,
        joined_at: t.joined_at || '',
        teacher_img: t.teacher_img || '',
      }))
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            School Teachers
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            {filtered.length} of {teachers.length} faculty members · {school.school_title} ·
            Automatically provisions auth.users + school_user_info + school_id/user_id link
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
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
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
          placeholder="Search teachers by name, email, contact..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading teachers...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No teachers found. Click &quot;Add Teacher&quot; to create an auth account and register faculty.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[740px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Teacher &amp; Email</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Monthly Wage</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Auth User ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.teacher_id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {t.teacher_img && isSafeHttpUrl(t.teacher_img) && (
                        <img
                          src={t.teacher_img}
                          alt={getTeacherName(t)}
                          className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{getTeacherName(t)}</p>
                        <p className="text-xs text-slate-500">{getTeacherEmail(t)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                    {getTeacherContact(t)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 tabular-nums">
                    ₹{Number(t.monthly_wage ?? 5500).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                    {t.joined_at || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {t.user_id ? `${t.user_id.slice(0, 8)}...` : 'Linked'}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span className={t.is_active !== false ? 'text-emerald-700' : 'text-slate-400'}>
                      {t.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        aria-label={`Edit ${getTeacherName(t)}`}
                        className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t)}
                        aria-label={`Delete ${getTeacherName(t)}`}
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editing ? 'Edit Teacher' : 'Add New Teacher (Creates Auth Account)'}
            </h2>
            {!editing && (
              <p className="mt-1 text-xs text-slate-500">
                Creates Supabase auth user → saves <code className="font-mono">school_user_info</code>{' '}
                (role: Teacher) → links required <code className="font-mono">school_id</code> &amp;{' '}
                <code className="font-mono">user_id</code> in <code className="font-mono">SchoolTeachers</code>.
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
              <div>
                <label htmlFor="tch_name" className="mb-1 block text-xs font-semibold text-slate-700">
                  Teacher Full Name *
                </label>
                <input
                  id="tch_name"
                  type="text"
                  required
                  value={form.teacher_full_name}
                  onChange={(e) => setForm({ ...form, teacher_full_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="tch_email" className="mb-1 block text-xs font-semibold text-slate-700">
                    Teacher Email *
                  </label>
                  <input
                    id="tch_email"
                    type="email"
                    required
                    value={form.teacher_email}
                    onChange={(e) => setForm({ ...form, teacher_email: e.target.value })}
                    placeholder="teacher.name@school.edu"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                {!editing && (
                  <div>
                    <label
                      htmlFor="tch_password"
                      className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700"
                    >
                      <KeyRound className="h-3 w-3 text-indigo-600" />
                      Login Password *
                    </label>
                    <input
                      id="tch_password"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tch_phone" className="mb-1 block text-xs font-semibold text-slate-700">
                    Contact Number
                  </label>
                  <input
                    id="tch_phone"
                    type="tel"
                    value={form.teacher_contact}
                    onChange={(e) => setForm({ ...form, teacher_contact: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="tch_wage" className="mb-1 block text-xs font-semibold text-slate-700">
                    Monthly Wage (₹)
                  </label>
                  <input
                    id="tch_wage"
                    type="number"
                    min={0}
                    value={form.monthly_wage}
                    onChange={(e) => setForm({ ...form, monthly_wage: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tch_joined" className="mb-1 block text-xs font-semibold text-slate-700">
                    Joined Date
                  </label>
                  <input
                    id="tch_joined"
                    type="date"
                    value={form.joined_at}
                    onChange={(e) => setForm({ ...form, joined_at: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="tch_left" className="mb-1 block text-xs font-semibold text-slate-700">
                    Left Date (Optional)
                  </label>
                  <input
                    id="tch_left"
                    type="date"
                    value={form.left_at}
                    onChange={(e) => setForm({ ...form, left_at: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tch_img" className="mb-1 block text-xs font-semibold text-slate-700">
                  Teacher Photo URL (Public Google Drive Link)
                </label>
                <input
                  id="tch_img"
                  type="url"
                  value={form.teacher_img}
                  onChange={(e) => setForm({ ...form, teacher_img: e.target.value })}
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
                  {saving ? 'Provisioning...' : editing ? 'Save Teacher' : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
