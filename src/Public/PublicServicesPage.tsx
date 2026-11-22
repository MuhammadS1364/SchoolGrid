import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Search, XCircle } from 'lucide-react';
import SupaBaseClientFunction from '../lib/SupaBaseClient/SupaBaseClientFunction';
import type {
  ServiceHolderRecord,
  ServicePlanRecord,
} from '../lib/SupaBaseClient/mockSupabase';
import {
  applyRealtimeChange,
  useRealtimeTables,
} from '../lib/realtime/useRealtimeTable';
import ServicesCards from '../SuperAdmin/OurServices/ServicesCards';
import NewServicesHolderForm from '../SuperAdmin/OurServices/NewServicesHolderForm';

const LAST_HOLDER_STORAGE_KEY = 'schoolgrid_last_holder_id';

export default function PublicServicesPage() {
  const [plans, setPlans] = useState<ServicePlanRecord[]>([]);
  const [holders, setHolders] = useState<ServiceHolderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlanRecord | null>(null);
  const [lookupEmail, setLookupEmail] = useState('');
  const [activeHolderId, setActiveHolderId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(LAST_HOLDER_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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
        const allPlans = (plansRes.data as ServicePlanRecord[]) || [];
        setPlans(allPlans.filter((p) => p.is_active !== false));
      }
      if (!holdersRes.error) {
        setHolders((holdersRes.data as ServiceHolderRecord[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeTables(
    'public-services-realtime',
    [
      {
        table: 'OurServicesBook',
        onChange: (payload) => {
          setPlans((prev) =>
            applyRealtimeChange(prev, payload, 'service_id', {
              filter: (p) => p.is_active !== false,
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
    { onResync: () => void loadData() }
  );

  const activeHolder = holders.find((h) => h.holder_id === activeHolderId) ?? null;

  const handleSubmittedHolder = (holder: ServiceHolderRecord) => {
    setSelectedPlan(null);
    setHolders((prev) => [holder, ...prev.filter((h) => h.holder_id !== holder.holder_id)]);
    setActiveHolderId(holder.holder_id);
    setLookupEmail(holder.holder_email ?? '');
    setLookupNotice(null);
    try {
      window.localStorage.setItem(LAST_HOLDER_STORAGE_KEY, holder.holder_id);
    } catch {
      // Ignore storage errors
    }
  };

  const handleLookup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = lookupEmail.trim().toLowerCase();
    if (!query) return;
    const found = holders.find(
      (h) => (h.holder_email ?? '').trim().toLowerCase() === query
    );
    if (found) {
      setActiveHolderId(found.holder_id);
      setLookupNotice(null);
      try {
        window.localStorage.setItem(LAST_HOLDER_STORAGE_KEY, found.holder_id);
      } catch {
        // Ignore storage errors
      }
    } else {
      setLookupNotice('No service request found for that email address.');
    }
  };

  const getPlanTitle = (serviceId?: string | null) =>
    plans.find((p) => p.service_id === serviceId)?.service_title ?? 'Selected Plan';

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      {/* 3-Zone Top Bar */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SchoolGrid
          </Link>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#plans"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Plans
            </a>
            <a
              href="#status"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Approval Status
            </a>
            <Link
              to="/super-admin-dashboard/services"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              SuperAdmin Approvals
            </Link>
            <Link
              to="/school-dashboard"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              School Panel
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Hero */}
        <section className="max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl text-balance">
            Choose a SchoolGrid Plan for Your Institution
          </h1>
          <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-slate-600">
            Select a service plan below, submit your billing holder details, and wait for SuperAdmin
            payment verification. Once approved, your School Registration Form opens immediately to
            launch your dedicated School Dashboard.
          </p>
        </section>

        {/* Active Request Status Banner */}
        {activeHolder && (
          <section
            aria-label="Current purchase request status"
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {activeHolder.status === 'pending_approval' && (
                    <>
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Waiting for SuperAdmin Payment Approval</span>
                    </>
                  )}
                  {activeHolder.status === 'approved' && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Payment Approved — Ready for School Registration</span>
                    </>
                  )}
                  {activeHolder.status === 'school_registered' && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                      <span>School Registered &amp; Active</span>
                    </>
                  )}
                  {activeHolder.status === 'rejected' && (
                    <>
                      <XCircle className="h-4 w-4 text-rose-600" />
                      <span>Request Rejected</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {activeHolder.holder_fullname} · {activeHolder.holder_email} ·{' '}
                  {getPlanTitle(activeHolder.service_id)} ({activeHolder.plain_type}) ·{' '}
                  {activeHolder.payment_method}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {activeHolder.status === 'pending_approval' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void loadData()}
                      className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Refresh Status
                    </button>
                    <Link
                      to="/super-admin-dashboard/services"
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Review in SuperAdmin
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}

                {activeHolder.status === 'approved' && (
                  <Link
                    to={`/register-school/${activeHolder.holder_id}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Open School Registration Form
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}

                {activeHolder.status === 'school_registered' && (
                  <Link
                    to="/school-dashboard"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Go to School Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Service Plans Catalog */}
        <section id="plans" className="space-y-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Service Plans &amp; Capabilities
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Feature entitlements included in each plan are provisioned and governed by SuperAdmin.
              </p>
            </div>
            <p className="text-xs text-slate-500 tabular-nums">
              {plans.length} active plans available
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white p-6"
                />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                No active plans published in OurServicesBook yet.
              </p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                SuperAdmin can add custom service tiers or publish the starter catalog from the
                Services &amp; Approvals console.
              </p>
              <Link
                to="/super-admin-dashboard/services"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Manage Plans in SuperAdmin
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ServicesCards
              plans={plans}
              mode="public"
              onSelectPlan={(plan) => setSelectedPlan(plan)}
            />
          )}
        </section>

        {/* Lookup Existing Request */}
        <section id="status" className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">
            Already Submitted a Service Request?
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Check your SuperAdmin approval status by email to unlock your School Registration Form.
          </p>

          <form onSubmit={handleLookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:max-w-lg">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="Enter holder email address..."
                required
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              Check Status
            </button>
          </form>

          {lookupNotice && <p className="mt-3 text-sm text-rose-600">{lookupNotice}</p>}
        </section>
      </main>

      {selectedPlan && (
        <NewServicesHolderForm
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSubmitted={handleSubmittedHolder}
        />
      )}
    </div>
  );
}
