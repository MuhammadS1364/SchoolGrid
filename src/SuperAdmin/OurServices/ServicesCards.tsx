import { Check } from 'lucide-react';
import type { ServicePlanRecord } from '../../lib/SupaBaseClient/mockSupabase';
import {
  deriveEntitlementsFromFeatureList,
  parseFeatureList,
} from '../../lib/services/planEntitlements';

interface ServicesCardsProps {
  plans: ServicePlanRecord[];
  mode: 'public' | 'admin';
  onSelectPlan?: (plan: ServicePlanRecord) => void;
  onEditPlan?: (plan: ServicePlanRecord) => void;
  onToggleActive?: (plan: ServicePlanRecord) => void;
  onDeletePlan?: (plan: ServicePlanRecord) => void;
}

export default function ServicesCards({
  plans,
  mode,
  onSelectPlan,
  onEditPlan,
  onToggleActive,
  onDeletePlan,
}: ServicesCardsProps) {
  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No service plans available yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const features = parseFeatureList(plan.feature_list);
        const entitlements = deriveEntitlementsFromFeatureList(plan.feature_list);

        return (
          <article
            key={plan.service_id}
            className={`flex flex-col justify-between rounded-xl border bg-white p-6 transition-colors ${
              plan.is_active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 opacity-75'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  {plan.service_title}
                </h3>
                {mode === 'admin' && (
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      plan.is_active ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>

              {plan.service_dec && (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.service_dec}</p>
              )}

              <div className="mt-5 flex items-baseline gap-1.5 border-y border-slate-100 py-4">
                <span className="font-mono text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  ₹{Number(plan.service_charge ?? 0).toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-medium text-slate-500">/ month</span>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                <span>Wings: {entitlements.allowed_count_wing}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>Drive: {entitlements.is_gdrive_allowed ? 'Yes' : 'No'}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>Import/Export: {entitlements.is_import_export_allowed ? 'Yes' : 'No'}</span>
              </div>

              {features.length > 0 && (
                <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                  {features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              {mode === 'public' ? (
                <button
                  type="button"
                  onClick={() => onSelectPlan?.(plan)}
                  className="h-11 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Select Plan
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleActive?.(plan)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {plan.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditPlan?.(plan)}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePlan?.(plan)}
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
