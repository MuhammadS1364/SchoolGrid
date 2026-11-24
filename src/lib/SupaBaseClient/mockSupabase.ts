import { inferRoleFromEmail, ROLES } from '../auth/roleResolver';

export interface ServicePlanRecord {
  service_id: string;
  created_at: string;
  service_title: string;
  service_dec: string | null;
  feature_list: string | null;
  service_charge: number;
  is_active: boolean;
}

export type ServiceHolderStatus =
  | 'pending_approval'
  | 'approved'
  | 'school_registered'
  | 'rejected';

export interface ServiceHolderRecord {
  holder_id: string;
  created_at: string;
  started_at: string | null;
  end_at: string | null;
  payment_method: string | null;
  is_active: boolean;
  status: ServiceHolderStatus | string | null;
  plain_type: string | null;
  holder_fullname: string | null;
  holder_email: string | null;
  holder_contact: string | null;
  service_id: string | null;
  school_id: string | null;
}

export interface SchoolRecord {
  school_id: string;
  created_at: string;
  school_title: string;
  school_manager: string | null;
  is_private: boolean;
  loc_state: string | null;
  loc_district: string | null;
  loc_city_village: string | null;
  local_address: string | null;
  user_uuid: string | null;
  school_type: 'Primary' | 'Secondary' | 'Senior Secondary' | string | null;
  schoole_gmail: string | null;
  is_gdrive_allowed: boolean;
  is_import_export_allowed: boolean;
  allowed_count_wing: number;
  is_email_service: boolean;
  is_collaburation_allowed: boolean;
  primery_fee: number;
  secondary_fee: number;
  senior_secondary_fee: number;
  youtub_link: string | null;
  insta_link: string | null;
  facebook_link: string | null;
  total_class: number;
  is_computer_lab: boolean;
  is_library: boolean;
  is_approved: boolean;
  logo_url?: string | null;
}

export interface SchoolInfoRecord {
  school_info_id: string;
  created_at: string;
  school_id: string | null;
  total_class: number | null;
  primery_class_fee: number | null;
  seconday_class_fee: number | null;
  insta_id_link: string | null;
  facebook_link: string | null;
  youtube_link: string | null;
  is_computer_lab: boolean | null;
  is_library: boolean | null;
  about_school: string | null;
  school_vission: string | null;
  school_mission: string | null;
}

export interface SchoolTeacherRecord {
  teacher_id: string;
  created_at: string;
  school_id: string;
  user_id?: string | null;
  class_id?: string | null;
  teacher_full_name?: string | null;
  teacher_contact?: string | null;
  teacher_email?: string | null;
  monthly_wage?: number | null;
  joined_at?: string | null;
  left_at?: string | null;
  teacher_img?: string | null;
  // Backwards-compatible aliases used by existing views
  full_name: string;
  email: string;
  subject: string;
  phone: string;
  wing: string;
  is_active: boolean;
}

export interface StudentsBoxRecord {
  AddNo: string;
  StudentName: string | null;
  StudentEmail: string | null;
  FatherName: string | null;
  school_id: string | null;
  stn_user_id: string | null;
  Registration_Count: number | null;
  Resluted_Count: number | null;
  Total_Point: number | null;
  OutReach_Count: number | null;
  OutReach_Points: number | null;
  Achievements_Counts: number | null;
  Achievements_Points: number | null;
  Grand_Total_Points: number | null;
  IsActive: boolean | null;
  Student_Photo_Urls: string | null;
  StnState: string | null;
  StnDistrict: string | null;
  Stn_Class: string | null;
  Stn_Dob: string | null;
}

export interface SchoolStudentRecord {
  student_id: string;
  created_at: string;
  school_id: string;
  stn_user_id?: string | null;
  AddNo?: string;
  full_name: string;
  email: string;
  roll_number: string;
  class_name: string;
  wing: string;
  fee_tier: 'Primary' | 'Secondary' | 'Senior Secondary';
  guardian_contact: string;
  father_name?: string | null;
  state?: string | null;
  district?: string | null;
  dob?: string | null;
  photo_url?: string | null;
  is_active: boolean;
}

export interface SchoolClassRecord {
  class_id: string;
  created_at: string;
  school_id: string;
  class_name: string;
  wing: string;
  level: 'Primary' | 'Secondary' | 'Senior Secondary';
  teacher_name: string;
  room_no: string;
  capacity: number;
}

export interface SchoolUserProfileRecord {
  profile_uuid: string;
  created_at: string;
  user_uuid: string | null;
  full_name: string | null;
  user_password: string | null;
  school_id: string | null;
  user_role: string | null;
  is_active: boolean | null;
}

export interface MockUser {
  id: string;
  email: string;
  user_metadata: { role: string; full_name?: string; school_id?: string };
  app_metadata: { role: string };
}

type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimePayload {
  eventType: RealtimeEventType;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

type RealtimeListener = {
  table: string;
  filter?: string;
  callback: (payload: RealtimePayload) => void;
};

export interface MockSession {
  user: MockUser;
  access_token: string;
  refresh_token: string;
}

type AuthChangeCallback = (event: string, session: MockSession | null) => void;

const SESSION_STORAGE_KEY = 'schoolgrid_mock_user_v2';
const DB_STORAGE_KEY = 'schoolgrid_mock_db_v2';

export const DEFAULT_SERVICES: ServicePlanRecord[] = [
  {
    service_id: 'srv-starter',
    created_at: '2025-01-05T09:00:00.000Z',
    service_title: 'Starter Campus Plan',
    service_dec: 'Core multi-wing administration for growing primary and middle schools.',
    feature_list: 'Up to 7 Wings, Student & Teacher CRUD, Class Management, Fee Structure Setup',
    service_charge: 750,
    is_active: true,
  },
  {
    service_id: 'srv-growth',
    created_at: '2025-01-10T09:00:00.000Z',
    service_title: 'Growth Digital Suite',
    service_dec: 'Adds CSV Import/Export and automated Email Service for secondary institutions.',
    feature_list:
      'Up to 15 Wings, Import / Export CSV, Email Service, Student & Teacher CRUD, Class Management',
    service_charge: 1450,
    is_active: true,
  },
  {
    service_id: 'srv-enterprise',
    created_at: '2025-01-15T09:00:00.000Z',
    service_title: 'Enterprise Cloud Grid',
    service_dec: 'Full cloud suite with Google Drive sync, Import/Export, Email Service, and Staff Collaboration.',
    feature_list:
      'Up to 30 Wings, Google Drive Integration, Import / Export CSV, Email Service, Collaboration Workspace',
    service_charge: 2499,
    is_active: true,
  },
];

export const DEFAULT_SCHOOLS: SchoolRecord[] = [
  {
    school_id: 'sch-101',
    created_at: '2025-01-12T08:30:00.000Z',
    school_title: 'Greenwood International Academy',
    school_manager: 'Dr. Meera Deshmukh',
    is_private: true,
    loc_state: 'Maharashtra',
    loc_district: 'Pune',
    loc_city_village: 'Kothrud',
    local_address: 'Plot 14, Paud Road, Near MIT Gate, Pune',
    user_uuid: '00000000-0000-4000-8000-000000000101',
    school_type: 'Senior Secondary',
    schoole_gmail: 'greenwood.academy@gmail.com',
    is_gdrive_allowed: true,
    is_import_export_allowed: true,
    allowed_count_wing: 15,
    is_email_service: true,
    is_collaburation_allowed: true,
    primery_fee: 450,
    secondary_fee: 550,
    senior_secondary_fee: 750,
    youtub_link: 'https://youtube.com/@greenwoodacademy',
    insta_link: 'https://instagram.com/greenwoodacademy',
    facebook_link: 'https://facebook.com/greenwoodacademy',
    total_class: 24,
    is_computer_lab: true,
    is_library: true,
    is_approved: true,
  },
  {
    school_id: 'sch-102',
    created_at: '2025-02-04T10:15:00.000Z',
    school_title: 'Kendriya Vidyalaya Sector 18',
    school_manager: 'Rajesh Kumar Sharma',
    is_private: false,
    loc_state: 'Uttar Pradesh',
    loc_district: 'Lucknow',
    loc_city_village: 'Gomti Nagar',
    local_address: 'Sector 18, Vibhuti Khand, Lucknow',
    user_uuid: '00000000-0000-4000-8000-000000000102',
    school_type: 'Secondary',
    schoole_gmail: 'kv.sector18@edu.in',
    is_gdrive_allowed: false,
    is_import_export_allowed: true,
    allowed_count_wing: 10,
    is_email_service: true,
    is_collaburation_allowed: false,
    primery_fee: 450,
    secondary_fee: 550,
    senior_secondary_fee: 750,
    youtub_link: null,
    insta_link: null,
    facebook_link: null,
    total_class: 18,
    is_computer_lab: true,
    is_library: true,
    is_approved: true,
  },
  {
    school_id: 'sch-103',
    created_at: '2025-02-20T09:00:00.000Z',
    school_title: 'St. Xavier Public Senior Secondary',
    school_manager: 'Fr. Thomas Mathew',
    is_private: true,
    loc_state: 'Karnataka',
    loc_district: 'Bengaluru Urban',
    loc_city_village: 'Indiranagar',
    local_address: '100 Feet Road, HAL 2nd Stage, Bengaluru',
    user_uuid: '00000000-0000-4000-8000-000000000103',
    school_type: 'Senior Secondary',
    schoole_gmail: 'stxavier.blr@gmail.com',
    is_gdrive_allowed: true,
    is_import_export_allowed: false,
    allowed_count_wing: 12,
    is_email_service: false,
    is_collaburation_allowed: true,
    primery_fee: 500,
    secondary_fee: 650,
    senior_secondary_fee: 850,
    youtub_link: null,
    insta_link: null,
    facebook_link: null,
    total_class: 20,
    is_computer_lab: true,
    is_library: true,
    is_approved: true,
  },
  {
    school_id: 'sch-104',
    created_at: '2025-03-08T11:45:00.000Z',
    school_title: 'Government Model High School',
    school_manager: 'Sunita Devi Verma',
    is_private: false,
    loc_state: 'Maharashtra',
    loc_district: 'Nagpur',
    loc_city_village: 'Dharampeth',
    local_address: 'Civil Lines Road, Opposite High Court, Nagpur',
    user_uuid: null,
    school_type: 'Secondary',
    schoole_gmail: 'gmhs.nagpur@mahaschool.org',
    is_gdrive_allowed: false,
    is_import_export_allowed: false,
    allowed_count_wing: 7,
    is_email_service: false,
    is_collaburation_allowed: false,
    primery_fee: 450,
    secondary_fee: 550,
    senior_secondary_fee: 750,
    youtub_link: null,
    insta_link: null,
    facebook_link: null,
    total_class: 12,
    is_computer_lab: false,
    is_library: true,
    is_approved: true,
  },
  {
    school_id: 'sch-105',
    created_at: '2025-03-22T07:20:00.000Z',
    school_title: 'Sunrise Valley Public School',
    school_manager: 'Anil Pratap Singh',
    is_private: true,
    loc_state: 'Uttar Pradesh',
    loc_district: 'Varanasi',
    loc_city_village: 'Lanka',
    local_address: 'BHU Main Gate Road, Lanka, Varanasi',
    user_uuid: null,
    school_type: 'Primary',
    schoole_gmail: 'sunrise.varanasi@gmail.com',
    is_gdrive_allowed: false,
    is_import_export_allowed: false,
    allowed_count_wing: 7,
    is_email_service: true,
    is_collaburation_allowed: false,
    primery_fee: 450,
    secondary_fee: 550,
    senior_secondary_fee: 750,
    youtub_link: null,
    insta_link: null,
    facebook_link: null,
    total_class: 8,
    is_computer_lab: false,
    is_library: false,
    is_approved: false,
  },
];

export const DEFAULT_SERVICE_HOLDERS: ServiceHolderRecord[] = [
  {
    holder_id: 'hld-201',
    created_at: '2025-04-01T10:00:00.000Z',
    started_at: '2025-04-01',
    end_at: '2026-04-01',
    payment_method: 'UPI',
    is_active: true,
    status: 'school_registered',
    plain_type: 'Yearly',
    holder_fullname: 'Dr. Meera Deshmukh',
    holder_email: 'greenwood.academy@gmail.com',
    holder_contact: '+91 98220 44112',
    service_id: 'srv-enterprise',
    school_id: 'sch-101',
  },
  {
    holder_id: 'hld-202',
    created_at: '2025-04-14T11:30:00.000Z',
    started_at: '2025-04-15',
    end_at: '2025-07-15',
    payment_method: 'Bank Transfer',
    is_active: true,
    status: 'pending_approval',
    plain_type: 'Quarterly',
    holder_fullname: 'Vikramjit Kaur',
    holder_email: 'principal@oakridge.edu.in',
    holder_contact: '+91 98111 77234',
    service_id: 'srv-growth',
    school_id: null,
  },
];

const DEFAULT_TEACHERS: SchoolTeacherRecord[] = [
  {
    teacher_id: 'tch-1',
    created_at: '2025-02-01T08:00:00.000Z',
    school_id: 'sch-101',
    full_name: 'Mrs. Sarah Chen',
    email: 'teacher.sarah@greenwood.edu',
    subject: 'Biology',
    phone: '+91 98230 11002',
    wing: 'Science Wing',
    is_active: true,
  },
  {
    teacher_id: 'tch-2',
    created_at: '2025-02-05T08:00:00.000Z',
    school_id: 'sch-101',
    full_name: 'Mr. David Wilson',
    email: 'teacher.david@greenwood.edu',
    subject: 'Chemistry',
    phone: '+91 98230 11009',
    wing: 'Science Wing',
    is_active: true,
  },
  {
    teacher_id: 'tch-3',
    created_at: '2025-02-10T08:00:00.000Z',
    school_id: 'sch-101',
    full_name: 'Ms. Priya Nair',
    email: 'teacher.priya@greenwood.edu',
    subject: 'Mathematics',
    phone: '+91 98230 11045',
    wing: 'Primary Wing',
    is_active: true,
  },
];

const DEFAULT_STUDENTS: SchoolStudentRecord[] = [
  {
    student_id: 'stu-1',
    created_at: '2025-02-11T09:00:00.000Z',
    school_id: 'sch-101',
    full_name: 'Aarav Kulkarni',
    email: 'student.aarav@greenwood.edu',
    roll_number: 'GW-1001',
    class_name: 'Grade 10 - A',
    wing: 'Senior Wing',
    fee_tier: 'Senior Secondary',
    guardian_contact: '+91 98901 22334',
    is_active: true,
  },
  {
    student_id: 'stu-2',
    created_at: '2025-02-12T09:00:00.000Z',
    school_id: 'sch-101',
    full_name: 'Ananya Sharma',
    email: 'student.ananya@greenwood.edu',
    roll_number: 'GW-0804',
    class_name: 'Grade 8 - B',
    wing: 'Secondary Wing',
    fee_tier: 'Secondary',
    guardian_contact: '+91 98901 55678',
    is_active: true,
  },
  {
    student_id: 'stu-3',
    created_at: '2025-02-15T09:00:00.000Z',
    school_id: 'sch-101',
    full_name: 'Rohan Joshi',
    email: 'student.rohan@greenwood.edu',
    roll_number: 'GW-0412',
    class_name: 'Grade 4 - A',
    wing: 'Primary Wing',
    fee_tier: 'Primary',
    guardian_contact: '+91 98901 88990',
    is_active: true,
  },
];

const DEFAULT_CLASSES: SchoolClassRecord[] = [
  {
    class_id: 'cls-1',
    created_at: '2025-01-20T09:00:00.000Z',
    school_id: 'sch-101',
    class_name: 'Grade 10 - A',
    wing: 'Senior Wing',
    level: 'Senior Secondary',
    teacher_name: 'Mrs. Sarah Chen',
    room_no: 'S-204',
    capacity: 40,
  },
  {
    class_id: 'cls-2',
    created_at: '2025-01-21T09:00:00.000Z',
    school_id: 'sch-101',
    class_name: 'Grade 8 - B',
    wing: 'Secondary Wing',
    level: 'Secondary',
    teacher_name: 'Mr. David Wilson',
    room_no: 'M-108',
    capacity: 36,
  },
  {
    class_id: 'cls-3',
    created_at: '2025-01-22T09:00:00.000Z',
    school_id: 'sch-101',
    class_name: 'Grade 4 - A',
    wing: 'Primary Wing',
    level: 'Primary',
    teacher_name: 'Ms. Priya Nair',
    room_no: 'P-102',
    capacity: 32,
  },
];

export const DEFAULT_USER_PROFILES: SchoolUserProfileRecord[] = [
  {
    profile_uuid: 'prof-superadmin-1',
    created_at: '2025-01-01T08:00:00.000Z',
    user_uuid: '00000000-0000-4000-8000-000000000001',
    full_name: 'Platform SuperAdmin',
    user_password: null,
    school_id: null,
    user_role: 'SuperAdmin',
    is_active: true,
  },
  {
    profile_uuid: 'prof-school-101',
    created_at: '2025-01-12T08:30:00.000Z',
    user_uuid: '00000000-0000-4000-8000-000000000101',
    full_name: 'Dr. Meera Deshmukh',
    user_password: null,
    school_id: 'sch-101',
    user_role: 'School',
    is_active: true,
  },
  {
    profile_uuid: 'prof-teacher-1',
    created_at: '2025-02-01T08:00:00.000Z',
    user_uuid: '00000000-0000-4000-8000-000000000201',
    full_name: 'Mrs. Sarah Chen',
    user_password: null,
    school_id: 'sch-101',
    user_role: 'Teacher',
    is_active: true,
  },
  {
    profile_uuid: 'prof-student-1',
    created_at: '2025-02-11T09:00:00.000Z',
    user_uuid: '00000000-0000-4000-8000-000000000301',
    full_name: 'Aarav Kulkarni',
    user_password: null,
    school_id: 'sch-101',
    user_role: 'Student',
    is_active: true,
  },
];

const PRIMARY_KEY_BY_TABLE: Record<string, string> = {
  OurSchools: 'school_id',
  SchoolInfo: 'school_info_id',
  OurServicesBook: 'service_id',
  OurServiceHolder: 'holder_id',
  SchoolTeachers: 'teacher_id',
  SchoolStudents: 'student_id',
  StudentsBox: 'AddNo',
  SchoolClasses: 'class_id',
  school_user_profile: 'profile_uuid',
  school_user_info: 'profile_uuid',
  school_drive_files: 'id',
};

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStoredUser(): MockUser | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

function saveStoredUser(user: MockUser | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (user) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function createSeedTables(initialSchools?: SchoolRecord[]): Record<string, Record<string, unknown>[]> {
  return {
    OurServicesBook: DEFAULT_SERVICES.map((s) => ({ ...s })),
    OurServiceHolder: DEFAULT_SERVICE_HOLDERS.map((h) => ({ ...h })),
    OurSchools: (initialSchools ?? DEFAULT_SCHOOLS).map((s) => ({ ...s })),
    SchoolInfo: [
      {
        school_info_id: 'sinfo-101',
        created_at: '2025-01-12T08:30:00.000Z',
        school_id: 'sch-101',
        total_class: 24,
        primery_class_fee: 450,
        seconday_class_fee: 550,
        insta_id_link: 'https://instagram.com/greenwoodacademy',
        facebook_link: 'https://facebook.com/greenwoodacademy',
        youtube_link: 'https://youtube.com/@greenwoodacademy',
        is_computer_lab: true,
        is_library: true,
        about_school: 'Greenwood International Academy — unified campus management and wings.',
        school_vission: 'Empowering every learner through structured innovation.',
        school_mission: 'Delivering inclusive academic excellence and leadership.',
      },
    ],
    SchoolTeachers: DEFAULT_TEACHERS.map((t, idx) => ({
      ...t,
      user_id: `00000000-0000-4000-8000-00000000020${idx + 1}`,
      teacher_full_name: t.full_name,
      teacher_email: t.email,
      teacher_contact: t.phone,
      monthly_wage: 5500,
      joined_at: '2025-02-01',
      left_at: null,
      teacher_img: null,
    })),
    SchoolStudents: DEFAULT_STUDENTS.map((s) => ({ ...s })),
    StudentsBox: DEFAULT_STUDENTS.map((s, idx) => ({
      AddNo: s.roll_number,
      StudentName: s.full_name,
      StudentEmail: s.email,
      FatherName: 'Mr. Guardian',
      school_id: s.school_id,
      stn_user_id: `00000000-0000-4000-8000-00000000030${idx + 1}`,
      Registration_Count: 1,
      Resluted_Count: 1,
      Total_Point: 85,
      OutReach_Count: 0,
      OutReach_Points: 0,
      Achievements_Counts: 1,
      Achievements_Points: 15,
      Grand_Total_Points: 100,
      IsActive: s.is_active,
      Student_Photo_Urls: null,
      StnState: 'Maharashtra',
      StnDistrict: 'Pune',
      Stn_Class: null,
      Stn_Dob: '2011-05-14',
    })),
    SchoolClasses: DEFAULT_CLASSES.map((c) => ({ ...c })),
    school_user_profile: DEFAULT_USER_PROFILES.map((p) => ({ ...p })),
    school_user_info: DEFAULT_USER_PROFILES.map((p) => ({
      profile_uuid: p.profile_uuid,
      created_at: p.created_at,
      user_uuid: p.user_uuid,
      full_name: p.full_name,
      user_password: null,
      user_role: p.user_role,
      is_active: p.is_active,
    })),
    school_drive_files: [],
  };
}

function loadStoredTables(initialSchools?: SchoolRecord[]): Record<string, Record<string, unknown>[]> {
  if (initialSchools) return createSeedTables(initialSchools);
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createSeedTables();
    }
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) return createSeedTables();
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>[]>;
    const defaults = createSeedTables();
    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return createSeedTables();
  }
}

function saveStoredTables(tables: Record<string, Record<string, unknown>[]>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(tables));
  } catch {
    // Ignore storage errors
  }
}

export function createMockSupabaseClient(initialSchools?: SchoolRecord[]) {
  const persistToBrowser = !initialSchools;
  const tables = loadStoredTables(initialSchools);

  let currentUser: MockUser | null = persistToBrowser ? loadStoredUser() : null;
  const authListeners = new Set<AuthChangeCallback>();
  const realtimeChannels = new Map<string, RealtimeListener[]>();

  const persistIfNeeded = () => {
    if (persistToBrowser) {
      saveStoredTables(tables);
    }
  };

  const buildSession = (user: MockUser | null): MockSession | null =>
    user
      ? {
          user,
          access_token: `mock-access-${user.id}`,
          refresh_token: `mock-refresh-${user.id}`,
        }
      : null;

  const emitAuth = (event: string, user: MockUser | null) => {
    const session = buildSession(user);
    authListeners.forEach((cb) => cb(event, session));
  };

  const matchesRealtimeFilter = (filter: string | undefined, payload: RealtimePayload): boolean => {
    if (!filter) return true;
    const match = /^([^=]+)=eq\.(.+)$/.exec(filter.trim());
    if (!match) return true;
    const [, column, expected] = match;
    const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
    return String(row?.[column] ?? '') === expected;
  };

  const emitRealtime = (table: string, payload: RealtimePayload) => {
    realtimeChannels.forEach((listeners) => {
      listeners.forEach((listener) => {
        if (listener.table === table && matchesRealtimeFilter(listener.filter, payload)) {
          listener.callback(payload);
        }
      });
    });
  };

  const getTable = (table: string): Record<string, unknown>[] => {
    if (!tables[table]) {
      tables[table] = [];
    }
    return tables[table];
  };

  const resolveRoleAndSchoolForEmail = (
    email: string
  ): { userId: string; role: string; schoolId?: string } => {
    const lower = email.trim().toLowerCase();
    const schools = getTable('OurSchools') as unknown as SchoolRecord[];
    const matchedSchool = schools.find(
      (s) => s.schoole_gmail && s.schoole_gmail.trim().toLowerCase() === lower
    );
    if (matchedSchool) {
      return {
        userId: matchedSchool.user_uuid || '00000000-0000-4000-8000-000000000101',
        role: ROLES.SCHOOL,
        schoolId: matchedSchool.school_id,
      };
    }
    const teachers = getTable('SchoolTeachers') as unknown as SchoolTeacherRecord[];
    const matchedTeacher = teachers.find((t) => t.email.trim().toLowerCase() === lower);
    if (matchedTeacher) {
      return {
        userId: '00000000-0000-4000-8000-000000000201',
        role: ROLES.TEACHER,
        schoolId: matchedTeacher.school_id,
      };
    }
    const students = getTable('SchoolStudents') as unknown as SchoolStudentRecord[];
    const matchedStudent = students.find((s) => s.email.trim().toLowerCase() === lower);
    if (matchedStudent) {
      return {
        userId: '00000000-0000-4000-8000-000000000301',
        role: ROLES.STUDENT,
        schoolId: matchedStudent.school_id,
      };
    }
    const inferred = inferRoleFromEmail(lower);
    const defaultUuid =
      inferred === ROLES.SUPER_ADMIN
        ? '00000000-0000-4000-8000-000000000001'
        : inferred === ROLES.SCHOOL
          ? '00000000-0000-4000-8000-000000000101'
          : inferred === ROLES.TEACHER
            ? '00000000-0000-4000-8000-000000000201'
            : '00000000-0000-4000-8000-000000000301';
    return { userId: defaultUuid, role: inferred };
  };

  return {
    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
          return {
            data: { user: null, session: null },
            error: new Error('Email and password are required.'),
          };
        }
        const { userId, role, schoolId } = resolveRoleAndSchoolForEmail(trimmedEmail);
        const user: MockUser = {
          id: userId,
          email: trimmedEmail,
          user_metadata: { role, school_id: schoolId },
          app_metadata: { role },
        };
        currentUser = user;
        if (persistToBrowser) saveStoredUser(user);
        emitAuth('SIGNED_IN', user);
        const session = buildSession(user);
        return { data: { user, session }, error: null };
      },

      async signUp({
        email,
        password,
        options,
      }: {
        email: string;
        password: string;
        options?: { data?: { role?: string; full_name?: string; school_id?: string } };
      }) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
          return {
            data: { user: null, session: null },
            error: new Error('Email and password are required.'),
          };
        }
        const role = options?.data?.role ?? ROLES.SCHOOL;
        const user: MockUser = {
          id: generateId('user'),
          email: trimmedEmail,
          user_metadata: {
            role,
            full_name: options?.data?.full_name,
            school_id: options?.data?.school_id,
          },
          app_metadata: { role },
        };
        currentUser = user;
        if (persistToBrowser) saveStoredUser(user);
        emitAuth('SIGNED_IN', user);
        return { data: { user, session: buildSession(user) }, error: null };
      },

      async signInWithOAuth({
        provider,
        options,
      }: {
        provider: string;
        options?: { queryParams?: { login_hint?: string }; redirectTo?: string };
      }) {
        const hintEmail = options?.queryParams?.login_hint?.trim();
        const email = hintEmail || 'greenwood.academy@gmail.com';
        const { userId, role, schoolId } = resolveRoleAndSchoolForEmail(email);
        const user: MockUser = {
          id: userId,
          email,
          user_metadata: { role, full_name: 'Google Account User', school_id: schoolId },
          app_metadata: { role },
        };
        currentUser = user;
        if (persistToBrowser) saveStoredUser(user);
        emitAuth('SIGNED_IN', user);
        return { data: { provider, url: null, user }, error: null };
      },

      async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
        const trimmed = email.trim();
        if (!trimmed || !trimmed.includes('@')) {
          return { data: null, error: new Error('Please enter a valid email address.') };
        }
        return { data: {}, error: null };
      },

      async updateUser({ password }: { password?: string }) {
        if (password !== undefined && password.length < 6) {
          return {
            data: { user: null },
            error: new Error('Password must be at least 6 characters long.'),
          };
        }
        emitAuth('USER_UPDATED', currentUser);
        return { data: { user: currentUser }, error: null };
      },

      async exchangeCodeForSession(_code: string) {
        return {
          data: { user: currentUser, session: buildSession(currentUser) },
          error: null,
        };
      },

      async setSession(_tokens: { access_token: string; refresh_token: string }) {
        if (!currentUser) {
          currentUser = {
            id: generateId('oauth'),
            email: 'greenwood.academy@gmail.com',
            user_metadata: { role: ROLES.SCHOOL, school_id: 'sch-101' },
            app_metadata: { role: ROLES.SCHOOL },
          };
          if (persistToBrowser) saveStoredUser(currentUser);
        }
        emitAuth('SIGNED_IN', currentUser);
        return { data: { user: currentUser, session: buildSession(currentUser) }, error: null };
      },

      async getSession() {
        return {
          data: { session: buildSession(currentUser) },
          error: null,
        };
      },

      async getUser() {
        return {
          data: { user: currentUser },
          error: null,
        };
      },

      async signOut() {
        currentUser = null;
        if (persistToBrowser) saveStoredUser(null);
        emitAuth('SIGNED_OUT', null);
        return { error: null };
      },

      onAuthStateChange(callback: AuthChangeCallback) {
        authListeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners.delete(callback);
              },
            },
          },
        };
      },
    },

    from(table: string) {
      const pk = PRIMARY_KEY_BY_TABLE[table] ?? 'id';

      return {
        select(_columns?: string) {
          const filters: Array<(row: Record<string, unknown>) => boolean> = [];
          let orderBy: { column: string; ascending: boolean } | null = null;
          let limitCount: number | null = null;
          let singleMode: 'none' | 'maybeSingle' | 'single' = 'none';

          const execute = async () => {
            let rows = getTable(table).filter((r) => filters.every((fn) => fn(r)));
            if (orderBy) {
              const { column, ascending } = orderBy;
              rows = [...rows].sort((a, b) => {
                const rawA = a[column];
                const rawB = b[column];
                if (typeof rawA === 'number' && typeof rawB === 'number') {
                  return ascending ? rawA - rawB : rawB - rawA;
                }
                const av = String(rawA ?? '');
                const bv = String(rawB ?? '');
                return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
              });
            }
            if (limitCount !== null) {
              rows = rows.slice(0, limitCount);
            }
            const cloned = rows.map((r) => ({ ...r }));
            if (singleMode === 'maybeSingle') {
              return { data: cloned[0] ?? null, error: null };
            }
            if (singleMode === 'single') {
              if (!cloned[0]) {
                return { data: null, error: new Error('Row not found.') };
              }
              return { data: cloned[0], error: null };
            }
            return { data: cloned, error: null };
          };

          const builder = {
            eq(col: string, val: unknown) {
              filters.push((row) => row[col] === val);
              return builder;
            },
            in(col: string, values: unknown[]) {
              const allowed = new Set(values);
              filters.push((row) => allowed.has(row[col]));
              return builder;
            },
            order(column: string, opts?: { ascending?: boolean }) {
              orderBy = { column, ascending: opts?.ascending ?? true };
              return builder;
            },
            limit(count: number) {
              limitCount = Math.max(0, count);
              return builder;
            },
            maybeSingle() {
              singleMode = 'maybeSingle';
              return execute();
            },
            single() {
              singleMode = 'single';
              return execute();
            },
            then<TResult1 = { data: Record<string, unknown>[]; error: null }, TResult2 = never>(
              onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
              onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
            ) {
              return execute().then(
                onfulfilled as ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
                onrejected
              );
            },
          };

          return builder;
        },

        insert(rowsToInsert: Record<string, unknown>[]) {
          const execute = async () => {
            const rows = getTable(table);
            const created = rowsToInsert.map((item) => {
              const row: Record<string, unknown> = {
                [pk]: item[pk] ?? generateId(table.slice(0, 3).toLowerCase()),
                created_at: item.created_at ?? new Date().toISOString(),
                ...item,
              };
              rows.unshift(row);
              emitRealtime(table, { eventType: 'INSERT', new: { ...row }, old: {} });
              return { ...row };
            });
            persistIfNeeded();
            return { data: created, error: null };
          };

          return {
            select: () => execute(),
            then<TResult1 = { data: Record<string, unknown>[]; error: null }, TResult2 = never>(
              onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
              onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
            ) {
              return execute().then(onfulfilled, onrejected);
            },
          };
        },

        update(payload: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              const execute = async () => {
                const rows = getTable(table);
                const updated: Record<string, unknown>[] = [];
                for (let i = 0; i < rows.length; i += 1) {
                  if (rows[i][col] === val) {
                    const prev = { ...rows[i] };
                    rows[i] = { ...rows[i], ...payload };
                    updated.push({ ...rows[i] });
                    emitRealtime(table, {
                      eventType: 'UPDATE',
                      new: { ...rows[i] },
                      old: prev,
                    });
                  }
                }
                persistIfNeeded();
                return { data: updated, error: null };
              };

              return {
                select: () => execute(),
                then<TResult1 = { data: Record<string, unknown>[]; error: null }, TResult2 = never>(
                  onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
                  onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
                ) {
                  return execute().then(onfulfilled, onrejected);
                },
              };
            },
          };
        },

        delete() {
          return {
            eq(col: string, val: unknown) {
              const execute = async () => {
                const rows = getTable(table);
                const remaining: Record<string, unknown>[] = [];
                for (const row of rows) {
                  if (row[col] === val) {
                    emitRealtime(table, { eventType: 'DELETE', new: {}, old: { ...row } });
                  } else {
                    remaining.push(row);
                  }
                }
                tables[table] = remaining;
                persistIfNeeded();
                return { data: null, error: null };
              };
              return execute();
            },

            in(col: string, values: unknown[]) {
              const execute = async () => {
                const set = new Set(values);
                const rows = getTable(table);
                const remaining: Record<string, unknown>[] = [];
                for (const row of rows) {
                  if (set.has(row[col])) {
                    emitRealtime(table, { eventType: 'DELETE', new: {}, old: { ...row } });
                  } else {
                    remaining.push(row);
                  }
                }
                tables[table] = remaining;
                persistIfNeeded();
                return { data: null, error: null };
              };
              return execute();
            },
          };
        },
      };
    },

    channel(channelName: string) {
      const listeners: RealtimeListener[] = [];
      realtimeChannels.set(channelName, listeners);

      const channelObj = {
        name: channelName,
        on(
          _event: string,
          filter: { table: string; filter?: string },
          callback: (payload: RealtimePayload) => void
        ) {
          listeners.push({ table: filter.table, filter: filter.filter, callback });
          return channelObj;
        },
        subscribe(statusCallback?: (status: string) => void) {
          if (statusCallback) {
            queueMicrotask(() => statusCallback('SUBSCRIBED'));
          }
          return channelObj;
        },
      };

      return channelObj;
    },

    removeChannel(channelObj: { name?: string }) {
      if (channelObj?.name) {
        realtimeChannels.delete(channelObj.name);
      }
      return Promise.resolve('ok');
    },
  };
}
