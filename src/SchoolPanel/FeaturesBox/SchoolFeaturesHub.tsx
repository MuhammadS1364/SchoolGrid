import { useState, type FormEvent } from 'react';
import { HardDrive, Lock, Mail, MessageSquare, Plus, Send } from 'lucide-react';
import {
  checkSchoolDriveEligibility,
  createInitialDriveDocuments,
  type DriveDocumentItem,
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
  const { school } = useActiveSchool();

  const [driveDocs, setDriveDocs] = useState<DriveDocumentItem[]>(() =>
    createInitialDriveDocuments(school?.schoole_gmail || 'school@gmail.com')
  );
  const [newDocName, setNewDocName] = useState('');
  const [newDocFolder, setNewDocFolder] =
    useState<DriveDocumentItem['folder']>('Admissions');

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

  if (!school) return null;

  const driveCheck = checkSchoolDriveEligibility(
    school.is_gdrive_allowed,
    school.schoole_gmail
  );

  const handleAddDriveDoc = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!driveCheck.allowed || !newDocName.trim()) return;
    setDriveDocs((prev) => [
      {
        id: `drv-${Date.now()}`,
        name: newDocName.trim(),
        folder: newDocFolder,
        updatedAt: new Date().toISOString().slice(0, 10),
        sizeLabel: '180 KB',
        ownerGmail: school.schoole_gmail || '',
      },
      ...prev,
    ]);
    setNewDocName('');
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
          Feature access is read-only for schools and controlled strictly by SuperAdmin based on
          your approved plan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Google Drive Workspace */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-5 w-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Google Drive Storage</h2>
                <p className="text-xs text-slate-500">
                  Account: {school.schoole_gmail || 'No Gmail configured'}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                driveCheck.allowed ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {driveCheck.allowed ? 'Active' : 'Locked'}
            </span>
          </div>

          {!driveCheck.allowed ? (
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>{driveCheck.reason}</p>
            </div>
          ) : (
            <>
              <form onSubmit={handleAddDriveDoc} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Document filename (e.g. Exam-Schedule.pdf)"
                  required
                  className="h-9 flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 text-sm"
                />
                <select
                  value={newDocFolder}
                  onChange={(e) =>
                    setNewDocFolder(e.target.value as DriveDocumentItem['folder'])
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium"
                >
                  <option value="Admissions">Admissions</option>
                  <option value="Timetables">Timetables</option>
                  <option value="Reports">Reports</option>
                  <option value="Faculty">Faculty</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Sync File
                </button>
              </form>

              <ul className="divide-y divide-slate-100 text-sm">
                {driveDocs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">
                        {doc.folder} · {doc.sizeLabel} · {doc.updatedAt}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">Synced</span>
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
