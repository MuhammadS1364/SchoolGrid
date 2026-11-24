import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth/AuthContext';

import GetWay from './GetWay/GetWay';
import AuthCallback from './GetWay/AuthCallback';
import PageNotFound from './GetWay/PageNotFound';

import PublicServicesPage from './Public/PublicServicesPage';
import SchoolOnboardingPage from './Public/SchoolOnboardingPage';
import PublicSchoolsDirectory from './Public/PublicSchoolsDirectory';
import PublicSchoolWebsite from './Public/PublicSchoolWebsite';
import PublicSchoolRegistrationPage from './Public/PublicSchoolRegistrationPage';
import AcceptInvitationPage from './Public/AcceptInvitationPage';
import PrivacyPolicyPage from './Public/PrivacyPolicyPage';
import TermsOfServicePage from './Public/TermsOfServicePage';

import SuperAdminDashBoard from './SuperAdmin/SuperAdminDashBoard/SuperAdminDashBoard';
import SuperAdminBoard from './SuperAdmin/SuperAdminDashBoard/SuperAdminBoard';
import AllSchoolsInfo from './SuperAdmin/AllSchoolsBox/AllSchoolInfo';
import AllServicesInfo from './SuperAdmin/OurServices/AllServicesInfo';
import AllStudentsInfo from './SuperAdmin/AllStudentsBox/AllStudentInfo';
import OnboardingRequestsPanel from './SuperAdmin/PlatformConsole/OnboardingRequestsPanel';
import AuditAndOutboxPanel from './SuperAdmin/PlatformConsole/AuditAndOutboxPanel';
import PlatformSettingsPanel from './SuperAdmin/PlatformConsole/PlatformSettingsPanel';

import SchoolDashBoard from './SchoolPanel/SchoolDashBoard/SchoolDashBoard';
import SchoolOverview from './SchoolPanel/SchoolDashBoard/SchoolOverview';
import OurClassInfo from './SchoolPanel/ClassesBox/OurClassInfo';
import OurTeachersInfo from './SchoolPanel/TeachersBox/OurTeachersInfo';
import OurStudentsDashBoard from './SchoolPanel/StudentsBox/OurStudentsDashBoard';
import SchoolFeaturesHub from './SchoolPanel/FeaturesBox/SchoolFeaturesHub';
import SchoolWingsAndInvitesPage from './SchoolPanel/WingsBox/SchoolWingsAndInvitesPage';
import SchoolProgrammesPage from './SchoolPanel/ProgrammesBox/SchoolProgrammesPage';
import SchoolContentPage from './SchoolPanel/ContentBox/SchoolContentPage';

import RolePortalPage from './RolePanels/RolePortalPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<GetWay />} />
        <Route path="/login" element={<GetWay />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Public Institutional Websites, Directory, Plans & Onboarding */}
        <Route path="/schools" element={<PublicSchoolsDirectory />} />
        <Route path="/s/:slug" element={<PublicSchoolWebsite />} />
        <Route path="/services" element={<PublicServicesPage />} />
        <Route path="/register-school" element={<PublicSchoolRegistrationPage />} />
        <Route path="/register-school/:holderId" element={<SchoolOnboardingPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />

        {/* SuperAdmin Console */}
        <Route path="/super-admin-dashboard" element={<SuperAdminDashBoard />}>
          <Route index element={<SuperAdminBoard />} />
          <Route path="schools" element={<AllSchoolsInfo />} />
          <Route path="onboarding" element={<OnboardingRequestsPanel />} />
          <Route path="services" element={<AllServicesInfo />} />
          <Route path="students" element={<AllStudentsInfo />} />
          <Route path="audit-outbox" element={<AuditAndOutboxPanel />} />
          <Route path="settings" element={<PlatformSettingsPanel />} />
        </Route>

        {/* Dedicated School Dashboard */}
        <Route path="/school-dashboard" element={<SchoolDashBoard />}>
          <Route index element={<SchoolOverview />} />
          <Route path="wings" element={<SchoolWingsAndInvitesPage />} />
          <Route path="programmes" element={<SchoolProgrammesPage />} />
          <Route path="content" element={<SchoolContentPage />} />
          <Route path="classes" element={<OurClassInfo />} />
          <Route path="teachers" element={<OurTeachersInfo />} />
          <Route path="students" element={<OurStudentsDashBoard />} />
          <Route path="features" element={<SchoolFeaturesHub />} />
        </Route>

        {/* Wing, Teacher & Student Portals */}
        <Route path="/wing-dashboard" element={<RolePortalPage role="Wing" />} />
        <Route path="/teacher-dashboard" element={<RolePortalPage role="Teacher" />} />
        <Route path="/student-dashboard" element={<RolePortalPage role="Student" />} />

        <Route path="*" element={<PageNotFound homeHref="/" loginHref="/login" />} />
      </Routes>
    </AuthProvider>
  );
}