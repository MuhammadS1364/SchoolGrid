import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Lock, Plus, Trash2, Edit2 } from 'lucide-react';
import type { SchoolTeacherRecord } from '../../lib/SupaBaseClient/mockSupabase';
import { serializeRowsToCsv } from '../../lib/services/planEntitlements';
import { listSchoolRecords } from '../../lib/services/schoolDirectoryStore';
import {
  createTursoSchoolClass,
  deleteTursoSchoolClass,
  fetchTursoSchoolClasses,
  updateTursoSchoolClass,
  type TursoSchoolClass,
} from '../../lib/services/tursoSchoolData';
import { useActiveSchool } from '../SchoolContext';

interface ClassFormState {
  class_title: string;
  sub_title: string;
  class_teacher_id: string;
  total_students: number;
  is_active: boolean;
}

const EMPTY_CLASS_FORM: ClassFormState = {
  class_title: 'Seconday First Year',
  sub_title: 'U1',
  class_teacher_id: '',
  total_students: 0,
  is_active: true,
};

export default function OurClassInfo() {
  const { school, schoolInfo } = useActiveSchool();
  const [classes, setClasses] = useState<TursoSchoolClass[]>([]);
  const [teachers, setTeachers] = useState<SchoolTeacherRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TursoSchoolClass | null>(null);
  const [form, setForm] = useState<ClassFormState>(EMPTY_CLASS_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadClassesAndTeachers = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    const { data: teacherRows } = await listSchoolRecords<SchoolTeacherRecord>(
      'SchoolTeachers',
      school.school_id
    );
    setTeachers(teacherRows);

    const teacherIds = teacherRows.map((t) => t.teacher_id).filter(Boolean);
    const tursoRows = await fetchTursoSchoolClasses({
      schoolId: school.school_id,
      teacherIds,
    });
    setClasses(tursoRows);
    setLoading(false);
  }, [school]);

  useEffect(() => {
    void loadClassesAndTeachers();
  }, [loadClassesAndTeachers]);

  const teacherNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) {
      map.set(t.teacher_id, t.teacher_full_name || t.full_name || t.teacher_email || t.teacher_id);
    }
    return map;
  }, [teachers]);

  if (!school) return null;

  const classLimit = schoolInfo?.total_class ?? school.allowed_count_wing ?? 7;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_CLASS_FORM);
    setModalOpen(true);
  };

  const openEdit = (cls: TursoSchoolClass) => {
    setEditing(cls);
    setForm({
      class_title: cls.class_title,
      sub_title: cls.sub_title || 'U1',
      class_teacher_id: cls.class_teacher_id || '',
      total_students: cls.total_students ?? 0,
      is_active: cls.is_active === 1,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.class_title.trim()) return;
    setSaving(true);
    setNotice(null);

    try {
      if (editing) {
        const { data: updated, error } = await updateTursoSchoolClass(editing.class_id, {
          class_title: form.class_title.trim(),
          sub_title: form.sub_title.trim() || 'U1',
          class_teacher_id: form.class_teacher_id || null,
          total_students: Number(form.total_students) || 0,
          is_active: form.is_active ? 1 : 0,
        });
        if (error) {
          setNotice(error);
          return;
        }
        if (updated) {
          setClasses((prev) => prev.map((c) => (c.class_id === updated.class_id ? updated : c)));
        }
        setNotice(`Updated class "${form.class_title.trim()}" in Turso SchoolClasses.`);
      } else {
        const { data: created, error } = await createTursoSchoolClass({
          school_id: school.school_id,
          class_title: form.class_title.trim(),
          sub_title: form.sub_title.trim() || 'U1',
          class_teacher_id: form.class_teacher_id || null,
          total_students: Number(form.total_students) || 0,
          is_active: form.is_active ? 1 : 0,
        });
        if (error) {
          setNotice(error);
          return;
        }
        if (created) {
          setClasses((prev) =>
            prev.some((c) => c.class_id === created.class_id) ? prev : [created, ...prev]
          );
        }
        setNotice(`Added class "${form.class_title.trim()}" to Turso SchoolClasses.`);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cls: TursoSchoolClass) => {
    const { error } = await deleteTursoSchoolClass(cls.class_id);
    if (error) {
      setNotice(error);
      return;
    }
    setClasses((prev) => prev.filter((c) => c.class_id !== cls.class_id));
    setNotice(`Removed class "${cls.class_title}".`);
  };

  const handleExportCsv = () => {
    if (!school.is_import_export_allowed) return;
    const csv = serializeRowsToCsv(
      ['class_id', 'class_title', 'sub_title', 'class_teacher_id', 'total_students', 'is_active', 'created_at'],
      classes as unknown as Array<Record<string, unknown>>
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${school.school_title.replace(/\s+/g, '_')}_Turso_SchoolClasses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Classes &amp; Units</h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            {classes.length} of {classLimit} classes · {school.school_title} · Synced with Turso{' '}
            <code className="font-mono">SchoolClasses</code>
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
            Add Class
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

      {loading ? (
        <div className="text-sm text-slate-500">Loading Turso SchoolClasses...</div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No classes added yet. Click &quot;Add Class&quot; to create a class in Turso{' '}
          <code className="font-mono">SchoolClasses</code>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Class Title</th>
                <th className="px-4 py-3">Sub Title</th>
                <th className="px-4 py-3">Class Teacher</th>
                <th className="px-4 py-3 text-right">Total Students</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.map((cls) => (
                <tr key={cls.class_id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">{cls.class_title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {cls.sub_title || 'U1'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {cls.class_teacher_id
                      ? teacherNameById.get(cls.class_teacher_id) ||
                        `${cls.class_teacher_id.slice(0, 8)}...`
                      : 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {cls.total_students}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold ${
                        cls.is_active === 1 ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {cls.is_active === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(cls)}
                        aria-label={`Edit ${cls.class_title}`}
                        className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(cls)}
                        aria-label={`Delete ${cls.class_title}`}
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
              {editing ? 'Edit Class' : 'Add New Class (Turso SchoolClasses)'}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="cls_title" className="mb-1 block text-xs font-semibold text-slate-700">
                  Class Title (class_title) *
                </label>
                <input
                  id="cls_title"
                  type="text"
                  required
                  value={form.class_title}
                  onChange={(e) => setForm({ ...form, class_title: e.target.value })}
                  placeholder="e.g. Seconday First Year"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cls_sub" className="mb-1 block text-xs font-semibold text-slate-700">
                    Sub Title / Unit (sub_title)
                  </label>
                  <input
                    id="cls_sub"
                    type="text"
                    value={form.sub_title}
                    onChange={(e) => setForm({ ...form, sub_title: e.target.value })}
                    placeholder="U1"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cls_students" className="mb-1 block text-xs font-semibold text-slate-700">
                    Total Students (total_students)
                  </label>
                  <input
                    id="cls_students"
                    type="number"
                    min={0}
                    value={form.total_students}
                    onChange={(e) => setForm({ ...form, total_students: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cls_teacher" className="mb-1 block text-xs font-semibold text-slate-700">
                  Class Teacher (class_teacher_id)
                </label>
                <select
                  id="cls_teacher"
                  value={form.class_teacher_id}
                  onChange={(e) => setForm({ ...form, class_teacher_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.teacher_id} value={t.teacher_id}>
                      {t.teacher_full_name || t.full_name} ({t.teacher_email || t.email})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Class is Active (is_active = 1)
              </label>

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
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editing ? 'Save Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
