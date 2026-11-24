import { isGmailAddress } from '../auth/roleResolver';
import SupaBaseClientFunction from '../SupaBaseClient/SupaBaseClientFunction';

export type DriveFolderName = 'Admissions' | 'Timetables' | 'Reports' | 'Faculty' | 'Media';

export type DriveLinkTargetTable =
  | 'school_drive_files'
  | 'OurSchools.logo_url'
  | 'SchoolTeachers.teacher_img'
  | 'StudentsBox.Student_Photo_Urls';

export interface DriveDocumentItem {
  id: string;
  school_id?: string;
  drive_file_id: string;
  name: string;
  folder: DriveFolderName;
  mimeType: string;
  updatedAt: string;
  sizeLabel: string;
  ownerGmail: string;
  accessMode: 'anyone_with_link';
  publicLink: string;
  directImageUrl: string;
  linkedTable: DriveLinkTargetTable;
  linkedRecordId?: string | null;
}

export interface DriveAccessCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Google Drive v3 permission payload that ensures every folder and uploaded file
 * is NOT restricted — anyone with the link can view/download it.
 */
export const PUBLIC_ANYONE_PERMISSION = {
  role: 'reader',
  type: 'anyone',
} as const;

const LOCAL_DRIVE_STORAGE_KEY = 'schoolgrid_public_drive_links_v2';

export function buildPublicDriveShareUrl(driveFileId: string): string {
  const cleanId = driveFileId.trim();
  return `https://drive.google.com/file/d/${encodeURIComponent(cleanId)}/view?usp=sharing`;
}

export function buildDirectDriveViewUrl(driveFileId: string): string {
  const cleanId = driveFileId.trim();
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(cleanId)}`;
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function formatBytesLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '180 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function checkSchoolDriveEligibility(
  isGdriveAllowed: boolean,
  schoolGmail?: string | null
): DriveAccessCheck {
  if (!isGdriveAllowed) {
    return {
      allowed: false,
      reason: 'Google Drive integration is disabled for this school. Contact SuperAdmin to enable it.',
    };
  }
  if (!schoolGmail || !isGmailAddress(schoolGmail)) {
    return {
      allowed: false,
      reason: 'A valid Gmail address (schoole_gmail) is required to link Google Drive storage.',
    };
  }
  return { allowed: true };
}

/**
 * Grants "Anyone with the link can view" (unrestricted public link) permission
 * on a Google Drive folder or file using Google Drive API v3.
 */
export async function grantAnyoneWithLinkPermission(
  accessToken: string,
  fileOrFolderId: string
): Promise<boolean> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileOrFolderId)}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(PUBLIC_ANYONE_PERMISSION),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to set public Drive link permission (${res.status}): ${text}`);
  }
  return true;
}

/**
 * Finds or creates a Google Drive folder and automatically makes the folder
 * publicly accessible ("Anyone with the link can view") so uploaded files inherit public access.
 */
export async function ensurePublicDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<{ folderId: string; publicFolderLink: string }> {
  const safeName = folderName.replace(/'/g, "\\'");
  const parentClause = parentFolderId ? ` and '${parentFolderId}' in parents` : '';
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false${parentClause}`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as {
      files?: Array<{ id: string; webViewLink?: string }>;
    };
    const existing = searchData.files?.[0];
    if (existing?.id) {
      await grantAnyoneWithLinkPermission(accessToken, existing.id);
      return {
        folderId: existing.id,
        publicFolderLink:
          existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}?usp=sharing`,
      };
    }
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentFolderId ? { parents: [parentFolderId] } : {}),
      }),
    }
  );

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Could not create Google Drive folder (${createRes.status}): ${text}`);
  }

  const created = (await createRes.json()) as { id: string; webViewLink?: string };
  await grantAnyoneWithLinkPermission(accessToken, created.id);

  return {
    folderId: created.id,
    publicFolderLink:
      created.webViewLink || `https://drive.google.com/drive/folders/${created.id}?usp=sharing`,
  };
}

/**
 * Uploads a File to the school's Google Drive folder, immediately applies
 * "Anyone with the link" viewer permission (NOT restricted), and returns
 * the public share URL + direct embed URL ready to save in our database tables.
 */
export async function uploadFileToPublicDriveFolder(params: {
  accessToken?: string | null;
  schoolId: string;
  schoolGmail: string;
  folder: DriveFolderName;
  file?: File | null;
  fileName: string;
  manualPublicLink?: string;
  linkedTable?: DriveLinkTargetTable;
  linkedRecordId?: string | null;
}): Promise<DriveDocumentItem> {
  const {
    accessToken,
    schoolId,
    schoolGmail,
    folder,
    file,
    fileName,
    manualPublicLink,
    linkedTable = 'school_drive_files',
    linkedRecordId = null,
  } = params;

  const cleanName = (file?.name || fileName).trim();
  const mimeType = file?.type || 'application/octet-stream';
  const sizeLabel = formatBytesLabel(file?.size ?? 180 * 1024);

  let driveFileId = `sg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let publicLink = '';
  let directImageUrl = '';

  if (accessToken && file) {
    // Real Google Drive API v3 multipart upload + automatic "anyone with link" permission
    const { folderId } = await ensurePublicDriveFolder(accessToken, `SchoolGrid - ${folder}`);
    const metadata = {
      name: cleanName,
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => '');
      throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errText}`);
    }

    const uploaded = (await uploadRes.json()) as {
      id: string;
      webViewLink?: string;
    };

    driveFileId = uploaded.id;
    await grantAnyoneWithLinkPermission(accessToken, driveFileId);
    publicLink = uploaded.webViewLink || buildPublicDriveShareUrl(driveFileId);
    directImageUrl = buildDirectDriveViewUrl(driveFileId);
  } else if (manualPublicLink && isSafeHttpUrl(manualPublicLink)) {
    // Allow pasting an existing public Drive link and auto-normalizing it
    const trimmedLink = manualPublicLink.trim();
    const idMatch = trimmedLink.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmedLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch?.[1]) {
      driveFileId = idMatch[1];
      publicLink = buildPublicDriveShareUrl(driveFileId);
      directImageUrl = buildDirectDriveViewUrl(driveFileId);
    } else {
      publicLink = trimmedLink;
      directImageUrl = trimmedLink;
    }
  } else {
    publicLink = buildPublicDriveShareUrl(driveFileId);
    directImageUrl = buildDirectDriveViewUrl(driveFileId);
  }

  const doc: DriveDocumentItem = {
    id: `drv-${Date.now()}`,
    school_id: schoolId,
    drive_file_id: driveFileId,
    name: cleanName,
    folder,
    mimeType,
    updatedAt: new Date().toISOString().slice(0, 10),
    sizeLabel,
    ownerGmail: schoolGmail,
    accessMode: 'anyone_with_link',
    publicLink,
    directImageUrl,
    linkedTable,
    linkedRecordId,
  };

  await saveDriveFileLinkToTable(doc);
  return doc;
}

function readLocalDriveLinks(): DriveDocumentItem[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(LOCAL_DRIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DriveDocumentItem[]) : [];
  } catch {
    return [];
  }
}

function writeLocalDriveLinks(items: DriveDocumentItem[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LOCAL_DRIVE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Persists the uploaded file's public link into our database table:
 * - Saves a record to `public.school_drive_files` (with fallback to local storage if table not yet migrated).
 * - If `linkedTable` targets `OurSchools.logo_url`, `SchoolTeachers.teacher_img`, or
 *   `StudentsBox.Student_Photo_Urls`, automatically updates that row with the public Drive link!
 */
export async function saveDriveFileLinkToTable(doc: DriveDocumentItem): Promise<{
  savedToSupabase: boolean;
  linkedColumnUpdated: boolean;
}> {
  const supabase = SupaBaseClientFunction();
  let savedToSupabase = false;
  let linkedColumnUpdated = false;

  // 1. Save metadata & public share link to school_drive_files table
  try {
    const { error } = await supabase.from('school_drive_files').insert([
      {
        school_id: doc.school_id ?? null,
        drive_file_id: doc.drive_file_id,
        file_name: doc.name,
        folder_name: doc.folder,
        mime_type: doc.mimeType,
        size_label: doc.sizeLabel,
        owner_gmail: doc.ownerGmail,
        access_mode: 'anyone_with_link',
        public_link: doc.publicLink,
        direct_url: doc.directImageUrl,
        linked_table: doc.linkedTable,
        linked_record_id: doc.linkedRecordId ?? null,
      },
    ]);
    if (!error) savedToSupabase = true;
  } catch {
    // Table may not exist yet — local cache preserves link smoothly
  }

  // 2. If user selected a target entity column, save the public link right into that table too!
  try {
    if (doc.linkedTable === 'OurSchools.logo_url' && doc.school_id) {
      const { error } = await supabase
        .from('OurSchools')
        .update({ logo_url: doc.directImageUrl })
        .eq('school_id', doc.school_id);
      if (!error) linkedColumnUpdated = true;
    } else if (doc.linkedTable === 'SchoolTeachers.teacher_img' && doc.linkedRecordId) {
      const { error } = await supabase
        .from('SchoolTeachers')
        .update({ teacher_img: doc.directImageUrl })
        .eq('teacher_id', doc.linkedRecordId);
      if (!error) linkedColumnUpdated = true;
    } else if (doc.linkedTable === 'StudentsBox.Student_Photo_Urls' && doc.linkedRecordId) {
      const { error } = await supabase
        .from('StudentsBox')
        .update({ Student_Photo_Urls: doc.directImageUrl })
        .eq('AddNo', doc.linkedRecordId);
      if (!error) linkedColumnUpdated = true;
    }
  } catch {
    // Non-fatal if target table has custom RLS
  }

  const existing = readLocalDriveLinks();
  writeLocalDriveLinks([doc, ...existing.filter((item) => item.drive_file_id !== doc.drive_file_id)]);

  return { savedToSupabase, linkedColumnUpdated };
}

export async function listPublicDriveFiles(
  schoolId: string,
  schoolGmail: string
): Promise<DriveDocumentItem[]> {
  const supabase = SupaBaseClientFunction();
  try {
    const { data, error } = await supabase
      .from('school_drive_files')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return (data as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? row.drive_file_id ?? Date.now()),
        school_id: String(row.school_id ?? schoolId),
        drive_file_id: String(row.drive_file_id ?? ''),
        name: String(row.file_name ?? 'Untitled'),
        folder: (row.folder_name as DriveFolderName) || 'Admissions',
        mimeType: String(row.mime_type ?? 'application/octet-stream'),
        updatedAt: String(row.created_at ?? new Date().toISOString()).slice(0, 10),
        sizeLabel: String(row.size_label ?? '—'),
        ownerGmail: String(row.owner_gmail ?? schoolGmail),
        accessMode: 'anyone_with_link',
        publicLink: String(row.public_link ?? ''),
        directImageUrl: String(row.direct_url ?? row.public_link ?? ''),
        linkedTable: (row.linked_table as DriveLinkTargetTable) || 'school_drive_files',
        linkedRecordId: row.linked_record_id ? String(row.linked_record_id) : null,
      }));
    }
  } catch {
    // Fall back to local cache + initial sample docs
  }

  const local = readLocalDriveLinks().filter((d) => !d.school_id || d.school_id === schoolId);
  if (local.length > 0) return local;
  return createInitialDriveDocuments(schoolGmail, schoolId);
}

export function createInitialDriveDocuments(
  schoolGmail: string,
  schoolId?: string
): DriveDocumentItem[] {
  return [
    {
      id: 'drv-1',
      school_id: schoolId,
      drive_file_id: '1SgAcademicCalendar2026',
      name: 'Academic-Calendar-2026.pdf',
      folder: 'Timetables',
      mimeType: 'application/pdf',
      updatedAt: '2026-04-12',
      sizeLabel: '420 KB',
      ownerGmail: schoolGmail,
      accessMode: 'anyone_with_link',
      publicLink: buildPublicDriveShareUrl('1SgAcademicCalendar2026'),
      directImageUrl: buildDirectDriveViewUrl('1SgAcademicCalendar2026'),
      linkedTable: 'school_drive_files',
    },
    {
      id: 'drv-2',
      school_id: schoolId,
      drive_file_id: '1SgAdmissionForms2026',
      name: 'Student-Admission-Forms.xlsx',
      folder: 'Admissions',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      updatedAt: '2026-04-18',
      sizeLabel: '1.2 MB',
      ownerGmail: schoolGmail,
      accessMode: 'anyone_with_link',
      publicLink: buildPublicDriveShareUrl('1SgAdmissionForms2026'),
      directImageUrl: buildDirectDriveViewUrl('1SgAdmissionForms2026'),
      linkedTable: 'school_drive_files',
    },
    {
      id: 'drv-3',
      school_id: schoolId,
      drive_file_id: '1SgTerm1Grades2026',
      name: 'Term-1-Grade-Summary.csv',
      folder: 'Reports',
      mimeType: 'text/csv',
      updatedAt: '2026-04-21',
      sizeLabel: '285 KB',
      ownerGmail: schoolGmail,
      accessMode: 'anyone_with_link',
      publicLink: buildPublicDriveShareUrl('1SgTerm1Grades2026'),
      directImageUrl: buildDirectDriveViewUrl('1SgTerm1Grades2026'),
      linkedTable: 'school_drive_files',
    },
  ];
}
