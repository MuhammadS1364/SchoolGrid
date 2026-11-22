import { isGmailAddress } from '../auth/roleResolver';

export interface DriveDocumentItem {
  id: string;
  name: string;
  folder: 'Admissions' | 'Timetables' | 'Reports' | 'Faculty';
  updatedAt: string;
  sizeLabel: string;
  ownerGmail: string;
}

export interface DriveAccessCheck {
  allowed: boolean;
  reason?: string;
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

export function createInitialDriveDocuments(schoolGmail: string): DriveDocumentItem[] {
  return [
    {
      id: 'drv-1',
      name: 'Academic-Calendar-2026.pdf',
      folder: 'Timetables',
      updatedAt: '2026-04-12',
      sizeLabel: '420 KB',
      ownerGmail: schoolGmail,
    },
    {
      id: 'drv-2',
      name: 'Student-Admission-Forms.xlsx',
      folder: 'Admissions',
      updatedAt: '2026-04-18',
      sizeLabel: '1.2 MB',
      ownerGmail: schoolGmail,
    },
    {
      id: 'drv-3',
      name: 'Term-1-Grade-Summary.csv',
      folder: 'Reports',
      updatedAt: '2026-04-21',
      sizeLabel: '285 KB',
      ownerGmail: schoolGmail,
    },
  ];
}
