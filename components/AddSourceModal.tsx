import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Globe, 
  Check,
  AlertCircle
} from 'lucide-react';
import { UploadedFile, RoleSource, UserProfile } from '../types';
import { uploadAndParseDocument, uploadDocument, uploadRoleSource, addLinkSource } from '../api';

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

const SOURCE_TYPES = ['Resume', 'Portfolio', 'Work Sample', 'Notes', 'Job Description', 'Other'];

const AddSourceModal: React.FC<AddSourceModalProps> = ({ isOpen, onClose, onAddSource, onProfileExtracted, roleId, isGuest }) => {
  const [step, setStep] = useState<'SELECT' | 'UPLOAD' | 'LINK' | 'PREVIEW'>('SELECT');
  const [selectedFileType, setSelectedFileType] = useState<string>('Resume');
  const [pendingFile, setPendingFile] = useState<{ name: string; size: string } | null>(null);
  const [pendingFileObj, setPendingFileObj] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');

  // Parsing/Upload State
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'PARSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [parsedContent, setParsedContent] = useState('');

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
      let detectedType = 'Notes';
      if (lowerName.includes('resume') || lowerName.includes('cv') || lowerName.includes('简历')) detectedType = 'Resume';
      else if (lowerName.includes('portfolio')) detectedType = 'Portfolio';
      else if (lowerName.includes('sample')) detectedType = 'Work Sample';
      else if (lowerName.includes('jd') || lowerName.includes('job')) detectedType = 'Job Description';
      setSelectedFileType(detectedType);

      // Start uploading immediately in the background (non-guest, non-role)
      if (!isGuest && !roleId) {
        preUploadTypeRef.current = detectedType;
        setUploadStatus('UPLOADING');
        if (detectedType === 'Resume') {
          setUploadStatus('PARSING');
          preUploadPromiseRef.current = uploadAndParseDocument(file);
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
        // Await the pre-started upload
        if (uploadStatus !== 'PARSING') setUploadStatus('PARSING');
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
          const result = await uploadAndParseDocument(pendingFileObj);
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
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                   {uploadStatus === 'SUCCESS' ? (
                     <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center text-[#137333] mb-2 animate-in zoom-in duration-300">
                       <Check className="w-8 h-8" />
                     </div>
                   ) : (
                     <div className="relative">
                       <Loader2 className="w-12 h-12 text-[#0B57D0] animate-spin" />
                     </div>
                   )}
                   
                   <div className="text-center">
                     <h4 className="text-lg font-bold text-[#1F1F1F] mb-1">
                       {uploadStatus === 'UPLOADING' && 'Uploading...'}
                       {uploadStatus === 'PARSING' && 'Parsing file...'}
                       {uploadStatus === 'SUCCESS' && 'Done!'}
                     </h4>
                     <p className="text-sm text-[#444746]">
                       {uploadStatus === 'UPLOADING' && 'Please wait while we upload your document.'}
                       {uploadStatus === 'PARSING' && 'Extracting text and insights...'}
                       {uploadStatus === 'SUCCESS' && 'File uploaded and added to your profile.'}
                     </p>
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
