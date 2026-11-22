import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Plus, X } from 'lucide-react';
import SupaBaseClientFunction, {
  formatSupabaseError,
} from '../../lib/SupaBaseClient/SupaBaseClientFunction';
import {
  DEFAULT_SERVICES,
  type ServiceHolderRecord,
  type ServicePlanRecord,
} from '../../lib/SupaBaseClient/mockSupabase';
import {
  applyRealtimeChange,
  useRealtimeTables,
} from '../../lib/realtime/useRealtimeTable';
import ServicesCards from './ServicesCards';

interface PlanFormState {
  service_title: string;
  service_dec: string;
  feature_list: string;
  service_charge: number;
  is_active: boolean;
}

const EMPTY_PLAN_FORM: PlanFormState = {
  service_title: '',
  service_dec: '',
  feature_list: 'Up to 7 Wings, Student & Teacher CRUD, Class Management',
  service_charge: 750,
  is_active: true,
};

export default function AllServicesInfo() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'plans'>('approvals');
  const [plans, setPlans] = useState<ServicePlanRecord[]>([]);
  const [holders, setHolders] = useState<ServiceHolderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Plan modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ServicePlanRecord | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(EMPTY_PLAN_FORM);
  const [savingPlan, setSavingPlan] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = SupaBaseClientFunction();
      const [plansRes, holdersRes] = await Promise.all([
        supabase
          .from('OurServicesBook')
          .select('*')
          .order('service_charge', { ascending: true }),
        supabase
          .from('OurServiceHolder')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (!plansRes.error) {
        setPlans((plansRes.data as ServicePlanRecord[]) || []);
      }
      if (!holdersRes.error) {
        setHolders((holdersRes.data as ServiceHolderRecord[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useRealtimeTables(
    'superadmin-services-realtime',
    [
      {
        table: 'OurServicesBook',
        onChange: (payload) => {
          setPlans((prev) =>
            applyRealtimeChange(prev, payload, 'service_id', {
              sort: (a, b) => Number(a.service_charge ?? 0) - Number(b.service_charge ?? 0),
            })
          );
        },
      },
      {
        table: 'OurServiceHolder',
        onChange: (payload) => {
          setHolders((prev) =>
            applyRealtimeChange(prev, payload, 'holder_id', {
              sort: (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
            })
          );
        },
      },
    ],
    { onResync: () => void loadAll() }
  );

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleHolderStatus = async (
    holder: ServiceHolderRecord,
    nextStatus: 'approved' | 'rejected'
  ) => {
    const supabase = SupaBaseClientFunction();
    const { data, error } = await supabase
      .from('OurServiceHolder')
      .update({ status: nextStatus })
      .eq('holder_id', holder.holder_id)
      .select();

    if (error) {
      showNotice('error', error.message || 'Could not update request status.');
      return;
    }

    const updated = (data?.[0] as ServiceHolderRecord | undefined) ?? {
      ...holder,
      status: nextStatus,
    };
    setHolders((prev) =>
      prev.map((item) => (item.holder_id === updated.holder_id ? updated : item))
    );
    showNotice(
      'success',
      nextStatus === 'approved'
        ? `Approved payment for ${holder.holder_fullname}. School Registration Form is now unlocked.`
        : `Rejected service request for ${holder.holder_fullname}.`
    );
  };

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm(EMPTY_PLAN_FORM);
    setPlanModalOpen(true);
  };

  const openEditPlan = (plan: ServicePlanRecord) => {
    setEditingPlan(plan);
    setPlanForm({
      service_title: plan.service_title,
      service_dec: plan.service_dec ?? '',
      feature_list: plan.feature_list ?? '',
      service_charge: Number(plan.service_charge ?? 750),
      is_active: plan.is_active !== false,
    });
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!planForm.service_title.trim()) return;

    setSavingPlan(true);
    const supabase = SupaBaseClientFunction();
    const payload = {
      service_title: planForm.service_title.trim(),
      service_dec: planForm.service_dec.trim() || null,
      feature_list: planForm.feature_list.trim() || null,
      service_charge: Number(planForm.service_charge) || 750,
      is_active: planForm.is_active,
    };

    try {
      if (editingPlan) {
        const { data, error } = await supabase
          .from('OurServicesBook')
          .update(payload)
          .eq('service_id', editingPlan.service_id)
          .select();
        if (error) throw error;
        const updated = data?.[0] as ServicePlanRecord | undefined;
        if (updated) {
          setPlans((prev) =>
            prev.map((p) => (p.service_id === updated.service_id ? updated : p))
          );
        }
        showNotice('success', `Updated plan "${payload.service_title}".`);
      } else {
        const { data, error } = await supabase
          .from('OurServicesBook')
          .insert([payload])
          .select();
        if (error) throw error;
        const created = data?.[0] as ServicePlanRecord | undefined;
        if (created) {
          setPlans((prev) => [...prev, created]);
        }
        showNotice('success', `Created plan "${payload.service_title}".`);
      }
      setPlanModalOpen(false);
    } catch (err: unknown) {
      showNotice('error', formatSupabaseError(err, 'Failed to save plan.'));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleTogglePlanActive = async (plan: ServicePlanRecord) => {
    const supabase = SupaBaseClientFunction();
    const nextActive = !plan.is_active;
    const { error } = await supabase
      .from('OurServicesBook')
      .update({ is_active: nextActive })
      .eq('service_id', plan.service_id)
      .select();

    if (error) {
      showNotice('error', error.message);
      return;
    }
    setPlans((prev) =>
      prev.map((p) => (p.service_id === plan.service_id ? { ...p, is_active: nextActive } : p))
    );
    showNotice(
      'success',
      `"${plan.service_title}" is now ${nextActive ? 'Active' : 'Inactive'}.`
    );
  };

  const handleDeletePlan = async (plan: ServicePlanRecord) => {
    const supabase = SupaBaseClientFunction();
    const { error } = await supabase
      .from('OurServicesBook')
      .delete()
      .eq('service_id', plan.service_id);
    if (error) {
      showNotice('error', error.message);
      return;
    }
    setPlans((prev) => prev.filter((p) => p.service_id !== plan.service_id));
    showNotice('success', `Deleted plan "${plan.service_title}".`);
  };

  const handleSeedStarterPlans = async () => {
    setSavingPlan(true);
    const supabase = SupaBaseClientFunction();
    try {
      const payloads = DEFAULT_SERVICES.map(
        ({ service_title, service_dec, feature_list, service_charge, is_active }) => ({
          service_title,
          service_dec,
          feature_list,
          service_charge,
          is_active,
        })
      );
      const { data, error } = await supabase
        .from('OurServicesBook')
        .insert(payloads)
        .select();
      if (error) throw error;
      const inserted = ((data as ServicePlanRecord[]) || []).sort(
        (a, b) => Number(a.service_charge ?? 0) - Number(b.service_charge ?? 0)
      );
      setPlans(inserted);
      setActiveTab('plans');
      showNotice(
        'success',
        `Published ${inserted.length} starter service plans to OurServicesBook.`
      );
    } catch (err: unknown) {
      showNotice('error', formatSupabaseError(err, 'Could not publish starter plans.'));
    } finally {
      setSavingPlan(false);
    }
  };

  const pendingCount = holders.filter((h) => h.status === 'pending_approval').length;
  const filteredHolders = holders.filter(
    (h) => statusFilter === 'ALL' || h.status === statusFilter
  );

  const getPlanName = (serviceId?: string | null) =>
    plans.find((p) => p.service_id === serviceId)?.service_title ?? '—';

  const formatStatusLabel = (status?: string | null) => {
    switch (status) {
      case 'pending_approval':
        return 'Pending Approval';
      case 'approved':
        return 'Approved';
      case 'school_registered':
        return 'School Registered';
      case 'rejected':
        return 'Rejected';
      default:
        return status || 'Pending';
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Services &amp; Payment Approvals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage public plans in OurServicesBook and verify OurServiceHolder payments before
            schools register.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/services"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Public Plans Page
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {plans.length === 0 && !loading && (
            <button
              type="button"
              disabled={savingPlan}
              onClick={() => void handleSeedStarterPlans()}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              {savingPlan ? 'Publishing...' : 'Seed Starter Plans'}
            </button>
          )}
          <button
            type="button"
            onClick={openCreatePlan}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Service Plan
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'approvals'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Service Holder Approvals ({pendingCount} pending)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'plans'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Service Plans ({plans.length})
          </button>
        </div>

        {activeTab === 'approvals' && (
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'pending_approval', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'school_registered', label: 'Registered' },
              { id: 'rejected', label: 'Rejected' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === item.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading services and requests...
        </div>
      ) : activeTab === 'approvals' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Applicant / Holder</th>
                <th className="px-4 py-3">Service Plan</th>
                <th className="px-4 py-3">Payment &amp; Cycle</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHolders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No service holder requests in this category.
                  </td>
                </tr>
              ) : (
                filteredHolders.map((holder) => (
                  <tr key={holder.holder_id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {holder.holder_fullname || 'Unnamed'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {holder.holder_email || '—'} · {holder.holder_contact || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {getPlanName(holder.service_id)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <span>{holder.payment_method || '—'}</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span>{holder.plain_type || 'Monthly'}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                      {holder.started_at || '—'} → {holder.end_at || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-semibold ${
                          holder.status === 'pending_approval'
                            ? 'text-amber-700'
                            : holder.status === 'approved'
                              ? 'text-emerald-700'
                              : holder.status === 'school_registered'
                                ? 'text-indigo-700'
                                : 'text-rose-700'
                        }`}
                      >
                        {formatStatusLabel(holder.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {holder.status === 'pending_approval' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleHolderStatus(holder, 'approved')}
                              className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve Payment
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleHolderStatus(holder, 'rejected')}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer whitespace-nowrap"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                        {holder.status === 'approved' && (
                          <Link
                            to={`/register-school/${holder.holder_id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
                          >
                            School Form
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {holder.status === 'school_registered' && (
                          <Link
                            to="/super-admin-dashboard/schools"
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                          >
                            View School
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <ServicesCards
          plans={plans}
          mode="admin"
          onEditPlan={openEditPlan}
          onToggleActive={(plan) => void handleTogglePlanActive(plan)}
          onDeletePlan={(plan) => void handleDeletePlan(plan)}
        />
      )}

      {/* Create / Edit Service Plan Modal */}
      {planModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="plan-modal-title" className="text-lg font-bold text-slate-900">
              {editingPlan ? 'Edit Service Plan' : 'Create New Service Plan'}
            </h2>

            <form onSubmit={handleSavePlan} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="service_title"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Service Title *
                </label>
                <input
                  id="service_title"
                  type="text"
                  required
                  value={planForm.service_title}
                  onChange={(e) => setPlanForm({ ...planForm, service_title: e.target.value })}
                  placeholder="e.g. Enterprise Cloud Grid"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="service_dec"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="service_dec"
                  rows={2}
                  value={planForm.service_dec}
                  onChange={(e) => setPlanForm({ ...planForm, service_dec: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="feature_list"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Feature List (comma separated — parsed into school entitlements)
                </label>
                <textarea
                  id="feature_list"
                  rows={3}
                  value={planForm.feature_list}
                  onChange={(e) => setPlanForm({ ...planForm, feature_list: e.target.value })}
                  placeholder="Up to 15 Wings, Google Drive Integration, Import / Export CSV, Email Service, Collaboration Workspace"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="service_charge"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Monthly Charge (₹)
                  </label>
                  <input
                    id="service_charge"
                    type="number"
                    min={0}
                    required
                    value={planForm.service_charge}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, service_charge: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm tabular-nums"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={planForm.is_active}
                      onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    Active on Public Catalog
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  disabled={savingPlan}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
                >
                  {savingPlan ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
