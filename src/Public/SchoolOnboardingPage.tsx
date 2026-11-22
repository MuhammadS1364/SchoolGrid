import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Lock, ShieldCheck } from 'lucide-react';
import SupaBaseClientFunction, {
  formatSupabaseError,
} from '../lib/SupaBaseClient/SupaBaseClientFunction';
import type {
  SchoolRecord,
  ServiceHolderRecord,
  ServicePlanRecord,
} from '../lib/SupaBaseClient/mockSupabase';
import { isGmailAddress, ROLES } from '../lib/auth/roleResolver';
import { deriveEntitlementsFromFeatureList } from '../lib/services/planEntitlements';
import { useRealtimeTables } from '../lib/realtime/useRealtimeTable';

export default function SchoolOnboardingPage() {
  const { holderId } = useParams<{ holderId: string }>();
  const navigate = useNavigate();

  const [holder, setHolder] = useState<ServiceHolderRecord | null>(null);
  const [plan, setPlan] = useState<ServicePlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // School form fields
  const [schoolTitle, setSchoolTitle] = useState('');
  const [schoolManager, setSchoolManager] = useState('');
  const [schoolType, setSchoolType] = useState<'Primary' | 'Secondary' | 'Senior Secondary'>(
    'Senior Secondary'
  );
  const [isPrivate, setIsPrivate] = useState(true);
  const [schoolGmail, setSchoolGmail] = useState('');
  const [schoolPassword, setSchoolPassword] = useState('');
  const [locState, setLocState] = useState('');
  const [locDistrict, setLocDistrict] = useState('');
  const [locCityVillage, setLocCityVillage] = useState('');
  const [localAddress, setLocalAddress] = useState('');
  const [primeryFee, setPrimeryFee] = useState(450);
  const [secondaryFee, setSecondaryFee] = useState(550);
  const [seniorSecondaryFee, setSeniorSecondaryFee] = useState(750);
  const [totalClass, setTotalClass] = useState(12);
  const [isComputerLab, setIsComputerLab] = useState(true);
  const [isLibrary, setIsLibrary] = useState(true);
  const [youtubLink, setYoutubLink] = useState('');
  const [instaLink, setInstaLink] = useState('');
  const [facebookLink, setFacebookLink] = useState('');

  useEffect(() => {
    let active = true;
    async function loadHolder() {
      if (!holderId) {
        setLoading(false);
        return;
      }
      const supabase = SupaBaseClientFunction();
      const { data: holderData } = await supabase
        .from('OurServiceHolder')
        .select('*')
        .eq('holder_id', holderId)
        .maybeSingle();

      if (!active) return;

      const foundHolder = holderData as ServiceHolderRecord | null;
      setHolder(foundHolder);

      if (foundHolder) {
        setSchoolManager(foundHolder.holder_fullname ?? '');
        setSchoolGmail(foundHolder.holder_email ?? '');
        if (foundHolder.service_id) {
          const { data: planData } = await supabase
            .from('OurServicesBook')
            .select('*')
            .eq('service_id', foundHolder.service_id)
            .maybeSingle();
          if (active) {
            setPlan(planData as ServicePlanRecord | null);
          }
        }
      }
      setLoading(false);
    }

    void loadHolder();
    return () => {
      active = false;
    };
  }, [holderId]);

  useRealtimeTables(
    'school-onboarding-realtime',
    [
      {
        table: 'OurServiceHolder',
        filter: holderId ? `holder_id=eq.${holderId}` : undefined,
        onChange: (payload) => {
          const next = payload.new as ServiceHolderRecord | null | undefined;
          const old = payload.old as Partial<ServiceHolderRecord> | null | undefined;
          if (payload.eventType === 'DELETE' && old?.holder_id === holderId) {
            setHolder(null);
            return;
          }
          if (next && next.holder_id === holderId) {
            setHolder((prev) => (prev ? { ...prev, ...next } : next));
          }
        },
      },
      {
        table: 'OurServicesBook',
        onChange: (payload) => {
          const next = payload.new as ServicePlanRecord | null | undefined;
          if (next && holder?.service_id && next.service_id === holder.service_id) {
            setPlan((prev) => (prev ? { ...prev, ...next } : next));
          }
        },
      },
    ],
    { enabled: Boolean(holderId) }
  );

  const promisedFeatures = useMemo(
    () => deriveEntitlementsFromFeatureList(plan?.feature_list),
    [plan?.feature_list]
  );

  const emailIsGmail = isGmailAddress(schoolGmail);

  const handleRegisterSchool = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!holder) return;
    setError(null);

    if (!schoolTitle.trim() || !schoolGmail.trim()) {
      setError('School name and school email are required.');
      return;
    }

    if (!emailIsGmail && schoolPassword.trim().length < 6) {
      setError('Non-Gmail school accounts require a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = SupaBaseClientFunction();

      // Create auth user for non-Gmail school login; Gmail schools sign in via Google OAuth on /login
      let userUuid: string | null = null;
      if (!emailIsGmail) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: schoolGmail.trim(),
          password: schoolPassword,
          options: {
            data: {
              role: ROLES.SCHOOL,
              full_name: schoolManager.trim() || schoolTitle.trim(),
            },
          },
        });
        if (signUpErr) {
          const msg = signUpErr.message.toLowerCase();
          if (!msg.includes('already registered') && !msg.includes('already exists')) {
            throw signUpErr;
          }
        } else {
          userUuid = signUpData.user?.id ?? null;
        }
      }

      const schoolPayload = {
        school_title: schoolTitle.trim(),
        school_manager: schoolManager.trim() || null,
        is_private: isPrivate,
        loc_state: locState.trim() || null,
        loc_district: locDistrict.trim() || null,
        loc_city_village: locCityVillage.trim() || null,
        local_address: localAddress.trim() || null,
        user_uuid: userUuid,
        school_type: schoolType,
        schoole_gmail: schoolGmail.trim(),
        // Read-only entitlements inherited from approved plan (SuperAdmin controlled)
        is_gdrive_allowed: promisedFeatures.is_gdrive_allowed,
        is_import_export_allowed: promisedFeatures.is_import_export_allowed,
        allowed_count_wing: promisedFeatures.allowed_count_wing,
        is_email_service: promisedFeatures.is_email_service,
        is_collaburation_allowed: promisedFeatures.is_collaburation_allowed,
        primery_fee: Number(primeryFee) || 450,
        secondary_fee: Number(secondaryFee) || 550,
        senior_secondary_fee: Number(seniorSecondaryFee) || 750,
        youtub_link: youtubLink.trim() || null,
        insta_link: instaLink.trim() || null,
        facebook_link: facebookLink.trim() || null,
        total_class: Number(totalClass) || 0,
        is_computer_lab: isComputerLab,
        is_library: isLibrary,
        is_approved: true,
      };

      const { data: createdSchools, error: schoolErr } = await supabase
        .from('OurSchools')
        .insert([schoolPayload])
        .select();

      if (schoolErr) throw schoolErr;
      const createdSchool = createdSchools?.[0] as SchoolRecord | undefined;

      if (createdSchool) {
        await supabase
          .from('OurServiceHolder')
          .update({
            school_id: createdSchool.school_id,
            status: 'school_registered',
          })
          .eq('holder_id', holder.holder_id)
          .select();

        if (userUuid) {
          try {
            await supabase.from('school_user_profile').insert([
              {
                user_uuid: userUuid,
                full_name: schoolManager.trim() || schoolTitle.trim(),
                school_id: createdSchool.school_id,
                user_role: ROLES.SCHOOL,
                is_active: true,
              },
            ]);
          } catch {
            // Do not block onboarding if profile row already exists or RLS restricts anon inserts
          }
        }

        try {
          window.localStorage.setItem('schoolgrid_active_school_id', createdSchool.school_id);
        } catch {
          // Ignore storage errors
        }
      }

      navigate('/school-dashboard', { replace: true });
    } catch (err: unknown) {
      setError(formatSupabaseError(err, 'Could not complete school registration.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-sm text-slate-500">
        Verifying approval status...
      </div>
    );
  }

  if (!holder) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900">Service Request Not Found</h1>
          <p className="mt-2 text-sm text-slate-500">
            Select a plan from our Services catalog to begin onboarding.
          </p>
          <Link
            to="/services"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Browse Service Plans
          </Link>
        </div>
      </div>
    );
  }

  if (holder.status === 'pending_approval') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Waiting for SuperAdmin Approval</h1>
          <p className="text-sm text-slate-600">
            Your payment request ({holder.payment_method} · {holder.plain_type}) is currently under
            verification. Once SuperAdmin approves your payment, this School Registration Form will
            open automatically.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/super-admin-dashboard/services"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open SuperAdmin Approvals
            </Link>
            <Link
              to="/services"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (holder.status === 'school_registered') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">School Already Registered</h1>
          <p className="text-sm text-slate-600">
            This approved service subscription is already linked to your active School Dashboard.
          </p>
          <Link
            to="/school-dashboard"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open School Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Service Plans
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Payment Verified · {plan?.service_title ?? 'Approved Plan'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="border-b border-slate-100 pb-5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Complete School Registration
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Provide your institution details below to provision your dedicated School Dashboard.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleRegisterSchool} className="mt-6 space-y-8">
            {/* 1. Core Identity & Account */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900">1. School Identity &amp; Login</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="school_title"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    School Name *
                  </label>
                  <input
                    id="school_title"
                    type="text"
                    required
                    value={schoolTitle}
                    onChange={(e) => setSchoolTitle(e.target.value)}
                    placeholder="e.g. Oakridge International School"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="school_manager"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    School Manager / Principal
                  </label>
                  <input
                    id="school_manager"
                    type="text"
                    value={schoolManager}
                    onChange={(e) => setSchoolManager(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="school_type"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    School Type
                  </label>
                  <select
                    id="school_type"
                    value={schoolType}
                    onChange={(e) =>
                      setSchoolType(
                        e.target.value as 'Primary' | 'Secondary' | 'Senior Secondary'
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Senior Secondary">Senior Secondary</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    Private Institution
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="schoole_gmail"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    School Account Email (schoole_gmail) *
                  </label>
                  <input
                    id="schoole_gmail"
                    type="email"
                    required
                    value={schoolGmail}
                    onChange={(e) => setSchoolGmail(e.target.value)}
                    placeholder="school@gmail.com or admin@school.edu"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {emailIsGmail
                      ? 'Gmail detected: Google Auth will be used for login and Google Drive sync.'
                      : 'Non-Gmail account: Email & Password login enabled.'}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="school_password"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Account Password {emailIsGmail ? '(Optional for Gmail)' : '*'}
                  </label>
                  <input
                    id="school_password"
                    type="password"
                    required={!emailIsGmail}
                    value={schoolPassword}
                    onChange={(e) => setSchoolPassword(e.target.value)}
                    placeholder={emailIsGmail ? 'Google Auth handles sign-in' : 'Min. 6 characters'}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* 2. Location */}
            <section className="space-y-4 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-bold text-slate-900">2. Campus Location</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="loc_state" className="mb-1 block text-xs font-semibold text-slate-700">
                    State
                  </label>
                  <input
                    id="loc_state"
                    type="text"
                    value={locState}
                    onChange={(e) => setLocState(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="loc_district"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    District
                  </label>
                  <input
                    id="loc_district"
                    type="text"
                    value={locDistrict}
                    onChange={(e) => setLocDistrict(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="loc_city_village"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    City / Village
                  </label>
                  <input
                    id="loc_city_village"
                    type="text"
                    value={locCityVillage}
                    onChange={(e) => setLocCityVillage(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="local_address"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Local Address
                </label>
                <textarea
                  id="local_address"
                  rows={2}
                  value={localAddress}
                  onChange={(e) => setLocalAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
                />
              </div>
            </section>

            {/* 3. Fees, Facilities & Socials */}
            <section className="space-y-4 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-bold text-slate-900">
                3. Fee Structure, Facilities &amp; Social Links
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label
                    htmlFor="primery_fee"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Primary Fee (₹)
                  </label>
                  <input
                    id="primery_fee"
                    type="number"
                    min={0}
                    value={primeryFee}
                    onChange={(e) => setPrimeryFee(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="secondary_fee"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Secondary Fee (₹)
                  </label>
                  <input
                    id="secondary_fee"
                    type="number"
                    min={0}
                    value={secondaryFee}
                    onChange={(e) => setSecondaryFee(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="senior_secondary_fee"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Sr. Secondary Fee (₹)
                  </label>
                  <input
                    id="senior_secondary_fee"
                    type="number"
                    min={0}
                    value={seniorSecondaryFee}
                    onChange={(e) => setSeniorSecondaryFee(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="total_class"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Total Classes
                  </label>
                  <input
                    id="total_class"
                    type="number"
                    min={0}
                    value={totalClass}
                    onChange={(e) => setTotalClass(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isComputerLab}
                    onChange={(e) => setIsComputerLab(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  Computer Lab Available
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isLibrary}
                    onChange={(e) => setIsLibrary(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  Library Available
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="youtub_link"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    YouTube Link
                  </label>
                  <input
                    id="youtub_link"
                    type="url"
                    value={youtubLink}
                    onChange={(e) => setYoutubLink(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insta_link"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Instagram Link
                  </label>
                  <input
                    id="insta_link"
                    type="url"
                    value={instaLink}
                    onChange={(e) => setInstaLink(e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="facebook_link"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Facebook Link
                  </label>
                  <input
                    id="facebook_link"
                    type="url"
                    value={facebookLink}
                    onChange={(e) => setFacebookLink(e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* 4. Read-Only Plan Features (SuperAdmin Controlled) */}
            <section className="space-y-3 border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  4. Included Plan Features
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Lock className="h-3.5 w-3.5" />
                  Read-only · Controlled by SuperAdmin
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Google Drive</span>
                  <span className="font-semibold text-slate-900">
                    {promisedFeatures.is_gdrive_allowed ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Import / Export CSV</span>
                  <span className="font-semibold text-slate-900">
                    {promisedFeatures.is_import_export_allowed ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Allowed Wings</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {promisedFeatures.allowed_count_wing}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Email Service</span>
                  <span className="font-semibold text-slate-900">
                    {promisedFeatures.is_email_service ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Collaboration</span>
                  <span className="font-semibold text-slate-900">
                    {promisedFeatures.is_collaburation_allowed ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Link
                to="/services"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Creating School Dashboard...' : 'Complete Registration & Open Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
