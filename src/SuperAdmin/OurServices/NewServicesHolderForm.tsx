import { useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import SupaBaseClientFunction, {
  formatSupabaseError,
} from '../../lib/SupaBaseClient/SupaBaseClientFunction';
import type {
  ServiceHolderRecord,
  ServicePlanRecord,
} from '../../lib/SupaBaseClient/mockSupabase';
import {
  computePlanEndDate,
  computeTotalCharge,
  type PlanDurationType,
} from '../../lib/services/planEntitlements';

interface NewServicesHolderFormProps {
  plan: ServicePlanRecord;
  onClose: () => void;
  onSubmitted: (holder: ServiceHolderRecord) => void;
}

const PAYMENT_METHODS = ['UPI', 'Bank Transfer', 'Card', 'Cheque'] as const;
const PLAN_TYPES: PlanDurationType[] = ['Monthly', 'Quarterly', 'Yearly'];

export default function NewServicesHolderForm({
  plan,
  onClose,
  onSubmitted,
}: NewServicesHolderFormProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [holderFullname, setHolderFullname] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [holderContact, setHolderContact] = useState('');
  const [plainType, setPlainType] = useState<PlanDurationType>('Yearly');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [startedAt, setStartedAt] = useState<string>(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endAt = useMemo(
    () => computePlanEndDate(startedAt, plainType),
    [startedAt, plainType]
  );

  const totalCharge = useMemo(
    () => computeTotalCharge(plan.service_charge, plainType),
    [plan.service_charge, plainType]
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!holderFullname.trim() || !holderEmail.trim() || !holderContact.trim()) {
      setError('Please complete your full name, email address, and contact number.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = SupaBaseClientFunction();
      const payload = {
        started_at: startedAt,
        end_at: endAt,
        payment_method: paymentMethod,
        is_active: true,
        status: 'pending_approval',
        plain_type: plainType,
        holder_fullname: holderFullname.trim(),
        holder_email: holderEmail.trim(),
        holder_contact: holderContact.trim(),
        service_id: plan.service_id,
        school_id: null,
      };

      const { data, error: insertError } = await supabase
        .from('OurServiceHolder')
        .insert([payload])
        .select();

      if (insertError) throw insertError;
      const created = (data?.[0] as ServiceHolderRecord | undefined) ?? {
        holder_id: `hld-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...payload,
      };

      onSubmitted(created);
    } catch (err: unknown) {
      setError(formatSupabaseError(err, 'Failed to submit service request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="holder-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="holder-form-title" className="text-lg font-bold text-slate-900">
              Purchase {plan.service_title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Submit your plan holder details. After SuperAdmin verifies payment, your School
              Registration Form unlocks automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close purchase form"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="holder_fullname"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Holder Full Name *
            </label>
            <input
              id="holder_fullname"
              type="text"
              required
              value={holderFullname}
              onChange={(e) => setHolderFullname(e.target.value)}
              placeholder="e.g. Dr. Ramesh Gupta"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="holder_email"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Holder Email *
              </label>
              <input
                id="holder_email"
                type="email"
                required
                value={holderEmail}
                onChange={(e) => setHolderEmail(e.target.value)}
                placeholder="principal@school.edu"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="holder_contact"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Contact Number *
              </label>
              <input
                id="holder_contact"
                type="tel"
                required
                value={holderContact}
                onChange={(e) => setHolderContact(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="plain_type"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Plan Billing Cycle
              </label>
              <select
                id="plain_type"
                value={plainType}
                onChange={(e) => setPlainType(e.target.value as PlanDurationType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {PLAN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="payment_method"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Payment Method
              </label>
              <select
                id="payment_method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="started_at"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Start Date
              </label>
              <input
                id="started_at"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="end_at" className="mb-1 block text-xs font-semibold text-slate-700">
                End Date (Auto)
              </label>
              <input
                id="end_at"
                type="date"
                value={endAt}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-600 tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs text-slate-500">Total Payable ({plainType})</p>
              <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                ₹{totalCharge.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Purchase Request'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
