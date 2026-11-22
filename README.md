# School Platform
## Multi-School Institutional Activity & Management Platform

**Project Type:** Multi-Tenant SaaS Web Application  
**Architecture:** Multi-School / Shared Database  
**Frontend:** Next.js, React, TypeScript  
**Backend:** Next.js Server-Side API  
**Authentication:** Supabase Auth  
**Database:** Turso (libSQL / SQLite)  
**File Storage:** Individual Google Drive Integration  
**Styling:** Tailwind CSS + shadcn/ui  
**Deployment:** Vercel (recommended)

**Project Status:** Architecture & Phase 1 Planning

---

# TABLE OF CONTENTS

1. Project Overview
2. Project Objectives
3. What This Platform Is and Is Not
4. Core Architecture
5. Multi-Tenant Architecture
6. User Types and Role Hierarchy
7. Platform SuperAdmin
8. School Management
9. School Onboarding System
10. Authentication Architecture
11. Authorization and Permission System
12. Database Architecture
13. Complete Database Table Catalogue
14. Database Relationships
15. Google Drive Integration
16. File Management Architecture
17. Subdomain and Routing Architecture
18. Backend API Architecture
19. Frontend Architecture
20. UI/UX Design System
21. Public Website Architecture
22. School Admin Dashboard
23. Student Portal
24. Security Architecture
25. Audit Logging
26. Background Jobs and Reliability
27. Error Handling
28. Project Folder Structure
29. Environment Variables
30. Development Phases
31. Testing Strategy
32. Deployment Architecture
33. Backup and Recovery
34. Scalability Considerations
35. Coding Standards
36. Important Development Rules
37. Phase 1 Completion Criteria
38. Future Enhancements
39. Glossary
40. Final Architectural Principles

---

# 1. PROJECT OVERVIEW

School Platform is a multi-tenant institutional management and public website platform designed to manage multiple independent schools through a centralized administration system.

The platform will allow different schools to maintain their own institutional identity, activities, departments, students, staff, programmes, achievements, galleries, news, notices and documents.

Every school will have:

- Its own public website.
- Its own administrative dashboard.
- Its own students and staff.
- Its own departments and wings.
- Its own programmes and activities.
- Its own media and documents.
- Its own users and permissions.
- Its own Google Drive connection.
- Its own institutional settings.

All schools will be managed through a centralized SuperAdmin system.

The platform will use one shared Turso database, while maintaining strict logical isolation between schools.

## 1.1 Main Concept

The platform has three major layers:

**Platform Layer**

Controls the entire application, schools, global configuration, platform administrators and system security.

**School Layer**

Contains all school-specific information, users, memberships, departments, programmes, activities and settings.

**Public Layer**

Displays published school information to students, parents, visitors and the general public.

## 1.2 Primary Goal

The primary goal is not examination management.

Instead, the platform focuses on institutional activities, educational environment, student participation, school identity, achievements, communication and public engagement.

---

# 2. PROJECT OBJECTIVES

The system must achieve the following objectives.

### 2.1 Multi-School Management

- Create unlimited school records subject to infrastructure limits.
- Manage schools from a central platform.
- Activate, suspend and archive schools.
- Give each school its own subdomain.
- Maintain separate school data and permissions.

### 2.2 Institutional Management

- Maintain school profiles.
- Manage students and teachers.
- Organize departments and wings.
- Create programmes and events.
- Maintain achievements and participation records.
- Publish institutional announcements.

### 2.3 Public Information

- Display school activities.
- Publish news and updates.
- Showcase student achievements.
- Display photographs and videos.
- Provide downloadable documents.
- Make institutional information accessible without login.

### 2.4 Centralized Administration

- Manage all schools.
- Control platform-level access.
- Review school registration requests.
- Monitor storage connections.
- Maintain security and audit records.

### 2.5 Independent School Control

Every school must independently manage its own authorized users, institutional information, content and storage connection.

---

# 3. WHAT THIS PLATFORM IS AND IS NOT

## 3.1 What It Is

This platform is:

- A Multi-School Management Platform.
- An Institutional Activity Management System.
- A School Website Management System.
- A Student Participation and Achievement Platform.
- A Centralized School Administration System.
- A Multi-Tenant SaaS Application.

## 3.2 What It Is Not

The initial platform is not primarily designed for:

- Examination management.
- Online examination conducting.
- Advanced marksheet generation.
- Fee collection.
- Payroll management.
- Full accounting.
- Automated attendance systems.

These modules may be introduced in future versions if required.

---

# 4. TECHNOLOGY STACK

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js | Application interface |
| UI | React | Interactive components |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS | Responsive styling |
| Components | shadcn/ui | Reusable UI components |
| Authentication | Supabase Auth | Identity and login |
| Database | Turso | Application data |
| Database SDK | libSQL SDK | Database communication |
| Backend | Next.js Route Handlers | Server-side operations |
| Validation | Zod | Input validation |
| File Storage | Google Drive API | Images and documents |
| Icons | Lucide | Interface icons |
| Charts | Recharts | Analytics |
| Deployment | Vercel | Application hosting |
| Version Control | GitHub | Source management |

## 4.1 Technology Responsibilities

### Next.js

Next.js will provide:

- Public website rendering.
- Admin dashboards.
- Server-side API routes.
- Dynamic school routing.
- Authentication-related server logic.
- Server-side database access.

### Supabase Auth

Supabase will ONLY be used for authentication.

It will handle:

- User registration through controlled workflows.
- Email and password login.
- Email verification.
- Password recovery.
- Session management.
- Access token issuance.
- Authentication identity.

Supabase will not be the primary application database.

### Turso

Turso will be the primary application database.

It will store:

- Schools.
- Users and profiles.
- Memberships.
- Roles and permissions.
- Students.
- Staff.
- Programmes.
- Activities.
- Registrations.
- Achievements.
- News.
- Notices.
- File metadata.
- Audit records.
- Application settings.

### Google Drive

Google Drive will store large files.

Supported file types include:

- JPEG.
- PNG.
- WebP.
- SVG, subject to upload sanitization.
- PDF.
- DOCX.
- XLSX.
- PPTX.
- MP4.
- Other approved document types.

The database will store file metadata and Drive identifiers, not file binaries.

---

# 5. MULTI-TENANT ARCHITECTURE

Multi-tenancy means one application serves multiple independent schools.

Each school is called a tenant.

## 5.1 Shared Database Model

The platform will use one shared Turso database.

Example:

| School | School ID | Database |
|---|---|---|
| School A | SCH-001 | Shared Turso |
| School B | SCH-002 | Shared Turso |
| School C | SCH-003 | Shared Turso |

All school-specific tables will contain a school identifier wherever applicable.

The primary tenant identifier is:

`school_id`

## 5.2 Tenant Isolation

Every school must only access its own authorized records.

Example:

School A must not be able to retrieve School B's:

- Students.
- Staff.
- Programmes.
- Galleries.
- Documents.
- User memberships.
- Private settings.

The backend must determine the school context using the validated hostname and database records.

Never trust a school ID supplied directly by the frontend as proof of authorization.

## 5.3 Tenant Resolution

Example:

`school-a.platform.com`

The backend resolves:

`school-a` → `schools.slug` → `school_id`

After resolving the school, the backend verifies the user's membership.

## 5.4 Database Isolation Rules

- All tenant-owned queries must be scoped to the current school.
- Tenant identifiers must be included in database operations.
- Composite foreign keys must prevent cross-school relationships.
- School membership must be verified for every protected request.
- Public content must be explicitly marked as published.
- Private records must never be returned through public endpoints.

---

# 6. USER TYPES AND ROLE HIERARCHY

The platform has two authorization scopes:

1. Platform-level authorization.
2. School-level authorization.

## 6.1 Platform-Level Roles

### SuperAdmin

The highest-level platform administrator.

Responsibilities:

- Create schools.
- Update school information.
- Approve school registrations.
- Reject school registrations.
- Suspend schools.
- Reactivate schools.
- Archive schools.
- Invite School Admins.
- Manage platform users.
- Manage platform settings.
- Monitor system activity.
- View platform-wide audit logs.
- Manage global permissions.

SuperAdmin privileges must be stored and verified server-side.

### Future Platform Roles

Possible future roles:

- Platform Support.
- Platform Auditor.
- Platform Content Administrator.

These roles must not automatically receive SuperAdmin privileges.

## 6.2 School-Level Roles

### School Admin

Controls one particular school.

Responsibilities:

- Manage school profile.
- Manage students.
- Manage staff.
- Manage wings.
- Manage programmes.
- Manage galleries.
- Manage notices.
- Invite school users.
- Assign school roles.
- Configure school settings.
- Connect Google Drive.

### Wing Manager

Manages an assigned wing or department.

Responsibilities:

- Create wing programmes.
- Update assigned programmes.
- Manage wing activities.
- View relevant participation information.
- Submit content for approval.

A Wing Manager must not automatically access every other wing.

### Teacher

Responsibilities:

- View assigned information.
- Contribute to programmes.
- Submit student-related updates where permitted.
- Assist with activities.
- View assigned reports.

### Content Manager

Responsibilities:

- Manage news.
- Manage notices.
- Upload gallery content.
- Manage published pages.
- Submit content for review.

### Student

Responsibilities may include:

- View personal profile.
- View available programmes.
- Register for eligible activities.
- View participation history.
- View achievements.
- Access approved student documents.

Students must not have administrative privileges.

## 6.3 Multiple Roles

A user may hold multiple roles in one school.

Example:

| User | School | Roles |
|---|---|---|
| User A | School A | Teacher, Wing Manager |
| User A | School B | Student |
| User B | School A | School Admin |

A single user account can belong to multiple schools.

Roles are assigned through school memberships and membership-role relationships.

---

# 7. SUPERADMIN SYSTEM

The SuperAdmin dashboard is the central control panel.

## 7.1 Dashboard Overview

It should display:

- Total registered schools.
- Active schools.
- Suspended schools.
- Pending registration requests.
- Total registered users.
- Total students.
- Total administrators.
- Storage usage.
- Recent platform activity.
- Recent security events.

All displayed statistics must come from actual database records.

## 7.2 School Management

SuperAdmin can:

- Create a school.
- View school details.
- Update school information.
- Activate a school.
- Suspend a school.
- Archive a school.
- View school administrators.
- View school storage status.
- Review school audit activity.

## 7.3 New School Creation

The creation form should collect:

**Basic Information**

- School name.
- Short name.
- School slug.
- Description.
- Address.
- Email.
- Phone.

**Identity**

- School logo.
- Favicon.
- Primary color.
- Secondary color.
- Cover image.

**Website**

- Subdomain.
- Public visibility.
- Default language.
- Website status.

**Administration**

- Initial School Admin email.
- Initial administrator details.
- Invitation settings.

**Storage**

- Drive connection status.
- Root folder configuration.

**Final Review**

Before creation, display all entered information for confirmation.

## 7.4 School Status

Supported statuses:

| Status | Meaning |
|---|---|
| Pending | Awaiting approval or provisioning |
| Active | Operational |
| Suspended | Temporarily restricted |
| Archived | No longer operational |

Suspended and archived schools must not be able to perform normal administrative operations.

---

# 8. SCHOOL ONBOARDING SYSTEM

Two onboarding methods must be supported.

## 8.1 SuperAdmin-Initiated Registration

1. SuperAdmin opens Create School.
2. Enters school details.
3. Backend validates the information.
4. System checks slug uniqueness.
5. School record is created.
6. Default roles and permissions are provisioned.
7. Initial admin invitation is generated.
8. Invitation email is sent.
9. Admin accepts invitation.
10. Admin establishes authentication.
11. School is activated according to provisioning policy.

## 8.2 Self-Service School Registration

Public registration URL:

`platform.com/register-school`

The registration form collects:

- School name.
- Requested slug.
- Contact person.
- Contact email.
- Contact phone.
- Address.
- Description.

The request is stored in:

`school_onboarding_requests`

Initial status:

`pending`

SuperAdmin can approve or reject the request.

Approval must invoke the same school provisioning service used by direct school creation.

Do not duplicate school creation logic.

## 8.3 School Provisioning

School provisioning should be implemented as a reusable backend service.

It must:

1. Validate school data.
2. Check slug availability.
3. Generate school ID.
4. Create school record.
5. Create default roles.
6. Create default permission assignments.
7. Create initial administrator invitation.
8. Create school settings.
9. Create a storage connection placeholder.
10. Write audit records.
11. Queue external operations.

## 8.4 Reliable Provisioning

Turso and Supabase are separate services.

They cannot participate in one distributed database transaction.

Use an Outbox Pattern.

The database transaction creates the school and queues an event.

A background worker processes the event and sends the invitation.

Failed operations must be retryable.

Use idempotency keys to prevent duplicate school creation and duplicate invitations.

---

# 9. AUTHENTICATION ARCHITECTURE

Supabase Auth is the only authentication provider.

Turso stores application profiles and authorization information.

## 9.1 User Identity Mapping

Every authenticated Supabase user must have a corresponding Turso user record.

Important fields:

- user_id
- supabase_uid
- full_name
- email
- phone
- account_status
- created_at
- updated_at

The Supabase user ID must be unique.

## 9.2 Login Workflow

1. User opens login page.
2. User submits email and password.
3. Supabase validates credentials.
4. Supabase returns an access token and session.
5. Frontend sends the token to the backend.
6. Backend verifies the JWT signature.
7. Backend validates issuer, audience and expiry.
8. Backend resolves the user in Turso.
9. Backend checks account status.
10. Backend checks school membership.
11. Backend checks roles and permissions.
12. Authorized requests are processed.

## 9.3 JWT Verification

Never trust an unverified JWT.

Verify tokens using the configured Supabase project's trusted signing keys and issuer.

Validate:

- Signature.
- Issuer.
- Audience.
- Expiry.
- Subject.

Do not accept arbitrary user IDs from request bodies as authenticated identities.

## 9.4 User Registration

Unrestricted public signup should initially be disabled.

Accounts are created through controlled invitation or approved provisioning workflows.

### Account Creation Methods

| User | Creation Method |
|---|---|
| SuperAdmin | Secure platform provisioning |
| School Admin | SuperAdmin invitation |
| Wing Manager | School Admin invitation |
| Teacher | School Admin invitation |
| Student | School invitation or controlled provisioning |

## 9.5 Student Authentication

Students receive individual accounts.

Their account must be linked to:

- A valid user profile.
- An active school membership.
- A student record.
- The Student role.

A student must never be granted administrative permissions by default.

## 9.6 Account Status

Supported user statuses:

- active
- suspended
- disabled

A suspended user must not be able to access protected application resources.

---

# 10. AUTHORIZATION AND PERMISSION SYSTEM

Authentication answers:

Who are you?

Authorization answers:

What are you allowed to do?

These must remain separate.

## 10.1 RBAC

RBAC means Role-Based Access Control.

Permissions are assigned to roles.

Users receive roles through school memberships.

Example:

School Admin → programmes.create

Teacher → programmes.view

Student → programmes.view

## 10.2 Permission Format

Use a consistent permission naming convention:

`module.action`

Examples:

- school.view
- school.update
- students.view
- students.create
- students.update
- students.delete
- staff.view
- programmes.view
- programmes.create
- programmes.update
- programmes.publish
- gallery.upload
- news.publish
- users.invite
- roles.manage

Platform permissions must use a separate namespace:

- platform.schools.create
- platform.schools.approve
- platform.schools.suspend
- platform.users.manage
- platform.audit.view
- platform.settings.manage

## 10.3 Resource-Level Permissions

Some permissions require additional restrictions.

For example:

A Wing Manager may have:

`programmes.update`

But only for programmes belonging to their assigned wing.

Therefore, authorization must also verify the resource's school and wing.

A permission string alone is insufficient for resource-level access.

## 10.4 Authorization Rules

- Never authorize based on frontend role state.
- Never trust a role supplied by the browser.
- Always check active membership.
- Always verify school ownership.
- Always verify resource ownership.
- Deny access by default.
- Revoke permissions immediately when memberships are revoked.

---

# 11. DATABASE ARCHITECTURE

Turso is the primary application database.

Use SQLite-compatible SQL and the official libSQL TypeScript SDK.

## 11.1 Database Design Principles

- Use UUIDs or another collision-resistant identifier strategy.
- Use TEXT identifiers for portability.
- Use foreign keys.
- Enable foreign key enforcement on every connection.
- Use parameterized queries.
- Add indexes for frequent queries.
- Use transactions for related changes.
- Use migrations for schema modifications.
- Avoid storing file binaries.
- Store timestamps consistently in UTC.
- Enforce tenant ownership using composite constraints.

## 11.2 Platform Tables

### schools

Stores registered schools.

Important fields:

- school_id
- school_name
- slug
- short_name
- logo_file_id
- description
- address
- email
- phone
- status
- created_by
- approved_by
- approved_at
- created_at
- updated_at

### platform_roles

Stores platform-level roles.

Example:

- SuperAdmin
- Platform Support
- Platform Auditor

### platform_user_roles

Connects users to platform roles.

### platform_permissions

Stores global permissions.

### platform_role_permissions

Maps platform permissions to platform roles.

## 11.3 Identity Tables

### users

Stores application user profiles.

Important fields:

- user_id
- supabase_uid
- full_name
- email
- phone
- avatar_file_id
- account_status
- created_at
- updated_at

The Supabase UID is the authentication identity mapping.

## 11.4 School Authorization Tables

### school_memberships

Connects a user to a school.

Important fields:

- membership_id
- school_id
- user_id
- membership_status
- joined_at
- created_at

Unique constraint:

`UNIQUE(school_id, user_id)`

### school_roles

Stores school-specific roles.

Important fields:

- school_id
- role_id
- role_name
- is_system

### membership_roles

Allows multiple roles for one membership.

Important fields:

- school_id
- membership_id
- role_id
- assigned_at

### permissions

Stores school permission definitions.

### role_permissions

Maps school roles to permissions.

## 11.5 Onboarding Tables

### school_invitations

Stores school invitations.

Important fields:

- invitation_id
- school_id
- role_id
- email
- token_hash
- invited_by
- status
- expires_at
- accepted_at
- created_at

Store only a cryptographic hash of the invitation token.

Never store the original secret invitation token.

### school_onboarding_requests

Stores school registration requests.

Important fields:

- request_id
- school_name
- requested_slug
- contact_person
- contact_email
- contact_phone
- address
- description
- status
- review_note
- reviewed_by
- reviewed_at
- created_school_id
- created_at

A registration request must be able to exist before a school record exists.

## 11.6 Configuration Tables

### school_settings

Stores configurable school settings.

Examples:

- default_language
- timezone
- theme
- contact_information
- public_visibility
- registration_settings

Avoid creating arbitrary configuration fields without validation.

### school_storage_connections

Stores metadata about each school's Google Drive connection.

Important fields:

- connection_id
- school_id
- provider
- google_account_email
- google_account_subject
- root_folder_id
- credential_secret_ref
- connection_status
- connected_by
- connected_at
- updated_at

Do not store OAuth refresh tokens directly in this table.

## 11.7 Security Tables

### audit_logs

Stores important system activities.

Fields:

- log_id
- school_id
- actor_user_id
- action
- resource_type
- resource_id
- details_json
- ip_address
- user_agent
- created_at

Audit records should be append-only through application permissions.

### outbox_events

Stores pending external operations.

Fields:

- event_id
- event_type
- payload_json
- status
- attempts
- next_attempt_at
- last_error
- created_at
- processed_at

Use it for reliable invitations and provisioning events.

---

# 12. DATABASE RELATIONSHIPS

Important relationships:

1. One school has many memberships.
2. One user can have many school memberships.
3. One membership can have multiple roles.
4. One school role has multiple permissions.
5. One school can issue many invitations.
6. One school can have one active Drive connection.
7. One school can have multiple settings.
8. One school can have many audit records.
9. One user can have multiple platform roles.
10. One onboarding request can produce one school.

## 12.1 Important Database Constraints

Use composite foreign keys wherever tenant consistency matters.

Example:

A programme belonging to School A must not reference a wing belonging to School B.

The same principle applies to:

- Student and class.
- Programme and wing.
- Membership and role.
- Gallery and school.
- File metadata and school.

## 12.2 Database Migrations

All database changes must be recorded in version-controlled migration files.

Example:

database/migrations/

- 0001_initial_schema.sql
- 0002_platform_permissions.sql
- 0003_school_memberships.sql
- 0004_membership_multiple_roles.sql
- 0005_audit_logs.sql
- 0006_outbox_events.sql

Do not manually change the production schema without a migration.

Use a migration runner that tracks applied versions.

---

# 13. GOOGLE DRIVE INTEGRATION

Each school must connect its own Google Drive account.

There will not be one shared Drive account controlling all school files.

## 13.1 OAuth Connection

1. School Admin opens Storage Settings.
2. Clicks Connect Google Drive.
3. Backend creates an OAuth authorization request.
4. User is redirected to Google.
5. User grants required permissions.
6. Google redirects to the backend callback.
7. Backend verifies OAuth state.
8. Backend exchanges the authorization code.
9. Refresh token is encrypted and stored securely.
10. Turso stores a secret reference and connection metadata.

Use the minimum required OAuth scopes.

## 13.2 Drive Folder Structure

Example:

School-A-Portal/

- Identity/
- Students/
- Staff/
- Programmes/
- Gallery/
- Documents/
- Certificates/
- News/
- Notices/

Each school must have its own root folder.

## 13.3 File Metadata

Store these fields in Turso:

- file_id
- school_id
- drive_file_id
- file_name
- mime_type
- file_size
- visibility
- uploaded_by
- created_at

Additional file lifecycle fields may be added.

## 13.4 Public and Private Files

Public files:

- Published gallery photographs.
- Public school logos.
- Public news attachments.
- Public programme posters.

Private files:

- Student documents.
- Staff documents.
- Internal reports.
- Private certificates.
- Administrative files.

Private files must be delivered only after backend authorization.

## 13.5 Drive Limitations

Google Drive is not a dedicated CDN.

Consider:

- API quotas.
- Download limits.
- Latency.
- Public-sharing policies.
- File availability.
- OAuth token expiration.
- File deletion and recovery.

For high-volume public media delivery, a CDN or dedicated object-storage service may eventually be necessary.

---

# 14. SUBDOMAIN ARCHITECTURE

Every school receives its own subdomain.

Examples:

- school-a.platform.com
- school-b.platform.com
- anjuman.platform.com

Main platform:

- platform.com

SuperAdmin:

- platform.com/platform

School registration:

- platform.com/register-school

## 14.1 DNS Configuration

Configure:

- Root domain.
- Wildcard subdomain.
- Wildcard TLS certificate.

## 14.2 School Resolution

The application must:

1. Read the validated request hostname.
2. Extract the school slug.
3. Find the matching school.
4. Check school status.
5. Establish the school context.
6. Authenticate the user.
7. Verify membership.
8. Process the request.

Never use an untrusted forwarded hostname without validating trusted proxy configuration.

## 14.3 Authentication Cookies

Prefer host-only cookies for school subdomains.

Do not automatically share authentication cookies across every tenant subdomain.

Use secure, HTTP-only and appropriate SameSite cookie settings.

---

# 15. BACKEND API ARCHITECTURE

The backend will be implemented using Next.js Route Handlers.

The backend is responsible for:

- Authentication verification.
- Authorization.
- Tenant resolution.
- Database operations.
- File operations.
- Input validation.
- Error handling.
- Audit logging.

## 15.1 API Structure

### Authentication

- GET /api/auth/me
- POST /api/auth/sync
- POST /api/auth/logout

### Platform

- GET /api/platform/dashboard
- GET /api/platform/schools
- POST /api/platform/schools
- GET /api/platform/schools/:id
- PATCH /api/platform/schools/:id
- POST /api/platform/schools/:id/suspend
- POST /api/platform/schools/:id/activate

### Onboarding

- POST /api/onboarding/school
- GET /api/platform/onboarding
- POST /api/platform/onboarding/:id/approve
- POST /api/platform/onboarding/:id/reject

### Invitations

- POST /api/school/invitations
- POST /api/invitations/accept
- GET /api/school/members

### Storage

- GET /api/school/storage
- POST /api/school/storage/google/connect
- GET /api/school/storage/google/callback
- POST /api/school/storage/google/disconnect

## 15.2 API Security

Every protected endpoint must:

1. Verify authentication.
2. Resolve the required platform or school context.
3. Verify account status.
4. Verify membership where applicable.
5. Check required permissions.
6. Validate request data.
7. Execute authorized operations.
8. Record important actions.
9. Return a consistent response.

## 15.3 API Response Format

Successful response:

{
  "success": true,
  "data": {},
  "message": "Operation completed"
}

Error response:

{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission"
  }
}

Never expose database credentials, internal tokens or sensitive server errors.

---

# 16. FRONTEND ARCHITECTURE

The frontend will contain three main application experiences.

## 16.1 Public Website

Responsible for displaying school information.

## 16.2 School Dashboard

Responsible for school administration.

## 16.3 SuperAdmin Dashboard

Responsible for centralized platform management.

These experiences should share reusable components and design tokens without sharing authorization assumptions.

## 16.4 Recommended Routes

app/

- (public)/
  - [schoolSlug]/
  - about/
  - programmes/
  - gallery/
  - achievements/

- (auth)/
  - login/
  - accept-invitation/
  - reset-password/

- platform/
  - superadmin/
  - dashboard/
  - schools/
  - users/
  - settings/

- dashboard/
  - overview/
  - students/
  - staff/
  - wings/
  - programmes/
  - gallery/
  - documents/
  - users/
  - settings/

- api/

Public routes must not require login unless a specific feature requires it.

---

# 17. UI/UX DESIGN SYSTEM

The interface should be modern, clean, responsive and accessible.

## 17.1 General Design Principles

- Mobile-first.
- Consistent typography.
- Consistent spacing.
- Clear visual hierarchy.
- Accessible color contrast.
- Reusable components.
- Meaningful empty states.
- Clear loading states.
- Helpful validation messages.
- Responsive navigation.

## 17.2 SuperAdmin Dashboard

Main navigation:

- Dashboard.
- Schools.
- Registration Requests.
- Platform Users.
- Roles and Permissions.
- Storage Overview.
- Audit Logs.
- Platform Settings.

## 17.3 School Admin Dashboard

Main navigation:

- Overview.
- School Profile.
- Students.
- Staff.
- Wings and Departments.
- Programmes.
- Registrations.
- Achievements.
- News.
- Notices.
- Gallery.
- Documents.
- User Management.
- Roles and Permissions.
- Storage.
- Settings.

## 17.4 UI States

Every data-driven interface must support:

- Loading.
- Empty.
- Success.
- Error.
- Unauthorized.
- Forbidden.
- Offline or network failure where relevant.

## 17.5 Form Design

Forms should include:

- Proper labels.
- Required-field indicators.
- Client-side validation.
- Server-side validation.
- Helpful error messages.
- Save confirmation.
- Unsaved-change handling where appropriate.

Destructive actions must require confirmation.

---

# 18. PUBLIC SCHOOL WEBSITE

Every school has its own public website.

## 18.1 Main Pages

1. Home.
2. About School.
3. History.
4. Mission and Vision.
5. Wings and Departments.
6. Programmes and Events.
7. Programme Details.
8. Achievements.
9. News and Updates.
10. Photo Gallery.
11. Video Gallery.
12. Notices.
13. Documents.
14. Contact.

## 18.2 Homepage Sections

Recommended order:

1. Header.
2. Hero section.
3. School introduction.
4. Institutional highlights.
5. Upcoming programmes.
6. Recent activities.
7. Departments and wings.
8. Student achievements.
9. Gallery.
10. Latest news.
11. Notices.
12. Footer.

## 18.3 Publishing Rules

Content must have a publication status.

Possible statuses:

- draft
- pending_approval
- published
- archived

Only published and publicly visible content can appear on the public website.

---

# 19. STUDENT PORTAL

Students will have individual authentication accounts.

## 19.1 Student Dashboard

Possible sections:

- My Profile.
- My School.
- Available Programmes.
- My Registrations.
- Participation History.
- Achievements.
- Notices.
- Documents.

## 19.2 Student Permissions

Students must not be able to:

- Edit school settings.
- Manage other students.
- Assign roles.
- Access administrative records.
- Publish official news.
- Access private documents belonging to others.

## 19.3 Student Privacy

Student photographs and personal information must be handled carefully.

Public display must follow school authorization and applicable consent requirements.

Avoid publishing private student contact information.

---

# 20. SECURITY ARCHITECTURE

Security must be implemented from the beginning.

## 20.1 Authentication Security

- Verify Supabase JWT signatures.
- Validate issuer, audience and expiry.
- Use secure sessions.
- Support password recovery.
- Use email verification.
- Support MFA for privileged accounts.
- Revoke access after account suspension.

## 20.2 Authorization Security

- Separate platform and school permissions.
- Verify membership on protected requests.
- Apply tenant filtering to every query.
- Enforce resource-level ownership.
- Deny by default.

## 20.3 Database Security

- Never expose Turso credentials to frontend code.
- Use parameterized SQL.
- Enable foreign keys.
- Apply tenant-consistency constraints.
- Use restricted database credentials where possible.
- Maintain backups.
- Protect migration access.

## 20.4 File Security

- Encrypt OAuth tokens.
- Validate file MIME types.
- Restrict file sizes.
- Check file ownership.
- Restrict private downloads.
- Prevent unauthorized file replacement.
- Log sensitive file operations.

## 20.5 Web Security

- HTTPS everywhere.
- Secure cookies.
- CSRF protection for cookie-authenticated mutations.
- Rate limiting.
- Security headers.
- Input validation.
- Output escaping.
- Content Security Policy.
- Safe file handling.

## 20.6 SuperAdmin Security

SuperAdmin is the most privileged role.

Required protections:

- MFA.
- Strong authentication.
- Restricted platform endpoints.
- Sensitive-action re-authentication.
- Audit logging.
- Secure invitation process.
- No public SuperAdmin registration.

Never allow a normal School Admin to become SuperAdmin by editing a frontend role field.

---

# 21. AUDIT LOGGING

The system must maintain records of sensitive operations.

Examples:

- School created.
- School suspended.
- School activated.
- Admin invited.
- User suspended.
- Role assigned.
- Permission modified.
- Programme published.
- Document uploaded.
- Drive disconnected.

Every audit record should identify:

- Actor.
- Action.
- Resource.
- School context.
- Timestamp.
- Outcome.

Avoid recording passwords, access tokens, OAuth secrets or unnecessary personal data.

Audit logs should not be editable through ordinary administrative interfaces.

---

# 22. BACKGROUND JOBS AND RELIABILITY

Some operations must not depend on a single HTTP request.

Examples:

- Sending invitations.
- School provisioning.
- Drive synchronization.
- Large file operations.
- Email notifications.

Use background workers with retry support.

## 22.1 Outbox Pattern

1. Perform related database changes in a transaction.
2. Insert an outbox event in that transaction.
3. Worker fetches pending events.
4. Worker performs the external operation.
5. Worker records completion.
6. Failed events are retried.

Use idempotency to prevent duplicate effects.

## 22.2 Job Status

- pending
- processing
- completed
- failed

Implement retry limits and backoff.

---

# 23. ERROR HANDLING

Use consistent error codes.

Examples:

- UNAUTHORIZED
- FORBIDDEN
- SCHOOL_NOT_FOUND
- SCHOOL_SUSPENDED
- USER_NOT_FOUND
- MEMBERSHIP_REQUIRED
- INVITATION_EXPIRED
- INVITATION_REVOKED
- INVALID_INPUT
- DUPLICATE_SLUG
- STORAGE_NOT_CONNECTED
- DATABASE_ERROR
- RATE_LIMITED

Never return raw stack traces to the browser in production.

Errors must be logged securely.

---

# 24. PROJECT FOLDER STRUCTURE

Recommended structure:

school-platform/

- app/
  - (public)/
  - (auth)/
  - platform/
  - dashboard/
  - api/

- components/
  - ui/
  - forms/
  - layout/
  - dashboard/
  - public/

- lib/
  - supabase/
  - turso/
  - auth/
  - permissions/
  - tenancy/
  - google-drive/
  - validation/
  - security/

- modules/
  - schools/
  - users/
  - memberships/
  - invitations/
  - onboarding/
  - students/
  - staff/
  - wings/
  - programmes/
  - achievements/
  - media/

- database/
  - migrations/
  - seeds/
  - schema.sql/

- services/
  - school-provisioning/
  - invitations/
  - storage/
  - audit/
  - notifications/

- workers/
  - outbox/
  - email/
  - storage/

- types/
- hooks/
- config/
- tests/

- .env.example
- README.md
- package.json
- tsconfig.json
- next.config.ts

## 24.1 Folder Responsibilities

### app/

Contains routes and pages.

### components/

Contains reusable visual components.

### lib/

Contains infrastructure utilities and integrations.

### modules/

Contains domain-specific business logic.

### services/

Contains application workflows involving multiple modules.

### database/

Contains SQL migrations and seed data.

### workers/

Contains background processing logic.

### tests/

Contains unit, integration and end-to-end tests.

Do not put all application logic inside page components.

---

# 25. ENVIRONMENT VARIABLES

Create a `.env.local` file for local development.

Example:

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

TOKEN_ENCRYPTION_KEY=
APPLICATION_BASE_URL=

All privileged values must remain server-side.

Do not commit `.env.local` to GitHub.

Create `.env.example` with variable names but no real secrets.

Use a secure secrets manager for production OAuth refresh tokens and encryption keys.

The Supabase secret key is not needed for ordinary JWT verification; use the appropriate trusted signing-key verification method.

---

# 26. DEVELOPMENT PHASES

## Phase 1: Foundation and Multi-School Architecture

This is the first development milestone.

Features:

- Next.js initialization.
- Supabase Auth.
- Turso connection.
- Initial database migrations.
- User identity mapping.
- Platform roles.
- School roles.
- Permission engine.
- Multi-tenant architecture.
- SuperAdmin dashboard.
- Create School.
- School registration requests.
- Admin invitations.
- Subdomain routing.
- Audit logs.
- Security foundation.
- Outbox processing.

Expected result:

Two independent schools can be created and administered without cross-school access.

## Phase 2: School Administration

Features:

- School profile.
- Students.
- Staff.
- Classes.
- Departments.
- Wings.
- Teams.
- User management.
- School settings.

Expected result:

A school can manage its institutional structure.

## Phase 3: Activities and Programmes

Features:

- Programme creation.
- Programme scheduling.
- Categories.
- Registrations.
- Participants.
- Results.
- Achievements.
- Participation reports.

Expected result:

Schools can manage their educational and extracurricular activities.

## Phase 4: Media and Content Management

Features:

- Individual Google Drive connection.
- Media uploads.
- Photo galleries.
- Video galleries.
- Documents.
- Certificates.
- News.
- Notices.
- Publishing workflow.

Expected result:

Schools can manage their digital content.

## Phase 5: Public Websites

Features:

- Dynamic school homepage.
- School-specific branding.
- About pages.
- Programme pages.
- Achievement pages.
- News.
- Gallery.
- Search.
- Multilingual content.
- Responsive layouts.

Expected result:

Each school receives its own public website.

## Phase 6: Analytics and Advanced Features

Features:

- Participation analytics.
- Activity reports.
- Storage analytics.
- Platform statistics.
- Advanced audit tools.
- Additional automation.

Expected result:

The platform gains advanced monitoring and reporting capabilities.

---

# 27. TESTING STRATEGY

Testing is mandatory before deployment.

## 27.1 Authentication Tests

- Valid login.
- Invalid login.
- Expired token.
- Invalid JWT.
- Suspended user.
- Disabled user.
- Password reset.
- Invitation acceptance.

## 27.2 Authorization Tests

- SuperAdmin access.
- School Admin access.
- Teacher access.
- Wing Manager access.
- Student access.
- Unauthorized access.
- Revoked membership.
- Missing permission.

## 27.3 Tenant Isolation Tests

Create two schools:

- School A.
- School B.

Verify:

1. School A Admin can access School A.
2. School B Admin can access School B.
3. School A cannot access School B records.
4. School B cannot access School A records.
5. A student cannot access administrative endpoints.
6. A suspended school cannot use protected school operations.

Test direct API requests, not just frontend navigation.

## 27.4 Database Tests

- Foreign keys.
- Unique constraints.
- Duplicate slug prevention.
- Multiple role assignments.
- Membership constraints.
- Transaction rollback.
- Migration consistency.

## 27.5 Storage Tests

- Drive connection.
- Token expiration.
- Reconnection.
- File upload.
- File download.
- Private file authorization.
- School ownership.
- Disconnection.

---

# 28. DEPLOYMENT ARCHITECTURE

Recommended initial deployment:

- Next.js application on Vercel.
- Turso production database.
- Supabase Auth project.
- Google OAuth integration.
- Wildcard DNS and TLS.
- GitHub repository.

## 28.1 Deployment Environments

Maintain three environments:

### Development

For local coding and testing.

### Staging

For testing new features before release.

### Production

For real schools and users.

Do not use production student records for ordinary development tests.

## 28.2 Deployment Process

1. Commit code to GitHub.
2. Run linting.
3. Run type checking.
4. Run automated tests.
5. Review database migrations.
6. Deploy to staging.
7. Verify functionality.
8. Apply approved production migrations.
9. Deploy production application.
10. Monitor errors and logs.

---

# 29. BACKUP AND RECOVERY

Database and file storage require separate backup strategies.

## 29.1 Turso

- Schedule database backups.
- Maintain appropriate retention.
- Test restoration periodically.
- Keep migration history.
- Restrict backup access.

## 29.2 Google Drive

- Use the school's own Drive account.
- Maintain file metadata.
- Monitor deleted or unavailable files.
- Establish a recovery policy.
- Document account ownership and recovery.

A Drive connection does not automatically guarantee a complete backup.

The school must retain control of its own Google account and recovery methods.

---

# 30. SCALABILITY CONSIDERATIONS

The application should be designed to accommodate additional schools and users.

Important considerations:

- Indexed tenant queries.
- Database query optimization.
- Pagination.
- Server-side caching of public content.
- Rate limiting.
- Background jobs.
- Efficient image delivery.
- Connection management.
- Storage monitoring.
- Database backup and restoration.

Do not assume that a shared database will scale indefinitely without operational planning.

Monitor database size, query latency, write contention and provider limits.

---

# 31. CODING STANDARDS

## 31.1 TypeScript

Use TypeScript throughout the application.

Avoid `any` wherever practical.

Define types for:

- User.
- School.
- Membership.
- Role.
- Permission.
- Programme.
- File.
- API response.

## 31.2 Database

- Use parameterized SQL.
- Never concatenate user input into SQL.
- Use transactions for related changes.
- Keep migrations version-controlled.
- Use explicit foreign keys.
- Add appropriate indexes.

## 31.3 Backend

- Keep business logic outside route handlers.
- Centralize authentication.
- Centralize authorization.
- Validate every mutation.
- Keep external service integrations isolated.
- Record important operations.

## 31.4 Frontend

- Use reusable components.
- Avoid duplicating form logic.
- Keep server and client responsibilities clear.
- Use accessible controls.
- Handle loading and error states.
- Do not store privileged credentials in client code.

---

# 32. IMPORTANT DEVELOPMENT RULES

These rules are mandatory for every developer working on this project.

1. Never expose Turso credentials in frontend code.
2. Never expose Supabase secret keys.
3. Never expose Google OAuth refresh tokens.
4. Never trust frontend roles.
5. Never trust frontend school IDs as authorization proof.
6. Never allow cross-school data access.
7. Never skip server-side validation.
8. Never store large files as database blobs.
9. Never store invitation tokens in plaintext.
10. Never allow unrestricted SuperAdmin registration.
11. Never allow unauthorized users to publish public content.
12. Never delete important records without an appropriate policy.
13. Never make production schema changes without migrations.
14. Never assume successful login means successful authorization.
15. Never return private student records through public endpoints.
16. Never use a single shared school-admin permission across all tenants.
17. Never log authentication secrets.
18. Never rely exclusively on frontend navigation guards.
19. Never assume Google Drive is a CDN.
20. Never deploy without tenant-isolation testing.

---

# 33. PHASE 1 COMPLETION CRITERIA

Phase 1 is complete only when all the following work.

### Platform

- SuperAdmin can securely log in.
- SuperAdmin can create schools.
- SuperAdmin can suspend schools.
- SuperAdmin can reactivate schools.
- SuperAdmin can review registration requests.

### School

- School Admin can accept an invitation.
- School Admin can log in.
- School Admin can access only their school.
- Multiple roles can be assigned to a membership.

### Authentication

- Supabase JWT verification works.
- User identity is mapped to Turso.
- Expired invitations are rejected.
- Suspended accounts are blocked.

### Database

- Migrations execute correctly.
- Foreign keys are enforced.
- Tenant constraints work.
- Audit logs are recorded.
- Outbox events are retryable.

### Security

- Cross-school access is blocked.
- Students cannot access administrative operations.
- Revoked memberships are rejected.
- Privileged credentials remain server-side.

### Infrastructure

- School subdomains resolve correctly.
- School-specific context is established.
- Production and staging configurations are separate.

---

# 34. FUTURE ENHANCEMENTS

The architecture should allow future modules without requiring a complete rewrite.

Possible additions:

- Examination Management.
- Attendance Management.
- Fee Management.
- Parent Portal.
- Messaging and Notifications.
- Online Registration.
- Event Ticketing.
- Certificate Generation.
- Advanced Analytics.
- Mobile Application.
- Custom School Domains.
- Multi-language Content Management.
- Subscription and Billing Management.

These are future enhancements, not Phase 1 requirements.

---

# 35. GLOSSARY

| Term | Meaning |
|---|---|
| Multi-Tenant | One application serving multiple independent organizations |
| Tenant | An individual school |
| SuperAdmin | Central platform administrator |
| School Admin | Administrator of one school |
| Authentication | Verifying user identity |
| Authorization | Determining user permissions |
| JWT | JSON Web Token |
| RBAC | Role-Based Access Control |
| Permission | An allowed operation |
| Membership | Relationship between a user and a school |
| Turso | Distributed SQLite/libSQL database platform |
| Supabase Auth | Authentication service |
| Google OAuth | Authorization mechanism for Google accounts |
| Drive File ID | Unique identifier for a Google Drive file |
| API | Application Programming Interface |
| Middleware | Logic executed before request handling |
| Migration | Version-controlled database schema change |
| Outbox Pattern | Reliable processing of external operations |
| CDN | Content Delivery Network |
| Audit Log | Record of important system activities |
| Tenant Isolation | Preventing one school from accessing another school's data |
| Provisioning | Creating and configuring a new school |
| Subdomain | School-specific URL prefix |

---

# 36. FINAL ARCHITECTURAL PRINCIPLES

The entire system must follow these principles:

**1. Centralized Control**

SuperAdmin controls the overall platform.

**2. Independent Schools**

Each school operates within its own tenant context.

**3. Shared Infrastructure**

One application and one shared Turso database serve multiple schools.

**4. Independent Authentication and Authorization**

Supabase verifies identity; Turso-backed application services determine permissions.

**5. Secure File Ownership**

Every school connects and manages its own Google Drive.

**6. Modular Development**

Every major feature is implemented as an independent module.

**7. Server-Side Security**

All privileged operations are performed and authorized by the backend.

**8. Public Information, Private Administration**

Public content is accessible to visitors, while administrative and personal data remain protected.

**9. Reliable Operations**

External operations use retries, idempotency and appropriate transaction boundaries.

**10. Future Compatibility**

New modules should integrate without changing the fundamental multi-tenant architecture.

---

# FINAL PROJECT VISION

School Platform is intended to become a centralized digital ecosystem where multiple educational institutions can manage their identities, activities, students, departments, achievements and public presence through one secure and scalable application.

Every institution receives its own digital identity and administrative environment while remaining part of a centrally managed platform.

The system must prioritize:

- Security.
- Independence.
- Maintainability.
- Scalability.
- User Experience.
- Institutional Identity.
- Reliable Data Management.

**Development priority: Phase 1 — Foundation & Multi-School Architecture.**

Do not proceed to advanced activity modules until the authentication, authorization, tenant isolation and school provisioning systems have been properly implemented and tested.

---

**End of Documentation**