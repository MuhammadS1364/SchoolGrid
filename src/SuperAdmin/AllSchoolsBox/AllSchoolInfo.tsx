'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import SupaBaseClientFunction, {
  formatSupabaseError,
} from '../../lib/SupaBaseClient/SupaBaseClientFunction';
import type { SchoolRecord } from '../../lib/SupaBaseClient/mockSupabase';
import { applyRealtimeChange, useRealtimeTables } from '../../lib/realtime/useRealtimeTable';

const INACTIVE_STORAGE_KEY = 'our_schools_inactive_ids_v1';

interface SchoolFormData {
  school_title: string;
  school_manager: string;
  school_type: string;
  schoole_gmail: string;
  is_private: boolean;
  is_active: boolean;
  is_approved: boolean;
  is_gdrive_allowed: boolean;
  is_import_export_allowed: boolean;
  allowed_count_wing: number;
  is_email_service: boolean;
  is_collaburation_allowed: boolean;
  primery_fee: number;
  secondary_fee: number;
  senior_secondary_fee: number;
  total_class: number;
  is_computer_lab: boolean;
  is_library: boolean;
  youtub_link: string;
  insta_link: string;
  facebook_link: string;
  loc_state: string;
  loc_district: string;
  loc_city_village: string;
  local_address: string;
  user_uuid: string;
}

interface MessageBoxState {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  text: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'warning';
  onConfirm: () => Promise<void>;
}

const EMPTY_FORM: SchoolFormData = {
  school_title: '',
  school_manager: '',
  school_type: 'Senior Secondary',
  schoole_gmail: '',
  is_private: true,
  is_active: true,
  is_approved: true,
  is_gdrive_allowed: false,
  is_import_export_allowed: false,
  allowed_count_wing: 7,
  is_email_service: false,
  is_collaburation_allowed: false,
  primery_fee: 450,
  secondary_fee: 550,
  senior_secondary_fee: 750,
  total_class: 0,
  is_computer_lab: false,
  is_library: false,
  youtub_link: '',
  insta_link: '',
  facebook_link: '',
  loc_state: '',
  loc_district: '',
  loc_city_village: '',
  local_address: '',
  user_uuid: '',
};

type FeatureFlagKey =
  | 'is_approved'
  | 'is_gdrive_allowed'
  | 'is_import_export_allowed'
  | 'is_email_service'
  | 'is_collaburation_allowed';

const FEATURE_CONTROLS: Array<{ key: FeatureFlagKey; label: string }> = [
  { key: 'is_approved', label: 'Approved' },
  { key: 'is_gdrive_allowed', label: 'Google Drive' },
  { key: 'is_import_export_allowed', label: 'Import/Export' },
  { key: 'is_email_service', label: 'Email Service' },
  { key: 'is_collaburation_allowed', label: 'Collaboration' },
];

export default function AllSchoolsInfo() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [inactiveIds, setInactiveIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  const [msgBox, setMsgBox] = useState<MessageBoxState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmRunning, setConfirmRunning] = useState<boolean>(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter & search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [selectedVillage, setSelectedVillage] = useState<string>('ALL');
  const [schoolType, setSchoolType] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingSchool, setEditingSchool] = useState<SchoolRecord | null>(null);
  const [formData, setFormData] = useState<SchoolFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState<boolean>(false);

  const showMessageBox = (type: MessageBoxState['type'], title: string, text: string) => {
    setMsgBox({ id: Date.now(), type, title, text });
  };

  useEffect(() => {
    if (!msgBox) return;
    const timer = setTimeout(() => setMsgBox(null), 5000);
    return () => clearTimeout(timer);
  }, [msgBox]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INACTIVE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setInactiveIds(parsed);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const updateInactiveIds = (updater: string[] | ((prev: string[]) => string[])) => {
    setInactiveIds((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        window.localStorage.setItem(INACTIVE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const isSchoolActive = (school: SchoolRecord) => !inactiveIds.includes(school.school_id);

  const fetchSchools = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    const supabase = SupaBaseClientFunction();
    try {
      const { data, error: supabaseError } = await supabase
        .from('OurSchools')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      setSchools((data as SchoolRecord[]) || []);
    } catch (err: unknown) {
      setError(formatSupabaseError(err, 'Failed to load schools.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSchools(true);
  }, [fetchSchools]);

  useRealtimeTables(
    'our-schools-realtime-crud',
    [
      {
        table: 'OurSchools',
        onChange: (payload) => {
          setSchools((prev) =>
            applyRealtimeChange<SchoolRecord>(prev, payload, 'school_id')
          );
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<SchoolRecord> | null)?.school_id;
            if (deletedId) {
              setSelectedIds((prev) => prev.filter((id) => id !== deletedId));
              updateInactiveIds((prev) => prev.filter((id) => id !== deletedId));
            }
          }
        },
      },
    ],
    { onResync: () => void fetchSchools(false) }
  );

  // Cascading filter options
  const stateOptions = useMemo(() => {
    const values = schools
      .map((s) => s.loc_state?.trim())
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(values)).sort();
  }, [schools]);

  const districtOptions = useMemo(() => {
    const values = schools
      .filter((s) => selectedState === 'ALL' || s.loc_state?.trim() === selectedState)
      .map((s) => s.loc_district?.trim())
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(values)).sort();
  }, [schools, selectedState]);

  const villageOptions = useMemo(() => {
    const values = schools
      .filter((s) => {
        const matchState = selectedState === 'ALL' || s.loc_state?.trim() === selectedState;
        const matchDistrict =
          selectedDistrict === 'ALL' || s.loc_district?.trim() === selectedDistrict;
        return matchState && matchDistrict;
      })
      .map((s) => s.loc_city_village?.trim())
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(values)).sort();
  }, [schools, selectedState, selectedDistrict]);

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    setSelectedDistrict('ALL');
    setSelectedVillage('ALL');
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setSelectedVillage('ALL');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedState('ALL');
    setSelectedDistrict('ALL');
    setSelectedVillage('ALL');
    setSchoolType('ALL');
    setStatusFilter('ALL');
  };

  const filteredSchools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return schools.filter((school) => {
      if (selectedState !== 'ALL' && school.loc_state?.trim() !== selectedState) return false;
      if (selectedDistrict !== 'ALL' && school.loc_district?.trim() !== selectedDistrict) return false;
      if (selectedVillage !== 'ALL' && school.loc_city_village?.trim() !== selectedVillage)
        return false;
      if (schoolType === 'PRIVATE' && school.is_private !== true) return false;
      if (schoolType === 'PUBLIC' && school.is_private !== false) return false;

      const active = !inactiveIds.includes(school.school_id);
      if (statusFilter === 'ACTIVE' && !active) return false;
      if (statusFilter === 'INACTIVE' && active) return false;

      if (!q) return true;
      const searchableFields = [
        school.school_title,
        school.school_manager,
        school.schoole_gmail,
        school.school_type,
        school.loc_state,
        school.loc_district,
        school.loc_city_village,
        school.local_address,
      ];
      return searchableFields.some((field) => String(field || '').toLowerCase().includes(q));
    });
  }, [
    schools,
    inactiveIds,
    searchQuery,
    selectedState,
    selectedDistrict,
    selectedVillage,
    schoolType,
    statusFilter,
  ]);

  const allFilteredSelected =
    filteredSchools.length > 0 &&
    filteredSchools.every((s) => selectedIds.includes(s.school_id));

  const toggleSelectOne = (schoolId: string) => {
    setSelectedIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredSchools.map((s) => s.school_id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredSchools.map((s) => s.school_id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  // SuperAdmin-only direct feature flag toggle (Google Drive, Import/Export, Email, Collaboration, Approved)
  const handleToggleFeatureFlag = async (school: SchoolRecord, flag: FeatureFlagKey, label: string) => {
    setBusyId(school.school_id);
    const nextValue = !Boolean(school[flag]);
    const supabase = SupaBaseClientFunction();

    try {
      const { data, error: updateErr } = await supabase
        .from('OurSchools')
        .update({ [flag]: nextValue })
        .eq('school_id', school.school_id)
        .select();

      if (updateErr) throw updateErr;
      const updated = (data?.[0] as SchoolRecord | undefined) ?? {
        ...school,
        [flag]: nextValue,
      };
      setSchools((prev) =>
        prev.map((item) => (item.school_id === updated.school_id ? updated : item))
      );
      showMessageBox(
        'success',
        `${label} ${nextValue ? 'Enabled' : 'Disabled'}`,
        `"${school.school_title}" ${label} is now ${nextValue ? 'ON' : 'OFF'}.`
      );
    } catch (err: unknown) {
      showMessageBox(
        'error',
        'Update Failed',
        formatSupabaseError(err, 'Could not update feature permission.')
      );
    } finally {
      setBusyId(null);
    }
  };

  const openSchoolDashboard = (school: SchoolRecord) => {
    try {
      window.localStorage.setItem('schoolgrid_active_school_id', school.school_id);
    } catch {
      // Ignore storage errors
    }
    navigate('/school-dashboard');
  };

  const openCreateModal = () => {
    setEditingSchool(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (school: SchoolRecord) => {
    setEditingSchool(school);
    setFormData({
      school_title: school.school_title || '',
      school_manager: school.school_manager || '',
      school_type: school.school_type || 'Senior Secondary',
      schoole_gmail: school.schoole_gmail || '',
      is_private: Boolean(school.is_private),
      is_active: isSchoolActive(school),
      is_approved: Boolean(school.is_approved),
      is_gdrive_allowed: Boolean(school.is_gdrive_allowed),
      is_import_export_allowed: Boolean(school.is_import_export_allowed),
      allowed_count_wing: Number(school.allowed_count_wing ?? 7),
      is_email_service: Boolean(school.is_email_service),
      is_collaburation_allowed: Boolean(school.is_collaburation_allowed),
      primery_fee: Number(school.primery_fee ?? 450),
      secondary_fee: Number(school.secondary_fee ?? 550),
      senior_secondary_fee: Number(school.senior_secondary_fee ?? 750),
      total_class: Number(school.total_class ?? 0),
      is_computer_lab: Boolean(school.is_computer_lab),
      is_library: Boolean(school.is_library),
      youtub_link: school.youtub_link || '',
      insta_link: school.insta_link || '',
      facebook_link: school.facebook_link || '',
      loc_state: school.loc_state || '',
      loc_district: school.loc_district || '',
      loc_city_village: school.loc_city_village || '',
      local_address: school.local_address || '',
      user_uuid: school.user_uuid || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingSchool(null);
    setFormData(EMPTY_FORM);
  };

  const handleSaveSchool = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.school_title.trim()) {
      showMessageBox('error', 'Validation Error', 'School title is required.');
      return;
    }

    setSaving(true);
    const supabase = SupaBaseClientFunction();

    const dbPayload = {
      school_title: formData.school_title.trim(),
      school_manager: formData.school_manager.trim() || null,
      school_type: formData.school_type || 'Senior Secondary',
      schoole_gmail: formData.schoole_gmail.trim() || null,
      is_private: Boolean(formData.is_private),
      is_approved: Boolean(formData.is_approved),
      is_gdrive_allowed: Boolean(formData.is_gdrive_allowed),
      is_import_export_allowed: Boolean(formData.is_import_export_allowed),
      allowed_count_wing: Number(formData.allowed_count_wing) || 7,
      is_email_service: Boolean(formData.is_email_service),
      is_collaburation_allowed: Boolean(formData.is_collaburation_allowed),
      primery_fee: Number(formData.primery_fee) || 450,
      secondary_fee: Number(formData.secondary_fee) || 550,
      senior_secondary_fee: Number(formData.senior_secondary_fee) || 750,
      total_class: Number(formData.total_class) || 0,
      is_computer_lab: Boolean(formData.is_computer_lab),
      is_library: Boolean(formData.is_library),
      youtub_link: formData.youtub_link.trim() || null,
      insta_link: formData.insta_link.trim() || null,
      facebook_link: formData.facebook_link.trim() || null,
      loc_state: formData.loc_state.trim() || null,
      loc_district: formData.loc_district.trim() || null,
      loc_city_village: formData.loc_city_village.trim() || null,
      local_address: formData.local_address.trim() || null,
      user_uuid: formData.user_uuid.trim() || null,
    };

    try {
      if (editingSchool) {
        const { data, error: updateError } = await supabase
          .from('OurSchools')
          .update(dbPayload)
          .eq('school_id', editingSchool.school_id)
          .select();

        if (updateError) throw updateError;
        if (!data || data.length === 0) {
          throw new Error(
            'No row was updated. Check your Supabase RLS UPDATE policy on OurSchools.'
          );
        }

        const updatedRow = data[0] as SchoolRecord;
        setSchools((prev) =>
          prev.map((item) => (item.school_id === updatedRow.school_id ? updatedRow : item))
        );

        updateInactiveIds((prev) => {
          const without = prev.filter((id) => id !== updatedRow.school_id);
          return formData.is_active ? without : [...without, updatedRow.school_id];
        });

        showMessageBox('success', 'School Updated', `"${updatedRow.school_title}" has been saved.`);
      } else {
        const { data, error: insertError } = await supabase
          .from('OurSchools')
          .insert([dbPayload])
          .select();

        if (insertError) throw insertError;
        const createdRow = data?.[0] as SchoolRecord | undefined;
        if (createdRow) {
          setSchools((prev) =>
            prev.some((item) => item.school_id === createdRow.school_id)
              ? prev
              : [createdRow, ...prev]
          );

          if (!formData.is_active) {
            updateInactiveIds((prev) =>
              prev.includes(createdRow.school_id) ? prev : [...prev, createdRow.school_id]
            );
          }
        }
        showMessageBox('success', 'School Created', `"${dbPayload.school_title}" has been added.`);
      }

      setModalOpen(false);
      setEditingSchool(null);
      setFormData(EMPTY_FORM);
    } catch (err: unknown) {
      showMessageBox(
        'error',
        'Save Failed',
        formatSupabaseError(err, 'Could not save school.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (school: SchoolRecord) => {
    const currentlyActive = isSchoolActive(school);
    const nextActive = !currentlyActive;

    updateInactiveIds((prev) => {
      const without = prev.filter((id) => id !== school.school_id);
      return nextActive ? without : [...without, school.school_id];
    });

    showMessageBox(
      'success',
      nextActive ? 'School Activated' : 'School Deactivated',
      `"${school.school_title || 'School'}" is now ${nextActive ? 'Active' : 'Inactive'}.`
    );
  };

  const requestDeleteOne = (school: SchoolRecord) => {
    setConfirmDialog({
      title: 'Delete School',
      message: `Are you sure you want to permanently delete "${school.school_title || 'this school'}"? This action cannot be undone.`,
      confirmLabel: 'Delete School',
      tone: 'danger',
      onConfirm: async () => {
        setBusyId(school.school_id);
        const supabase = SupaBaseClientFunction();
        try {
          const { error: deleteError } = await supabase
            .from('OurSchools')
            .delete()
            .eq('school_id', school.school_id);

          if (deleteError) throw deleteError;

          setSchools((prev) => prev.filter((item) => item.school_id !== school.school_id));
          setSelectedIds((prev) => prev.filter((id) => id !== school.school_id));
          updateInactiveIds((prev) => prev.filter((id) => id !== school.school_id));
          showMessageBox(
            'success',
            'School Deleted',
            `"${school.school_title || 'School'}" was removed.`
          );
        } catch (err: unknown) {
          showMessageBox(
            'error',
            'Delete Failed',
            err instanceof Error ? err.message : 'Could not delete school.'
          );
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handleBulkStatusChange = (nextActive: boolean) => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    updateInactiveIds((prev) => {
      const remaining = prev.filter((id) => !selectedSet.has(id));
      return nextActive ? remaining : [...remaining, ...selectedIds];
    });
    showMessageBox(
      'success',
      nextActive ? 'Schools Activated' : 'Schools Deactivated',
      `${selectedIds.length} selected school(s) marked as ${nextActive ? 'Active' : 'Inactive'}.`
    );
  };

  const requestBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: 'Delete Selected Schools',
      message: `Are you sure you want to permanently delete ${selectedIds.length} selected school(s)? This action cannot be undone.`,
      confirmLabel: `Delete (${selectedIds.length})`,
      tone: 'danger',
      onConfirm: async () => {
        setBulkBusy(true);
        const supabase = SupaBaseClientFunction();
        try {
          const { error: bulkDeleteError } = await supabase
            .from('OurSchools')
            .delete()
            .in('school_id', selectedIds);
          if (bulkDeleteError) throw bulkDeleteError;
          const deletedSet = new Set(selectedIds);
          const deletedCount = selectedIds.length;
          setSchools((prev) => prev.filter((item) => !deletedSet.has(item.school_id)));
          updateInactiveIds((prev) => prev.filter((id) => !deletedSet.has(id)));
          setSelectedIds([]);
          showMessageBox(
            'success',
            'Schools Deleted',
            `${deletedCount} selected school(s) have been deleted.`
          );
        } catch (err: unknown) {
          showMessageBox(
            'error',
            'Bulk Delete Failed',
            err instanceof Error ? err.message : 'Could not delete selected schools.'
          );
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const executeConfirmDialog = async () => {
    if (!confirmDialog?.onConfirm || confirmRunning) return;
    setConfirmRunning(true);
    try {
      await confirmDialog.onConfirm();
    } finally {
      setConfirmRunning(false);
      setConfirmDialog(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading schools...</div>;
  }

  if (error) {
    return (
      <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Error loading schools: {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {msgBox && (
        <div
          role="alert"
          className={`fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-xl border p-4 shadow-lg ${
            msgBox.type === 'success'
              ? 'border-emerald-200 bg-white text-slate-900'
              : msgBox.type === 'error'
                ? 'border-rose-200 bg-white text-slate-900'
                : 'border-blue-200 bg-white text-slate-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{msgBox.title}</p>
              <p className="mt-0.5 text-xs text-slate-600">{msgBox.text}</p>
            </div>
            <button
              type="button"
              onClick={() => setMsgBox(null)}
              aria-label="Dismiss notification"
              className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">{confirmDialog.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{confirmDialog.message}</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={confirmRunning}
                onClick={() => setConfirmDialog(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmRunning}
                onClick={executeConfirmDialog}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 cursor-pointer ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmRunning ? 'Processing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Our Schools &amp; Feature Controls</h1>
          <p className="text-sm text-slate-500 tabular-nums">
            Showing {filteredSchools.length} of {schools.length} schools · SuperAdmin feature flags
            (Google Drive, Import/Export, Email, Collaboration)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Reset Filters
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
          >
            + Add School
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="school-search" className="mb-1 block text-xs font-medium text-slate-600">
            Search
          </label>
          <input
            id="school-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by school name, manager, email, or address..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="state-filter" className="mb-1 block text-xs font-medium text-slate-600">
            State
          </label>
          <select
            id="state-filter"
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All States</option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="district-filter"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            District
          </label>
          <select
            id="district-filter"
            value={selectedDistrict}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Districts</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="village-filter" className="mb-1 block text-xs font-medium text-slate-600">
            City / Village
          </label>
          <select
            id="village-filter"
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Cities / Villages</option>
            {villageOptions.map((village) => (
              <option key={village} value={village}>
                {village}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 sm:col-span-2 lg:col-span-5">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { key: 'ALL', label: 'All Types' },
              { key: 'PRIVATE', label: 'Private' },
              { key: 'PUBLIC', label: 'Non-Private' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSchoolType(tab.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  schoolType === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { key: 'ALL', label: 'All Status' },
              { key: 'ACTIVE', label: 'Active' },
              { key: 'INACTIVE', label: 'Inactive' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleSelectAllFiltered}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span>Select Filtered ({selectedIds.length} selected)</span>
        </label>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkStatusChange(true)}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
            >
              Activate Selected
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkStatusChange(false)}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 cursor-pointer"
            >
              Deactivate Selected
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={requestBulkDelete}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 cursor-pointer"
            >
              Delete Selected
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setSelectedIds([])}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Schools Grid */}
      {filteredSchools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No schools match your current search or filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredSchools.map((school) => {
            const isSelected = selectedIds.includes(school.school_id);
            const active = isSchoolActive(school);
            const isRowBusy = busyId === school.school_id;

            return (
              <article
                key={school.school_id}
                className={`flex flex-col justify-between rounded-xl border bg-white p-5 transition-colors ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'
                } ${!active ? 'bg-slate-50/70' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(school.school_id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          {school.school_title || 'Untitled School'}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {school.school_type || 'School'} ·{' '}
                          {school.is_private ? 'Private' : 'Non-Private'} ·{' '}
                          <span className={active ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </p>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => openSchoolDashboard(school)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                    >
                      Open Panel
                    </button>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-700">Manager:</span>{' '}
                      {school.school_manager || '—'} ·{' '}
                      <span className="font-semibold text-slate-700">Email:</span>{' '}
                      {school.schoole_gmail || '—'}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Location:</span>{' '}
                      {[school.loc_city_village, school.loc_district, school.loc_state]
                        .filter(Boolean)
                        .join(', ') || 'Not specified'}
                    </p>
                    <p className="font-mono tabular-nums">
                      Wings: {school.allowed_count_wing ?? 7} · Classes: {school.total_class ?? 0} ·
                      Fees: ₹{school.primery_fee ?? 450} / ₹{school.secondary_fee ?? 550} / ₹
                      {school.senior_secondary_fee ?? 750}
                    </p>
                  </div>

                  {/* SuperAdmin-only Feature Flag Controls */}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-2 text-[11px] font-semibold text-slate-500">
                      SuperAdmin Feature Controls (Click to toggle ON / OFF)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FEATURE_CONTROLS.map(({ key, label }) => {
                        const enabled = Boolean(school[key]);
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={isRowBusy}
                            aria-pressed={enabled}
                            onClick={() => void handleToggleFeatureFlag(school, key, label)}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                              enabled
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {label}: {enabled ? 'ON' : 'OFF'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {school.created_at ? new Date(school.created_at).toLocaleDateString() : '—'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => handleToggleActive(school)}
                      className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                        active
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => openEditModal(school)}
                      className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => requestDeleteOne(school)}
                      className="rounded bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit School Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editingSchool ? 'Edit School & Feature Controls' : 'Add New School'}
            </h2>

            <form onSubmit={handleSaveSchool} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    School Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.school_title}
                    onChange={(e) => setFormData({ ...formData, school_title: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    School Manager
                  </label>
                  <input
                    type="text"
                    value={formData.school_manager}
                    onChange={(e) => setFormData({ ...formData, school_manager: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    School Type
                  </label>
                  <select
                    value={formData.school_type}
                    onChange={(e) => setFormData({ ...formData, school_type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Senior Secondary">Senior Secondary</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    School Email (schoole_gmail)
                  </label>
                  <input
                    type="email"
                    value={formData.schoole_gmail}
                    onChange={(e) => setFormData({ ...formData, schoole_gmail: e.target.value })}
                    placeholder="school@gmail.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    value={formData.loc_state}
                    onChange={(e) => setFormData({ ...formData, loc_state: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    District
                  </label>
                  <input
                    type="text"
                    value={formData.loc_district}
                    onChange={(e) => setFormData({ ...formData, loc_district: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    City / Village
                  </label>
                  <input
                    type="text"
                    value={formData.loc_city_village}
                    onChange={(e) =>
                      setFormData({ ...formData, loc_city_village: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Primary Fee
                  </label>
                  <input
                    type="number"
                    value={formData.primery_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, primery_fee: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Secondary Fee
                  </label>
                  <input
                    type="number"
                    value={formData.secondary_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, secondary_fee: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Sr. Sec Fee
                  </label>
                  <input
                    type="number"
                    value={formData.senior_secondary_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, senior_secondary_fee: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Allowed Wings
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.allowed_count_wing}
                    onChange={(e) =>
                      setFormData({ ...formData, allowed_count_wing: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 space-y-2.5">
                <p className="text-xs font-bold text-slate-800">
                  SuperAdmin-Only Feature Permissions
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm text-slate-700">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_approved}
                      onChange={(e) => setFormData({ ...formData, is_approved: e.target.checked })}
                    />
                    Payment Approved (Dashboard Unlocked)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_gdrive_allowed}
                      onChange={(e) =>
                        setFormData({ ...formData, is_gdrive_allowed: e.target.checked })
                      }
                    />
                    Google Drive Allowed
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_import_export_allowed}
                      onChange={(e) =>
                        setFormData({ ...formData, is_import_export_allowed: e.target.checked })
                      }
                    />
                    Import / Export CSV Allowed
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_email_service}
                      onChange={(e) =>
                        setFormData({ ...formData, is_email_service: e.target.checked })
                      }
                    />
                    Email Service Allowed
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_collaburation_allowed}
                      onChange={(e) =>
                        setFormData({ ...formData, is_collaburation_allowed: e.target.checked })
                      }
                    />
                    Collaboration Workspace Allowed
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_private}
                      onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
                    />
                    Private Institution
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingSchool ? 'Save Changes' : 'Create School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}