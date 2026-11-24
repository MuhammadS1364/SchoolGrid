import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  HardDrive,
  Lock,
  Mail,
  MessageSquare,
  Send,
  Upload,
} from 'lucide-react';
import {
  checkSchoolDriveEligibility,
  listPublicDriveFiles,
  uploadFileToPublicDriveFolder,
  type DriveDocumentItem,
  type DriveFolderName,
  type DriveLinkTargetTable,
} from '../../lib/GooglDrive/GoogleDrive';
import { useActiveSchool } from '../SchoolContext';

interface SentAnnouncement {
  id: string;
  audience: string;
  subject: string;
  sentAt: string;
}

interface CollabNote {
  id: string;
  author: string;
  wing: string;
  message: string;
  createdAt: string;
}

export default function SchoolFeaturesHub() {
  const { school, refreshSchool } = useActiveSchool();

  const [driveDocs, setDriveDocs] = useState<DriveDocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [manualPublicLink, setManualPublicLink] = useState('');
  const [newDocFolder, setNewDocFolder] = useState<DriveFolderName>('Admissions');
  const [linkedTable, setLinkedTable] = useState<DriveLinkTargetTable>('school_drive_files');
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [mailAudience, setMailAudience] = useState('All Teachers & Students');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [sentEmails, setSentEmails] = useState<SentAnnouncement[]>([]);

  const [collabNote, setCollabNote] = useState('');
  const [collabNotes, setCollabNotes] = useState<CollabNote[]>([
    {
      id: 'cn-1',
      author: 'Academic Coordinator',
      wing: 'Science Wing',
      message: 'Mid-term practical lab timetable uploaded for Grades 9–12.',
      createdAt: 'Today, 09:40 AM',
    },
  ]);

  useEffect(() => {
    if (!school) return;
    let active = true;
    void listPublicDriveFiles(school.school_id, school.schoole_gmail || 'school@gmail.com').then(
      (docs) => {
        if (active) setDriveDocs(docs);
      }
    );
    return () => {
      active = false;
    };
  }, [school]);

  if (!school) return null;

  const driveCheck = checkSchoolDriveEligibility(
    school.is_gdrive_allowed,
    school.schoole_gmail
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !newDocName.trim()) {
      setNewDocName(file.name);
    }
  };

  const handleUploadPublicDriveDoc = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!driveCheck.allowed) return;
    const targetName = (selectedFile?.name || newDocName).trim();
    if (!targetName) return;

    setUploadingDrive(true);
    setDriveStatus(null);
    try {
      // Uses provider_token if available from Google OAuth sign-in, otherwise generates & stores public share link
      const doc = await uploadFileToPublicDriveFolder({
        schoolId: school.school_id,
        schoolGmail: school.schoole_gmail || '',
        folder: newDocFolder,
        file: selectedFile,
        fileName: targetName,
        manualPublicLink: manualPublicLink.trim() || undefined,
        linkedTable,
        linkedRecordId: linkedTable === 'OurSchools.logo_url' ? school.school_id : null,
      });

      setDriveDocs((prev) => [doc, ...prev.filter((item) => item.drive_file_id !== doc.drive_file_id)]);
      setSelectedFile(null);
      setNewDocName('');
      setManualPublicLink('');
      if (linkedTable === 'OurSchools.logo_url') {
        await refreshSchool();
        setDriveStatus(
          `Uploaded "${doc.name}" with Anyone-with-Link public access and saved the link to school_drive_files & OurSchools.logo_url.`
        );
      } else {
        setDriveStatus(
          `Uploaded "${doc.name}" with Anyone-with-Link public access (not restricted) and saved the public link to our table.`
        );
      }
    } catch (err) {
      setDriveStatus(err instanceof Error ? err.message : 'Failed to upload public Drive file.');
    } finally {
      setUploadingDrive(false);
    }
  };

  const copyPublicLink = async (doc: DriveDocumentItem) => {
    try {
      await navigator.clipboard.writeText(doc.publicLink);
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setDriveStatus(`Public link: ${doc.publicLink}`);
    }
  };

  const handleSendEmail = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!school.is_email_service || !mailSubject.trim()) return;
    setSentEmails((prev) => [
      {
        id: `em-${Date.now()}`,
        audience: mailAudience,
        subject: mailSubject.trim(),
        sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
    setMailSubject('');
    setMailBody('');
  };

  const handleAddCollabNote = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!school.is_collaburation_allowed || !collabNote.trim()) return;
    setCollabNotes((prev) => [
      {
        id: `cn-${Date.now()}`,
        author: school.school_manager || 'School Admin',
        wing: 'All Wings',
        message: collabNote.trim(),
        createdAt: 'Just now',
      },
      ...prev,
    ]);
    setCollabNote('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Plan Feature Workspace
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Feature access is controlled by SuperAdmin. Uploaded Google Drive files automatically use
          unrestricted &ldquo;Anyone with the link&rdquo; sharing and save their links to our database.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Public Google Drive Folder Workspace */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-5 w-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Google Drive Public Folder Storage
                </h2>
                <p className="text-xs text-slate-500">
                  Account: {school.schoole_gmail || 'No Gmail configured'} · Access: Anyone with link
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                driveCheck.allowed ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {driveCheck.allowed ? 'Public Folder Active' : 'Locked'}
            </span>
          </div>

          {!driveCheck.allowed ? (
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>{driveCheck.reason}</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>
                  Every file uploaded here receives <strong>Anyone with the link (Viewer)</strong>{' '}
                  permission (not restricted) and its public share link is saved in{' '}
                  <code className="font-mono">school_drive_files</code>.
                </span>
              </div>

              {driveStatus && (
                <div
                  role="status"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800"
                >
                  {driveStatus}
                </div>
              )}

              <form onSubmit={handleUploadPublicDriveDoc} className="space-y-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="File title (e.g. School-Logo.png)"
                    required={!selectedFile}
                    className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
                  />
                  <select
                    aria-label="Drive folder"
                    value={newDocFolder}
                    onChange={(e) => setNewDocFolder(e.target.value as DriveFolderName)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium"
                  >
                    <option value="Admissions">Folder: Admissions</option>
                    <option value="Timetables">Folder: Timetables</option>
                    <option value="Reports">Folder: Reports</option>
                    <option value="Faculty">Folder: Faculty</option>
                    <option value="Media">Folder: Media &amp; Photos</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-xs text-slate-600 hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                    <span className="truncate">
                      {selectedFile ? selectedFile.name : 'Choose file to upload...'}
                    </span>
                    <input type="file" onChange={handleFileChange} className="sr-only" />
                  </label>

                  <select
                    aria-label="Save public link to table"
                    value={linkedTable}
                    onChange={(e) => setLinkedTable(e.target.value as DriveLinkTargetTable)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium"
                  >
                    <option value="school_drive_files">Save to: school_drive_files</option>
                    <option value="OurSchools.logo_url">Also set OurSchools.logo_url</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="url"
                    value={manualPublicLink}
                    onChange={(e) => setManualPublicLink(e.target.value)}
                    placeholder="Optional: paste existing Google Drive share URL"
                    className="h-9 flex-1 min-w-[200px] rounded-lg border border-slate-200 px-3 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={uploadingDrive}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingDrive ? 'Saving...' : 'Upload & Save Public Link'}
                  </button>
                </div>
              </form>

              <ul className="divide-y divide-slate-100 text-sm">
                {driveDocs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">
                        {doc.folder} · {doc.sizeLabel} ·{' '}
                        <span className="text-emerald-700 font-medium">Anyone with link</span> ·{' '}
                        <span className="font-mono text-[11px]">{doc.linkedTable}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void copyPublicLink(doc)}
                        aria-label={`Copy public link for ${doc.name}`}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {copiedId === doc.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy Link
                          </>
                        )}
                      </button>
                      <a
                        href={doc.publicLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open public Drive link for ${doc.name}`}
                        className="inline-flex h-7 items-center gap-1 rounded bg-slate-900 px-2 text-[11px] font-medium text-white hover:bg-slate-800"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* 2. Email Service */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Mail className="h-5 w-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">School Email Service</h2>
                <p className="text-xs text-slate-500">
                  Send notices to faculty and student guardians
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                school.is_email_service ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {school.is_email_service ? 'Active' : 'Locked'}
            </span>
          </div>

          {!school.is_email_service ? (
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                Email Service is currently disabled for this school. SuperAdmin can turn it ON from
                the Schools control panel.
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSendEmail} className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={mailAudience}
                    onChange={(e) => setMailAudience(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium"
                  >
                    <option>All Teachers &amp; Students</option>
                    <option>Teachers Only</option>
                    <option>Students &amp; Guardians</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={mailSubject}
                    onChange={(e) => setMailSubject(e.target.value)}
                    placeholder="Announcement subject..."
                    className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </div>
                <textarea
                  rows={2}
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  placeholder="Write your notice message..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Dispatch
                </button>
              </form>

              {sentEmails.length > 0 && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2 text-xs">
                  {sentEmails.map((em) => (
                    <li key={em.id} className="flex items-center justify-between py-2">
                      <span className="font-medium text-slate-800">
                        {em.subject} ({em.audience})
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">{em.sentAt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* 3. Collaboration Workspace */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Cross-Wing Collaboration Board
                </h2>
                <p className="text-xs text-slate-500">
                  Coordinate schedules, exams, and wing updates across staff
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                school.is_collaburation_allowed ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {school.is_collaburation_allowed ? 'Active' : 'Locked'}
            </span>
          </div>

          {!school.is_collaburation_allowed ? (
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                Collaboration Workspace is disabled for this school. SuperAdmin controls this toggle
                from the Schools panel.
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleAddCollabNote} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  required
                  value={collabNote}
                  onChange={(e) => setCollabNote(e.target.value)}
                  placeholder="Share a coordination note with faculty wings..."
                  className="h-10 flex-1 rounded-lg border border-slate-200 px-3.5 text-sm"
                />
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  Post Update
                </button>
              </form>

              <ul className="divide-y divide-slate-100">
                {collabNotes.map((note) => (
                  <li key={note.id} className="py-3">
                    <p className="text-sm text-slate-800">{note.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {note.author} · {note.wing} · {note.createdAt}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
