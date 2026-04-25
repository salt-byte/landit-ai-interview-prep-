import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  X,
  Loader2,
  Globe,
  Check,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { UploadedFile, RoleSource, UserProfile } from '../types';
import { uploadAndParseDocument, uploadDocument, uploadRoleSource, addLinkSource } from '../api';
import { extractPdfText, isPdfFile } from '../lib/pdfExtract';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (file: UploadedFile | RoleSource) => void;
  onProfileExtracted?: (extracted: Partial<UserProfile>) => void;
  /** When provided, uploads go to the role-specific endpoint instead of profile */
  roleId?: string;
  /** When true, skip backend API calls and create local-only entries */
  isGuest?: boolean;
}

const PROFILE_SOURCE_TYPES = ['Resume', 'Portfolio', 'Work Sample', 'Cover Letter', 'Other'];
const ROLE_SOURCE_TYPES = ['Job Description', 'Company & Team Overview', 'Product Overview', 'Industry Insights', 'Interview Experiences', 'Other'];

// Time-keyed parse stages — message rotates as elapsed seconds cross each threshold.
// We never claim 100% until the request actually returns.
const RESUME_PARSE_STAGES: { atSec: number; message: string; sub: string }[] = [
  { atSec: 0,  message: 'Uploading your file…',           sub: 'Securely transferring to our servers' },
  { atSec: 3,  message: 'Reading document content…',      sub: 'Extracting text from your resume' },
  { atSec: 7,  message: 'AI is analyzing your experience…', sub: 'Identifying companies, roles, and dates' },
  { atSec: 14, message: 'Mapping your skills…',           sub: 'Recognizing technical, tools, and soft skills' },
  { atSec: 20, message: 'Structuring your projects…',     sub: 'Pulling out projects and outcomes' },
  { atSec: 28, message: 'Almost done — finalizing…',      sub: 'Polishing the structured profile' },
  { atSec: 40, message: 'Just a few more seconds…',       sub: 'Long resumes take a bit more time' },
];

const SIMPLE_UPLOAD_STAGES: { atSec: number; message: string; sub: string }[] = [
  { atSec: 0, message: 'Uploading your file…', sub: 'Securely transferring to our servers' },
  { atSec: 5, message: 'Saving to your library…', sub: 'Indexing for future reference' },
];

function pickStage(stages: { atSec: number; message: string; sub: string }[], elapsedSec: number) {
  let current = stages[0];
  for (const s of stages) {
    if (elapsedSec >= s.atSec) current = s;
  }
  return current;
}

const AddSourceModal: React.FC<AddSourceModalProps> = ({ isOpen, onClose, onAddSource, onProfileExtracted, roleId, isGuest }) => {
  const SOURCE_TYPES = roleId ? ROLE_SOURCE_TYPES : PROFILE_SOURCE_TYPES;
  const [step, setStep] = useState<'SELECT' | 'UPLOAD' | 'LINK' | 'PREVIEW'>('SELECT');
  const [selectedFileType, setSelectedFileType] = useState<string>(SOURCE_TYPES[0]);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: string } | null>(null);
  const [pendingFileObj, setPendingFileObj] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');

  // Parsing/Upload State
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'PARSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [parsedContent, setParsedContent] = useState('');

  // Fake-but-believable progress: tracks elapsed seconds since we entered a working state,
  // and eases a percentage from 0 → 95. Jumps to 100 on SUCCESS.
  const [elapsedSec, setElapsedSec] = useState(0);
  const [fakeProgress, setFakeProgress] = useState(0);
  const workStartRef = useRef<number | null>(null);

  useEffect(() => {
    const isWorking = uploadStatus === 'UPLOADING' || uploadStatus === 'PARSING';
    if (isWorking) {
      if (workStartRef.current == null) workStartRef.current = Date.now();
      const tick = () => {
        const start = workStartRef.current;
        if (start == null) return;
        const sec = (Date.now() - start) / 1000;
        setElapsedSec(sec);
        // Ease toward 95%: fast at first, slow near the end. 1 - e^(-t/15) gives a nice curve.
        const eased = 95 * (1 - Math.exp(-sec / 15));
        setFakeProgress(eased);
      };
      tick();
      const id = setInterval(tick, 200);
      return () => clearInterval(id);
    }
    if (uploadStatus === 'SUCCESS') {
      setFakeProgress(100);
      return;
    }
    if (uploadStatus === 'IDLE' || uploadStatus === 'ERROR') {
      workStartRef.current = null;
      setElapsedSec(0);
      setFakeProgress(0);
    }
  }, [uploadStatus]);

  // Pre-upload: start uploading as soon as file is selected
  const preUploadPromiseRef = useRef<Promise<any> | null>(null);
  const preUploadTypeRef = useRef<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPendingFile({ name: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB' });
      setPendingFileObj(file);

      // Auto-suggest type
      const lowerName = file.name.toLowerCase();
      let detectedType = 'Other';
      if (roleId) {
        if (lowerName.includes('jd') || lowerName.includes('job')) detectedType = 'Job Description';
        else if (lowerName.includes('company') || lowerName.includes('team')) detectedType = 'Company & Team Overview';
        else if (lowerName.includes('product')) detectedType = 'Product Overview';
        else if (lowerName.includes('industry') || lowerName.includes('market')) detectedType = 'Industry Insights';
        else if (lowerName.includes('interview') || lowerName.includes('glassdoor')) detectedType = 'Interview Experiences';
      } else {
        if (lowerName.includes('resume') || lowerName.includes('cv') || lowerName.includes('简历')) detectedType = 'Resume';
        else if (lowerName.includes('portfolio')) detectedType = 'Portfolio';
        else if (lowerName.includes('sample')) detectedType = 'Work Sample';
        else if (lowerName.includes('cover')) detectedType = 'Cover Letter';
      }
      setSelectedFileType(detectedType);

      // Start uploading silently in the background (non-guest, non-role)
      // Don't change uploadStatus — keep UI showing file preview until user clicks Upload
      if (!isGuest && !roleId) {
        preUploadTypeRef.current = detectedType;
        if (detectedType === 'Resume') {
          // For resumes, extract PDF text in-browser (parallel with the upload).
          // Sending pre-extracted text lets the backend skip its own pypdf parse.
          // Falls back to backend parsing if extraction fails or it's not a PDF.
          const textPromise = isPdfFile(file)
            ? extractPdfText(file).catch(() => '')
            : Promise.resolve('');
          preUploadPromiseRef.current = textPromise.then(text =>
            uploadAndParseDocument(file, text || undefined),
          );
        } else {
          preUploadPromiseRef.current = uploadDocument(file);
        }
      }
    }
  };

  // Flow A: Upload File — awaits pre-started upload or starts new one
  const handleUploadFile = async () => {
    if (!pendingFile || !pendingFileObj) return;
    try {
      if (isGuest) {
        setUploadStatus('UPLOADING');
        await new Promise(r => setTimeout(r, 500));
        const localFile: UploadedFile = {
          id: `local-${Date.now()}`,
          name: pendingFile.name,
          type: selectedFileType,
          date: new Date().toISOString().split('T')[0],
        };
        setUploadStatus('SUCCESS');
        onAddSource(localFile);
        setTimeout(handleClose, 800);
        return;
      }
      if (roleId) {
        setUploadStatus('UPLOADING');
        const result = await uploadRoleSource(roleId, pendingFileObj);
        setUploadStatus('SUCCESS');
        onAddSource(result);
      } else if (preUploadPromiseRef.current && preUploadTypeRef.current === selectedFileType) {
        // Pre-upload already started in the background when the file was selected;
        // by the time the user clicks Upload, we're realistically in the parsing phase.
        setUploadStatus('PARSING');
        const result = await preUploadPromiseRef.current;
        preUploadPromiseRef.current = null;
        setUploadStatus('SUCCESS');
        if (selectedFileType === 'Resume') {
          onAddSource(result.document);
          if (result.extracted && onProfileExtracted) {
            onProfileExtracted(result.extracted);
          }
        } else {
          onAddSource({ id: String(result.id ?? Date.now()), name: result.name, type: result.type, date: result.date });
        }
      } else {
        // Type changed or no pre-upload, start fresh
        preUploadPromiseRef.current = null;
        if (selectedFileType === 'Resume') {
          setUploadStatus('PARSING');
          const text = isPdfFile(pendingFileObj)
            ? await extractPdfText(pendingFileObj).catch(() => '')
            : '';
          const result = await uploadAndParseDocument(pendingFileObj, text || undefined);
          setUploadStatus('SUCCESS');
          onAddSource(result.document);
          if (result.extracted && onProfileExtracted) {
            onProfileExtracted(result.extracted);
          }
        } else {
          setUploadStatus('UPLOADING');
          const result = await uploadDocument(pendingFileObj);
          setUploadStatus('SUCCESS');
          onAddSource({ id: String(result.id ?? Date.now()), name: result.name, type: result.type, date: result.date });
        }
      }
      setTimeout(handleClose, 800);
    } catch {
      setUploadStatus('ERROR');
    }
  };

  // Flow B: Add Link
  const handleParseLink = async () => {
    if (!linkUrl.trim()) return;
    setUploadStatus('PARSING');
    try {
      if (roleId) {
        // Role context: add link to role-specific endpoint
        const result = await addLinkSource(roleId, linkUrl.trim());
        setUploadStatus('SUCCESS');
        onAddSource(result);
        setTimeout(handleClose, 800);
      } else {
        // Profile context: mock parse for preview
        setTimeout(() => {
          setUploadStatus('IDLE');
          setStep('PREVIEW');
          setParsedContent(`[Parsed from Link: ${linkUrl}]\n\nSummary:\nExperienced professional with a background in digital transformation.\n\nProjects:\n- E-commerce Optimization\n- Mobile App Launch`);
        }, 1500);
      }
    } catch {
      setUploadStatus('ERROR');
    }
  };

  const handleConfirmLink = () => {
    const newFile: UploadedFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: linkUrl.replace(/^https?:\/\//, '').split('/')[0] || 'Web Link',
      type: 'Link',
      date: new Date().toISOString().split('T')[0],
    };

    onAddSource(newFile);
    handleClose();
  };

  const handleClose = () => {
    setStep('SELECT');
    setPendingFile(null);
    setPendingFileObj(null);
    setLinkUrl('');
    setParsedContent('');
    setUploadStatus('IDLE');
    preUploadPromiseRef.current = null;
    preUploadTypeRef.current = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#1F1F1F]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[14px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-[#E3E3E3] flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#1F1F1F]">
            {step === 'SELECT' && 'Add Source Material'}
            {step === 'UPLOAD' && 'Upload File'}
            {step === 'LINK' && 'Add Link'}
            {step === 'PREVIEW' && 'Preview & Parse'}
          </h3>
          <button onClick={handleClose} className="text-[#444746] hover:text-[#1F1F1F]">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8">
          {/* STEP 1: SELECT */}
          {step === 'SELECT' && (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setStep('UPLOAD')}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:bg-[#F0F4F9] transition-all group"
              >
                <div className="p-3 bg-[#E3E3E3] rounded-full text-[#444746] group-hover:bg-[#0B57D0] group-hover:text-white transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="font-bold text-[#1F1F1F]">Upload File</span>
              </button>
              <button 
                onClick={() => setStep('LINK')}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:bg-[#F0F4F9] transition-all group"
              >
                <div className="p-3 bg-[#E3E3E3] rounded-full text-[#444746] group-hover:bg-[#0B57D0] group-hover:text-white transition-colors">
                  <Globe className="w-6 h-6" />
                </div>
                <span className="font-bold text-[#1F1F1F]">Add Link</span>
              </button>
            </div>
          )}

          {/* STEP 2A: UPLOAD */}
          {step === 'UPLOAD' && (
            <div className="space-y-6">
              {uploadStatus === 'IDLE' ? (
                <>
                  <label className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-[#C4C7C5] rounded-xl cursor-pointer hover:bg-[#F0F4F9] hover:border-[#0B57D0] transition-all">
                    {pendingFile ? (
                      <div className="text-center">
                        <FileText className="w-8 h-8 text-[#0B57D0] mx-auto mb-2" />
                        <p className="font-bold text-[#1F1F1F]">{pendingFile.name}</p>
                        <p className="text-xs text-[#444746]">{pendingFile.size}</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-[#C4C7C5] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[#444746]">Click to select a file</p>
                        <p className="text-xs text-[#C4C7C5] mt-1">PDF, DOCX, TXT</p>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">Content Type</label>
                    <select 
                      value={selectedFileType} 
                      onChange={(e) => setSelectedFileType(e.target.value)}
                      className="w-full p-3 bg-[#F0F4F9] border-none rounded-xl text-[#1F1F1F] font-medium outline-none focus:ring-2 focus:ring-[#0B57D0]"
                    >
                      {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-2 space-y-5">
                  {uploadStatus === 'SUCCESS' ? (
                    <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center text-[#137333] animate-in zoom-in duration-300">
                      <Check className="w-8 h-8" />
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-[#F0F4F9] flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-[#0B57D0] animate-pulse" />
                      </div>
                      <Loader2 className="w-20 h-20 text-[#0B57D0]/50 animate-spin absolute -top-2 -left-2" />
                    </div>
                  )}

                  <div className="text-center">
                    {(() => {
                      if (uploadStatus === 'SUCCESS') {
                        return (
                          <>
                            <h4 className="text-lg font-bold text-[#1F1F1F] mb-1">Done!</h4>
                            <p className="text-sm text-[#444746]">File added to your profile.</p>
                          </>
                        );
                      }
                      const isResumeParse = uploadStatus === 'PARSING' && selectedFileType === 'Resume';
                      const stages = isResumeParse ? RESUME_PARSE_STAGES : SIMPLE_UPLOAD_STAGES;
                      const stage = pickStage(stages, elapsedSec);
                      return (
                        <>
                          <h4 className="text-lg font-bold text-[#1F1F1F] mb-1 transition-opacity duration-300">
                            {stage.message}
                          </h4>
                          <p className="text-sm text-[#444746] transition-opacity duration-300">
                            {stage.sub}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Progress bar — fake but believable. Eases to 95%, jumps to 100% on success. */}
                  <div className="w-full max-w-xs">
                    <div className="h-1.5 bg-[#F0F4F9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0B57D0] to-[#5B8DEF] rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${fakeProgress}%` }}
                      />
                    </div>
                    {uploadStatus !== 'SUCCESS' && (
                      <p className="text-xs text-[#C4C7C5] mt-2 text-center tabular-nums">
                        {Math.round(fakeProgress)}% · {Math.floor(elapsedSec)}s
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2B: LINK */}
          {step === 'LINK' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">URL</label>
                <input 
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://"
                  className="w-full p-3 bg-[#F0F4F9] border-none rounded-xl text-[#1F1F1F] outline-none focus:ring-2 focus:ring-[#0B57D0]"
                />
                <p className="text-xs text-[#444746] mt-2">For example: LinkedIn profile or company career page.</p>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW (Only for Links) */}
          {step === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="bg-[#F0F4F9] p-4 rounded-xl max-h-60 overflow-y-auto">
                <textarea 
                  value={parsedContent}
                  onChange={(e) => setParsedContent(e.target.value)}
                  className="w-full h-40 bg-transparent border-none outline-none text-sm text-[#1F1F1F] font-mono resize-none"
                />
              </div>
              <p className="text-xs text-[#444746]">You can edit the parsed content before adding it to your profile.</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-[#FAFAFA] border-t border-[#E3E3E3] flex justify-between items-center">
          {step !== 'SELECT' && uploadStatus === 'IDLE' && (
            <button 
              onClick={() => setStep('SELECT')}
              className="text-sm font-bold text-[#444746] hover:text-[#1F1F1F]"
            >
              Back
            </button>
          )}
          
          <div className="flex gap-3 ml-auto">
            {uploadStatus === 'IDLE' && (
              <button 
                onClick={handleClose}
                className="px-5 py-2.5 rounded-full font-bold text-sm text-[#444746] hover:bg-[#E3E3E3] transition-colors"
              >
                Cancel
              </button>
            )}
            
            {/* Upload Button */}
            {step === 'UPLOAD' && uploadStatus === 'IDLE' && (
              <button 
                onClick={handleUploadFile}
                disabled={!pendingFile}
                className="px-6 py-2.5 rounded-full bg-[#1F1F1F] text-white font-bold text-sm hover:bg-[#444746] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                Upload File
              </button>
            )}

            {/* Link Button */}
            {step === 'LINK' && (
              <button 
                onClick={handleParseLink}
                disabled={uploadStatus !== 'IDLE' || !linkUrl}
                className="px-6 py-2.5 rounded-full bg-[#1F1F1F] text-white font-bold text-sm hover:bg-[#444746] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {uploadStatus !== 'IDLE' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Preview & Parse'}
              </button>
            )}

            {/* Preview Confirm Button */}
            {step === 'PREVIEW' && (
              <button 
                onClick={handleConfirmLink}
                className="px-6 py-2.5 rounded-full bg-[#1F1F1F] text-white font-bold text-sm hover:bg-[#444746] transition-colors flex items-center gap-2"
              >
                Confirm & Add <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSourceModal;
