import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Lock, Plus, Trash2, Edit2 } from 'lucide-react';
import type { SchoolClassRecord } from '../../lib/SupaBaseClient/mockSupabase';
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

interface ClassFormState {
  class_name: string;
  wing: string;
  level: 'Primary' | 'Secondary' | 'Senior Secondary';
  teacher_name: string;
  room_no: string;
  capacity: number;
}

const EMPTY_CLASS_FORM: ClassFormState = {
  class_name: '',
  wing: 'Primary Wing',
  level: 'Primary',
  teacher_name: '',
  room_no: '',
  capacity: 35,
};

export default function OurClassInfo() {
  const { school } = useActiveSchool();
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClassRecord | null>(null);
  const [form, setForm] = useState<ClassFormState>(EMPTY_CLASS_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    const { data, error } = await listSchoolRecords<SchoolClassRecord>(
      'SchoolClasses',
      school.school_id
    );
    if (error) {
      setNotice(error);
    }
    setClasses(data);
    setLoading(false);
  }, [school]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useRealtimeTables(
    'school-classes-realtime',
    [
      {
        table: 'SchoolClasses',
        filter: school ? `school_id=eq.${school.school_id}` : undefined,
        onChange: (payload) => {
          setClasses((prev) =>
            applyRealtimeChange(prev, payload, 'class_id', {
              filter: (row) => !school || row.school_id === school.school_id,
              sort: (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
            })
          );
        },
      },
    ],
    { enabled: Boolean(school), onResync: () => void loadClasses() }
  );

  if (!school) return null;

  const wingLimit = school.allowed_count_wing ?? 7;
  const atLimit = classes.length >= wingLimit;

  const openCreate = () => {
    if (atLimit) {
      setNotice(
        `Wing/Class quota reached (${classes.length}/${wingLimit}). Ask SuperAdmin to increase allowed_count_wing.`
      );
      return;
    }
    setEditing(null);
    setForm(EMPTY_CLASS_FORM);
    setModalOpen(true);
  };

  const openEdit = (cls: SchoolClassRecord) => {
    setEditing(cls);
    setForm({
      class_name: cls.class_name,
      wing: cls.wing,
      level: cls.level,
      teacher_name: cls.teacher_name,
      room_no: cls.room_no,
      capacity: cls.capacity,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.class_name.trim()) return;

    if (editing) {
      const { data: updated, error } = await updateSchoolRecord<SchoolClassRecord>(
        'SchoolClasses',
        editing.class_id,
        { ...form, class_name: form.class_name.trim() }
      );
      if (error) {
        setNotice(error);
        return;
      }
      if (updated) {
        setClasses((prev) => prev.map((c) => (c.class_id === updated.class_id ? updated : c)));
      }
      setNotice(`Updated class "${form.class_name.trim()}".`);
    } else {
      const { data: createdList, error } = await createSchoolRecords<SchoolClassRecord>(
        'SchoolClasses',
        [
          {
            school_id: school.school_id,
            ...form,
            class_name: form.class_name.trim(),
          },
        ]
      );
      if (error) {
        setNotice(error);
        return;
      }
      const created = createdList[0];
      if (created) {
        setClasses((prev) =>
          prev.some((c) => c.class_id === created.class_id) ? prev : [created, ...prev]
        );
      }
      setNotice(`Added class "${form.class_name.trim()}".`);
    }
    setModalOpen(false);
  };

  const handleDelete = async (cls: SchoolClassRecord) => {
    const { error } = await deleteSchoolRecord('SchoolClasses', cls.class_id);
    if (error) {
      setNotice(error);
      return;
    }
    setClasses((prev) => prev.filter((c) => c.class_id !== cls.class_id));
    setNotice(`Removed class "${cls.class_name}".`);
  };

  const handleExportCsv = () => {
    if (!school.is_import_export_allowed) return;
    const csv = serializeRowsToCsv(
      ['class_name', 'wing', 'level', 'teacher_name', 'room_no', 'capacity'],
      classes as unknown as Array<Record<string, unknown>>
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${school.school_title.replace(/\s+/g, '_')}_classes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Classes &amp; Wings</h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            {classes.length} of {wingLimit} allowed class slots used · {school.school_title}
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
        <div className="text-sm text-slate-500">Loading classes...</div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No classes added yet. Click &quot;Add Class&quot; to create your first section.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Class Name</th>
                <th className="px-4 py-3">Wing</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Class Teacher</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3 text-right">Capacity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.map((cls) => (
                <tr key={cls.class_id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">{cls.class_name}</td>
                  <td className="px-4 py-3 text-slate-700">{cls.wing}</td>
                  <td className="px-4 py-3 text-slate-600">{cls.level}</td>
                  <td className="px-4 py-3 text-slate-700">{cls.teacher_name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{cls.room_no || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {cls.capacity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(cls)}
                        aria-label={`Edit ${cls.class_name}`}
                        className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(cls)}
                        aria-label={`Delete ${cls.class_name}`}
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
              {editing ? 'Edit Class' : 'Add New Class'}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="cls_name" className="mb-1 block text-xs font-semibold text-slate-700">
                  Class Name *
                </label>
                <input
                  id="cls_name"
                  type="text"
                  required
                  value={form.class_name}
                  onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                  placeholder="e.g. Grade 9 - A"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cls_wing" className="mb-1 block text-xs font-semibold text-slate-700">
                    Wing
                  </label>
                  <input
                    id="cls_wing"
                    type="text"
                    value={form.wing}
                    onChange={(e) => setForm({ ...form, wing: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cls_level" className="mb-1 block text-xs font-semibold text-slate-700">
                    Level
                  </label>
                  <select
                    id="cls_level"
                    value={form.level}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        level: e.target.value as 'Primary' | 'Secondary' | 'Senior Secondary',
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
                  <label htmlFor="cls_teacher" className="mb-1 block text-xs font-semibold text-slate-700">
                    Class Teacher
                  </label>
                  <input
                    id="cls_teacher"
                    type="text"
                    value={form.teacher_name}
                    onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cls_room" className="mb-1 block text-xs font-semibold text-slate-700">
                    Room No.
                  </label>
                  <input
                    id="cls_room"
                    type="text"
                    value={form.room_no}
                    onChange={(e) => setForm({ ...form, room_no: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cls_capacity" className="mb-1 block text-xs font-semibold text-slate-700">
                  Student Capacity
                </label>
                <input
                  id="cls_capacity"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
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
                  {editing ? 'Save Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
