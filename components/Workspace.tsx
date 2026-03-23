
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Mail, 
  Lightbulb, 
  HelpCircle, 
  Video, 
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Edit2,
  Save,
  Info,
  Upload,
  Check,
  Sparkles,
  ArrowRight,
  Download,
  Target,
  Send,
  Bot,
  User,
  RefreshCw,
  MoreVertical,
  Paperclip,
  Loader2,
  Briefcase,
  Link as LinkIcon,
  Plus,
  Copy,
  Trash2,
  ExternalLink,
  Edit3,
  BookOpen,
  ClipboardList,
  PanelLeft,
  Settings,
  List,
  FileQuestion,
  X,
  Bookmark,
  Mic,
  Quote,
  Undo
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { TargetRole, WorkspaceTab, UploadedFile, RoleSource, AppView, SavedQuestion } from '../types';
import { deleteRoleSource, getGapMatrix, getWeaknessVector } from '../api';

const gemini = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || "" });
const GEMINI_MODEL = "gemini-2.0-flash";
import MockInterview from './MockInterview';
import AddSourceModal from './AddSourceModal';
import RichTextEditor, { RichTextEditorHandle } from './RichTextEditor';
import SelectionTooltip from './SelectionTooltip';

interface WorkspaceProps {
  workspace: TargetRole;
}


// --- Shared Types ---
type EditorState = 'EMPTY' | 'PICKER' | 'SETTINGS' | 'GENERATING' | 'EDITING';


// --- Role Context Builder Sub-Component (New Split Layout) ---
export const RoleContextBuilder: React.FC<{
  role: TargetRole;
  onUpdate: (role: TargetRole) => void
}> = ({ role, onUpdate }) => {
  const [localRole, setLocalRole] = useState<TargetRole>(role);
  const [sources, setSources] = useState<RoleSource[]>(role.sources || []);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  
  // --- Card Height Logic (Reused from Profile/Dashboard) ---
  // Using h-full to fill the parent container which is already constrained by App.tsx padding
  const cardHeightClass = "h-full min-h-[360px] mb-6";

  // Sync state if prop changes
  useEffect(() => {
    setLocalRole(role);
    setSources(role.sources || []);
  }, [role]);

  const handleChange = (field: keyof TargetRole, value: any) => {
    setLocalRole(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSource = (newFile: UploadedFile | RoleSource) => {
    const source: RoleSource = {
      id: newFile.id,
      name: newFile.name,
      type: newFile.type,
      date: newFile.date,
    };
    setSources(prev => [...prev, source]);
    setShowAddSourceModal(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      
      if (e.key === 'Escape') {
        setLocalRole(role);
        setIsEditing(false);
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        onUpdate(localRole);
        setIsEditing(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, localRole, role, onUpdate]);

  const handleDeleteSource = async (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
    try {
      await deleteRoleSource(role.id, id);
    } catch (err) {
      console.error('Failed to delete source:', err);
      // Re-add on failure
      setSources(prev => {
        const removed = (role.sources || []).find(s => s.id === id);
        return removed ? [...prev, removed] : prev;
      });
    }
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  // Helper for Missing Indicator
  const isMissing = (val: string | undefined) => !val || val.trim() === '';
  const MissingIndicator = ({ text = "Missing" }: { text?: string }) => (
    <span className="inline-flex items-center gap-1 text-[10px] text-[#B3261E] font-bold uppercase tracking-wider bg-[#FFDAD6] px-2 py-0.5 rounded ml-2">
      {text}
    </span>
  );

  const getFieldStyles = (val: string | undefined) => {
    if (isEditing) {
      return isMissing(val) 
        ? "border-red-300 bg-red-50 focus:ring-red-200 placeholder-red-300" 
        : "border-[#E3E3E3] focus:ring-[#0B57D0] bg-[#F0F4F9]";
    }
    return "";
  };

  const getFileTypeStyles = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('resume')) return 'bg-amber-50 text-amber-700 border border-amber-100';
    if (t.includes('job description') || t.includes('jd')) return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
    if (t.includes('link')) return 'bg-blue-50 text-blue-700 border border-blue-100';
    return 'bg-gray-50 text-gray-600 border border-gray-200';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full animate-in fade-in duration-500 pb-6">
      
      {/* LEFT: Source Inputs */}
      <div className="lg:col-span-4 flex flex-col min-h-0">
        <div 
          className={`bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)] flex flex-col overflow-hidden p-5 flex-1 min-h-[360px]`}
        >
          {/* Header */}
          <div className="mb-6 flex-shrink-0">
             <h3 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Source Inputs</h3>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            
            {/* Input: Add Source Button */}
            <div className="flex-shrink-0 mb-6">
              <button 
                onClick={() => setShowAddSourceModal(true)}
                className="flex flex-col items-center justify-center w-full p-6 border border-dashed border-[#C4C7C5] rounded-[14px] cursor-pointer hover:bg-[#F0F4F9] hover:border-[#0B57D0] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-[#0B57D0] p-2 rounded-full text-white shadow-sm group-hover:scale-110 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="block text-sm font-bold text-[#1F1F1F] text-center">Add Source</span>
                </div>
                <span className="text-xs text-[#444746] mt-2 text-center">Upload job descriptions, internal notes, or other relevant documents.</span>
              </button>
            </div>

            {/* Sources List */}
            <div>
               <div className="space-y-3">
                 {sources.map(src => (
                   <div key={src.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#E3E3E3] hover:bg-[#F0F4F9] hover:border-[#C4C7C5] group transition-all bg-white relative">
                      <div className="bg-[#F0F4F9] p-2.5 rounded-lg text-[#0B57D0] mt-0.5 flex-shrink-0">
                        {src.type === 'Link' ? <LinkIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1 pr-6">
                        <p className="text-sm font-semibold text-[#1F1F1F] truncate leading-tight mb-1.5">{src.name}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getFileTypeStyles(src.type)}`}>
                           {src.type}
                        </span>
                      </div>
                      
                      {/* Hover Actions */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#F0F4F9] rounded-lg shadow-sm border border-[#E3E3E3]">
                        {src.type === 'Link' ? (
                           <button 
                             onClick={() => handleCopyLink(src.name)}
                             className="p-1.5 hover:bg-[#E3E3E3] rounded-md text-[#444746] transition-colors"
                             title="Copy Link"
                           >
                             <Copy className="w-3.5 h-3.5" />
                           </button>
                        ) : (
                           <button 
                             className="p-1.5 hover:bg-[#E3E3E3] rounded-md text-[#444746] transition-colors"
                             title="Download"
                           >
                             <Download className="w-3.5 h-3.5" />
                           </button>
                        )}
                        <div className="w-px bg-[#C4C7C5] my-1"></div>
                        <button 
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-1.5 hover:bg-[#FFDAD6] hover:text-[#B3261E] rounded-md text-[#444746] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Role Context Workspace */}
      <div className="lg:col-span-8 flex flex-col min-h-0">
        <div 
          className={`bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)] flex flex-col overflow-hidden flex-1 min-h-[360px]`}
        >
          
          {/* Header */}
          <div className={`px-8 py-6 border-b border-[#E3E3E3] flex items-center justify-between bg-white flex-shrink-0 transition-all duration-300 ${isEditing ? 'min-h-[88px]' : 'min-h-[88px]'}`}>
            {isEditing ? (
              <div className="w-full flex justify-end gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                  onClick={() => {
                    setLocalRole(role);
                    setIsEditing(false);
                  }}
                  className="w-32 py-2.5 rounded-full text-sm font-bold bg-[#F0F4F9] text-[#1F1F1F] hover:bg-[#E3E3E3] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onUpdate(localRole);
                    setIsEditing(false);
                  }}
                  className="w-32 py-2.5 rounded-full text-sm font-bold bg-[#1F1F1F] text-white hover:bg-[#444746] shadow-md transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Role Context</h3>
                  </div>
                  <p className="text-sm text-[#444746] mt-1">The more details you provide, the better AI can prepare you.</p>
                </div>
                
                <button
                  onClick={() => {
                    setLocalRole(role);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-[#F0F4F9] text-[#1F1F1F] hover:bg-[#E3E3E3] transition-all animate-in fade-in duration-300"
                >
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              </>
            )}
          </div>

          {/* Context Content */}
          <div className="flex-1 overflow-y-auto px-10 pt-10 pb-20">
             <div className="max-w-3xl mx-auto space-y-12">
                
                {/* 1. Core Header Info */}
                <section>
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-6 border-b border-[#F0F4F9] pb-2">Basic Info</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="md:col-span-2">
                         <label className="text-xs text-[#444746] font-semibold mb-1 block">Role Title</label>
                         {isEditing ? (
                           <input 
                               value={localRole.title}
                               onChange={(e) => handleChange('title', e.target.value)}
                               className={`w-full text-lg font-bold p-2 rounded-lg border-b border-dashed outline-none bg-transparent ${getFieldStyles(localRole.title)}`}
                               placeholder="e.g. Senior Product Manager"
                           />
                         ) : (
                           <div className="text-xl font-bold text-[#1F1F1F]">{localRole.title}</div>
                         )}
                      </div>
                      <div>
                         <label className="text-xs text-[#444746] font-semibold mb-1 block">Company</label>
                         {isEditing ? (
                            <input 
                              value={localRole.company}
                              onChange={(e) => handleChange('company', e.target.value)}
                              className={`w-full p-2 rounded-lg text-sm outline-none border-b border-dashed bg-transparent ${getFieldStyles(localRole.company)}`}
                            />
                         ) : (
                            <div className="text-sm font-medium text-[#1F1F1F] flex items-center gap-1.5">
                               <Briefcase className="w-3.5 h-3.5 text-[#444746]" />
                               {localRole.company}
                            </div>
                         )}
                      </div>
                      <div>
                         <label className="text-xs text-[#444746] font-semibold mb-1 block">Team</label>
                         {isEditing ? (
                            <input 
                              value={localRole.teamInfo}
                              onChange={(e) => handleChange('teamInfo', e.target.value)}
                              className={`w-full p-2 rounded-lg text-sm outline-none border-b border-dashed bg-transparent ${getFieldStyles(localRole.teamInfo)}`}
                              placeholder="e.g. Platform Team"
                            />
                         ) : (
                            <div className="text-sm font-medium text-[#1F1F1F]">
                               {isMissing(localRole.teamInfo) ? <MissingIndicator text="Missing Team"/> : localRole.teamInfo}
                            </div>
                         )}
                      </div>
                   </div>
                </section>

                {/* 2. Job Description */}
                <section>
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-4 border-b border-[#F0F4F9] pb-2">Job Description</h3>
                   {isEditing ? (
                     <textarea 
                       rows={12}
                       value={localRole.jd}
                       onChange={(e) => handleChange('jd', e.target.value)}
                       className={`w-full text-sm p-3 rounded-lg outline-none resize-none border leading-relaxed ${getFieldStyles(localRole.jd)}`}
                       placeholder="Paste the full job description here..."
                     />
                   ) : (
                     <div className="text-sm text-[#1F1F1F] leading-relaxed whitespace-pre-wrap bg-[#FAFAFA] p-6 rounded-xl border border-[#F0F4F9]">
                       {localRole.jd}
                     </div>
                   )}
                </section>

                {/* 3. Deep Context */}
                <section>
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-6 border-b border-[#F0F4F9] pb-2">Context & Research</h3>
                   <div className="grid grid-cols-1 gap-8">
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
                           <Briefcase className="w-4 h-4 text-[#0B57D0]" /> Company Background
                        </h4>
                        {isEditing ? (
                           <textarea 
                             rows={5}
                             value={localRole.companyBackground || ''}
                             onChange={(e) => handleChange('companyBackground', e.target.value)}
                             className={`w-full text-sm p-3 rounded-lg outline-none resize-none border leading-relaxed ${getFieldStyles(localRole.companyBackground)}`}
                             placeholder="Mission, culture, recent news..."
                           />
                        ) : (
                           <div className="text-sm text-[#444746] leading-relaxed whitespace-pre-wrap">
                              {isMissing(localRole.companyBackground) ? <MissingIndicator text="Missing Background"/> : localRole.companyBackground}
                           </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
                           <User className="w-4 h-4 text-[#0B57D0]" /> Team Context
                        </h4>
                        {isEditing ? (
                           <textarea 
                             rows={5}
                             value={localRole.teamBackground || ''}
                             onChange={(e) => handleChange('teamBackground', e.target.value)}
                             className={`w-full text-sm p-3 rounded-lg outline-none resize-none border leading-relaxed ${getFieldStyles(localRole.teamBackground)}`}
                             placeholder="Team size, tech stack, current challenges..."
                           />
                        ) : (
                           <div className="text-sm text-[#444746] leading-relaxed whitespace-pre-wrap">
                              {isMissing(localRole.teamBackground) ? <MissingIndicator text="Missing Context"/> : localRole.teamBackground}
                           </div>
                        )}
                      </div>
                   </div>
                </section>

                {/* 4. Interview Questions */}
                <section>
                    <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-4 border-b border-[#F0F4F9] pb-2">Interview Questions</h3>
                    {isEditing ? (
                    <textarea 
                        rows={6}
                        value={localRole.interviewQuestions?.join('\n') || ''}
                        onChange={(e) => {
                             const val = e.target.value;
                             const updated = { ...localRole, interviewQuestions: val.split('\n') };
                             setLocalRole(updated);
                        }}
                        className={`w-full text-sm p-3 rounded-lg outline-none resize-none border leading-relaxed ${getFieldStyles(localRole.interviewQuestions?.join('\n'))}`}
                        placeholder="Add questions you expect (one per line)..."
                    />
                    ) : (
                    <div className="space-y-2">
                        {(!localRole.interviewQuestions || localRole.interviewQuestions.length === 0) ? (
                             <p className="text-sm text-[#444746] italic bg-[#F0F4F9] inline-block px-3 py-1 rounded">No interview questions added yet.</p>
                        ) : (
                            <ul className="list-disc pl-5 space-y-2">
                                {localRole.interviewQuestions.map((q, i) => (
                                    <li key={i} className="text-sm text-[#1F1F1F] leading-relaxed">{q}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    )}
                </section>

                {/* 5. Additional Notes */}
                <section>
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-4 border-b border-[#F0F4F9] pb-2">Additional Notes</h3>
                   {isEditing ? (
                     <textarea 
                       rows={4}
                       value={localRole.additionalNotes || ''}
                       onChange={(e) => handleChange('additionalNotes', e.target.value)}
                       className={`w-full text-sm p-3 rounded-lg outline-none resize-none border leading-relaxed ${getFieldStyles(localRole.additionalNotes)}`}
                       placeholder="Any other details to guide the AI? (e.g. Interviewer preferences, referral notes)"
                     />
                   ) : (
                     <p className="text-sm text-[#444746] leading-relaxed italic">
                        {isMissing(localRole.additionalNotes) ? <MissingIndicator text="No notes added"/> : localRole.additionalNotes}
                     </p>
                   )}
                </section>

             </div>
          </div>
        </div>
      </div>

      <AddSourceModal
        isOpen={showAddSourceModal}
        onClose={() => setShowAddSourceModal(false)}
        onAddSource={handleAddSource}
        roleId={role.id}
      />

      {/* --- TOAST --- */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-[#1F1F1F] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <Check className="w-4 h-4 text-[#14AE5C]" />
          <span className="text-sm font-medium">Source added to context.</span>
        </div>
      )}

    </div>
  );
};

const sanitizeText = (text: string): string => {
  return text
    .replace(/^#+\s+/gm, '') // Remove H1-H6
    .replace(/\*\*/g, '')    // Remove bold
    .replace(/__/g, '')      // Remove bold
    .replace(/\*/g, '')      // Remove italics/bullets
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/>\s+/g, '')    // Remove blockquotes
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // Remove links
    .trim();
};

/** Convert plain text with newlines into HTML paragraphs for TipTap editor */
const textToHtml = (text: string): string => {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
};

/** Parse backend Markdown prep document (### Q: / **Answer Framework:**) into Q&A pairs */
const parsePrepContent = (content: string, limit: number): { q: string; a?: string }[] => {
  const results: { q: string; a?: string }[] = [];
  const blocks = content.split(/(?=###\s*Q:)/i);
  for (const block of blocks) {
    const lines = block.split('\n');
    const qMatch = lines[0]?.match(/###\s*Q:\s*(.+)/i);
    if (!qMatch) continue;
    const q = qMatch[1].trim();
    const answerLines = lines.slice(1)
      .filter(l => !l.startsWith('#') && l.trim())
      .map(l => l.replace(/^\*\*(?:Answer Framework|Key Points|Sample Answer|Guidance):\*\*\s*/i, '').trim())
      .filter(l => l.length > 0);
    const a = answerLines.length > 0 ? sanitizeText(answerLines.join('\n')) : undefined;
    results.push({ q, a });
    if (results.length >= limit) break;
  }
  return results;
};

// --- Interview Prep Builder Sub-Component (NEW) ---
export const InterviewPrepBuilder: React.FC<{ 
  role: TargetRole | null;
  roles: TargetRole[];
  onSelectRole: (role: TargetRole | null) => void;
  onNavigate: (view: AppView) => void;
  settings: {
    types: string[];
    qty: number;
  };
  onUpdateSettings: (settings: any) => void;
  savedQuestions?: SavedQuestion[];
  onSaveQuestion?: (question: SavedQuestion) => void;
  initialQuestionId?: string | null;
}> = ({ role, roles, onSelectRole, onNavigate, settings, onUpdateSettings, savedQuestions = [], onSaveQuestion, initialQuestionId }) => {
  const [editorState, setEditorState] = useState<EditorState>('EMPTY');
  const [generatedQuestions, setGeneratedQuestions] = useState<{q: string, a?: string}[]>([]);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showInfo, setShowInfo] = useState<string | null>(null);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  
  // Load initial question if provided
  useEffect(() => {
    if (initialQuestionId && savedQuestions.length > 0) {
      const question = savedQuestions.find(q => q.id === initialQuestionId);
      if (question) {
        setGeneratedQuestions([{ q: question.question, a: question.answer || '' }]);
        setSelectedQuestionIndex(0);
        setEditorState('EDITING');
        
        // Restore State
        if (question.chatHistory) {
          setChatHistory(question.chatHistory);
        }
        if (question.transcription) {
          setTranscription(question.transcription);
        }
      }
    }
  }, [initialQuestionId, savedQuestions]);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'IDLE' | 'RECORDING' | 'PAUSED' | 'STOPPED'>('IDLE');
  const recordingStatusRef = useRef<string>('IDLE');
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [transcription, setTranscription] = useState('');
  const recognitionRef = useRef<any>(null);
  const [isRecordingInterface, setIsRecordingInterface] = useState(false);
  const [savedToWorkspace, setSavedToWorkspace] = useState<boolean>(false);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [tempQuestionText, setTempQuestionText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isCoPilotAvailable, setIsCoPilotAvailable] = useState(true);
  const [quotedText, setQuotedText] = useState<string | null>(null);
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);
  const [isAIEditMode, setIsAIEditMode] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const editorRef = React.useRef<RichTextEditorHandle>(null);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showMergePrompt, setShowMergePrompt] = useState(false);
  const [pendingTranscription, setPendingTranscription] = useState('');
  
  // State: Chat (Moved up)
  const [chatHistory, setChatHistory] = useState<{sender: 'AI'|'USER', text: string, quote?: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ... (rest of the component)

  const handleQuote = (text: string) => {
    if (!isCoPilotAvailable) {
      alert("Copilot is currently unavailable. The selected text has been copied to your clipboard.");
      navigator.clipboard.writeText(text);
      return;
    }
    setQuotedText(text);
    setIsQuoteExpanded(false);
    setIsAIEditMode(false);
    // Focus chat input
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  };

  const handleAIEdit = (text: string) => {
    if (!isCoPilotAvailable) {
      alert("Copilot is currently unavailable.");
      return;
    }
    setQuotedText(text);
    setIsQuoteExpanded(false);
    setIsAIEditMode(true);
    setChatInput(""); // Input box remains empty as requested
    // Focus chat input
    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
      }
    }, 100);
  };

  // Voice recording logic
  const startAudioAnalysis = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 512;
    const dataArray = new Float32Array(analyser.fftSize);

    let smoothedLevel = 0;
    let silenceDuration = 0;
    let lastTime = performance.now();

    const updateLevel = () => {
      if (!stream.active) return;
      analyser.getFloatTimeDomainData(dataArray);
      
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      
      const db = 20 * Math.log10(rms || 1e-8);
      const threshold = -45;
      let targetLevel = 0;
      
      if (db > threshold) {
        targetLevel = Math.min(100, Math.max(0, ((db - threshold) / Math.abs(threshold)) * 100));
        silenceDuration = 0;
      } else {
        const now = performance.now();
        silenceDuration += (now - lastTime);
        if (silenceDuration > 80) {
          targetLevel = 0;
        } else {
          targetLevel = smoothedLevel;
        }
      }
      
      lastTime = performance.now();

      const alpha = targetLevel > smoothedLevel ? 0.4 : 0.15;
      smoothedLevel = alpha * targetLevel + (1 - alpha) * smoothedLevel;

      setAudioLevel(smoothedLevel);
      requestAnimationFrame(updateLevel);
    };
    updateLevel();
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support real-time transcription.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setTranscription(prev => prev + event.results[i][0].transcript + ' ');
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (editorRef.current) {
        editorRef.current.setContent(transcription + interimTranscript);
      }
    };

    recognition.onend = () => {
      if (recordingStatusRef.current === 'RECORDING') {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    
    // Start timer
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    recordingStatusRef.current = 'STOPPED';
    setRecordingStatus('STOPPED');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const handleTryAnswer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startAudioAnalysis(stream);
      setIsRecordingInterface(true);
      setRecordingStatus('RECORDING');
      recordingStatusRef.current = 'RECORDING';
      setRecordingTime(0);
      setTranscription('');
      startRecording();
    } catch (error) {
      console.error("Microphone access denied", error);
      alert("Microphone access denied — enable in browser settings to use Try Answer.");
    }
  };

  const applyTranscription = (text: string, mode: 'overwrite' | 'append') => {
    setSaveStatus('saving');
    
    if (selectedQuestionIndex === null) return;
    
    const currentQ = generatedQuestions[selectedQuestionIndex];
    const existingNotes = currentQ?.a || '';
    
    // Basic formatting: split by sentences and wrap in <p>
    const formattedText = text.split('. ').filter(s => s.trim()).map(s => `<p>${s.trim()}${s.trim().endsWith('.') ? '' : '.'}</p>`).join('');
    
    let newNotes = formattedText;
    if (mode === 'append' && existingNotes.trim()) {
      newNotes = `${existingNotes}<br/><p><strong>[Transcribed Audio]</strong></p>${formattedText}`;
    }

    const updated = [...generatedQuestions];
    updated[selectedQuestionIndex] = { ...updated[selectedQuestionIndex], a: newNotes };
    setGeneratedQuestions(updated);

    if (editorRef.current) {
      editorRef.current.setContent(newNotes);
    }

    setIsRecordingInterface(false);
    setShowMergePrompt(false);
    setPendingTranscription('');
    
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
    
    setChatHistory(prev => [...prev, { 
      sender: 'AI', 
      text: "I've transcribed your recording and added it to your notes. Would you like me to refine this answer or format it into a STAR structure?" 
    }]);
  };

  const handleStopRecording = () => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
    
    if (selectedQuestionIndex === null) return;
    const currentQ = generatedQuestions[selectedQuestionIndex];
    const existingNotes = currentQ?.a || '';
    
    if (existingNotes.trim() && transcription.trim()) {
      setPendingTranscription(transcription);
      setShowMergePrompt(true);
    } else if (transcription.trim()) {
      applyTranscription(transcription, 'overwrite');
    } else {
      setIsRecordingInterface(false);
    }
  };

  const handleCancelMerge = () => {
    setShowMergePrompt(false);
    setPendingTranscription('');
    setIsRecordingInterface(false);
  };

  const handleCancelRecording = () => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
    setIsRecordingInterface(false);
    setTranscription('');
    setRecordingTime(0);
    // Show toast
    alert("Recording canceled. No text saved.");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const RecordingWorkspace = () => (
    <div className="flex-1 flex flex-col bg-[#F8F9FA] rounded-xl border border-[#E3E3E3] p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" aria-label="Recording status: active" />
          <span className="text-sm font-bold text-red-600">Recording</span>
          <span className="text-sm font-mono text-[#444746]">{formatTime(recordingTime)}</span>
        </div>
        <div className="flex gap-2">
          {recordingStatus === 'RECORDING' ? (
            <button aria-label="Pause recording" onClick={() => { setRecordingStatus('PAUSED'); recordingStatusRef.current = 'PAUSED'; if(recognitionRef.current) recognitionRef.current.stop(); }} className="px-3 py-1.5 bg-[#F0F4F9] text-[#1F1F1F] rounded-lg text-sm font-bold hover:bg-[#E3E3E3]">Pause</button>
          ) : (
            <button aria-label="Resume recording" onClick={() => { setRecordingStatus('RECORDING'); recordingStatusRef.current = 'RECORDING'; startRecording(); }} className="px-3 py-1.5 bg-[#0B57D0] text-white rounded-lg text-sm font-bold hover:bg-[#0B67EF]">Resume</button>
          )}
          <button aria-label="Finish recording" onClick={handleStopRecording} className="px-3 py-1.5 bg-[#1F1F1F] text-white rounded-lg text-sm font-bold hover:bg-[#444746]">Finish</button>
          <button aria-label="Cancel recording" onClick={handleCancelRecording} className="px-3 py-1.5 bg-white border border-[#E3E3E3] text-[#444746] rounded-lg text-sm font-bold hover:bg-[#F0F4F9]">Cancel</button>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-lg border border-[#E3E3E3] p-4 overflow-y-auto">
        <p className="text-sm text-[#1F1F1F] leading-relaxed">{transcription || "Listening..."}</p>
      </div>
      <div className="mt-4 h-12 bg-[#F0F4F9] rounded-lg flex items-center justify-center border border-[#E3E3E3]">
        {/* Simple waveform visualization matching Live Interview */}
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-[2px] h-5">
            {[...Array(24)].map((_, i) => (
              <div 
                key={i} 
                className="w-[2.5px] bg-[#2EBB63] rounded-full transition-all duration-75"
                style={{ 
                  height: `${Math.max(15, Math.min(100, audioLevel * (0.5 + Math.random() * 0.5)))}%`,
                  opacity: recordingStatus === 'RECORDING' ? 1 : 0.3
                }} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Autosave logic
  useEffect(() => {
    if (selectedQuestionIndex === null || selectedQuestionIndex === -1) return;
    
    const handler = setTimeout(() => {
      const currentQ = generatedQuestions[selectedQuestionIndex];
      if (currentQ?.a || transcription || chatHistory.length > 1) {
        setSaveStatus('saving');
        
        // Actual Save Call
        if (onSaveQuestion && role && (initialQuestionId || currentQ.q)) {
           onSaveQuestion({
             id: initialQuestionId || `saved-${Date.now()}-${selectedQuestionIndex}`,
             roleId: role.id,
             type: settings.types[0] || 'General',
             question: currentQ.q,
             answer: currentQ.a,
             lastModified: new Date().toISOString(),
             savedAt: new Date().toISOString(), // Should ideally keep original savedAt if editing
             source: 'MOCK_PREP',
             chatHistory: chatHistory,
             transcription: transcription
           });
        }

        setTimeout(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }, 1000);
      }
    }, 2000);

    return () => clearTimeout(handler);
  }, [generatedQuestions, selectedQuestionIndex, transcription, chatHistory, onSaveQuestion, role, initialQuestionId, settings.types]);
  
  // --- Card Height Logic ---
  const cardHeightClass = "h-full min-h-[360px]";

  // Constants
  interface QuestionType {
    id: string;
    label: string;
    description: string;
    explanation: string;
    example: string;
  }

  const QUESTION_TYPES: QuestionType[] = [
    { 
      id: 'behavioral', 
      label: 'Behavioral & Experience', 
      description: 'Past experiences, soft skills, and behavioral scenarios.',
      explanation: 'Focuses on your past experiences, leadership style, and how you collaborate, make decisions, and handle challenges in real-world situations.',
      example: '"Tell me about a time you had to align multiple stakeholders with conflicting priorities. How did you handle it?"'
    },
    { 
      id: 'product', 
      label: 'Product Design & Sense', 
      description: 'Designing products, user empathy, and product improvement.',
      explanation: 'Evaluates your ability to identify user problems, design intuitive solutions, and prioritize features with clear product reasoning.',
      example: '"How would you design a new feature to improve user retention for TikTok?"'
    },
    { 
      id: 'analytical', 
      label: 'Analytical & Execution', 
      description: 'Metrics, data analysis, problem solving, and execution.',
      explanation: 'Tests your ability to diagnose metric changes, structure ambiguous problems, and drive data-informed execution.',
      example: '"Daily active users dropped by 15% last month. How would you investigate and address this issue?"'
    },
    { 
      id: 'strategy', 
      label: 'Strategy & Vision', 
      description: 'Long-term thinking, market sense, and business strategy.',
      explanation: 'Assesses your long-term thinking, market judgment, and ability to evaluate strategic opportunities and trade-offs.',
      example: '"Should OpenAI expand into enterprise collaboration tools? How would you evaluate this opportunity?"'
    }
  ];

  const generateQuestions = async () => {
    setEditorState('GENERATING');

    try {
      // Step 1: Fetch gap data from backend (fast, just DB read)
      let gapContext = "";
      if (role?.id) {
        try {
          const [gapData, weaknessData] = await Promise.all([
            getGapMatrix(role.id).catch(() => null),
            getWeaknessVector().catch(() => null),
          ]);
          if (gapData?.gaps) {
            const topGaps = gapData.gaps.filter((g: any) => g.gap > 0.5).slice(0, 5);
            gapContext = "Candidate weaknesses (focus questions here):\n" +
              topGaps.map((g: any) => "- " + g.label + ": score " + g.user_score + " vs required " + g.required_score).join("\n");
          }
          if (weaknessData?.vector) {
            const topWeak = Object.entries(weaknessData.vector)
              .sort((a: any, b: any) => b[1] - a[1])
              .slice(0, 3);
            if (topWeak.length > 0 && !gapContext) {
              gapContext = "Historical weak areas: " + topWeak.map(([k]) => k.replace(/_/g, " ")).join(", ");
            }
          }
        } catch {
          // No gap data available, that's fine
        }
      }

      // Step 2: Call Gemini directly from frontend (fast, direct connection)
      const prompt = "You are an expert interview coach. Generate " + settings.qty + " high-quality interview questions for a " + (role?.title || "Product Manager") + " role at " + (role?.company || "a tech company") + ".\n\nFocus on these question types: " + settings.types.join(", ") + ".\n\n" + (gapContext ? gapContext + "\n\n" : "") + "Role Context:\n" + (role?.jd || "") + "\n\nRequirements:\n1. Return ONLY the questions, one per line.\n2. Do NOT include numbering, category labels, or prefixes.\n3. Each question should be a single, complete sentence.\n4. Focus on the candidate's weak areas if provided.";

      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
      });

      const text = response.text || "";
      const questions = text.split("\n")
        .map((q: string) => q.trim())
        .filter((q: string) => q.length > 10)
        .slice(0, settings.qty)
        .map((q: string) => ({ q, a: undefined }));

      if (questions.length === 0) throw new Error("No questions generated");

      setGeneratedQuestions(questions);
      setEditorState('EDITING');
      setChatHistory(prev => [...prev, {
        sender: 'AI',
        text: "I've generated " + questions.length + " targeted questions" + (gapContext ? " based on your gap analysis" : "") + ". Select a question to generate a sample answer."
      }]);
    } catch (error) {
      console.error("Error generating questions:", error);
      const mockQuestions = Array.from({ length: settings.qty }).map(() => ({
        q: "How would you handle a situation where you need to prioritize multiple conflicting tasks for a " + (role?.title || "product") + " role?",
        a: undefined
      }));
      setGeneratedQuestions(mockQuestions);
      setEditorState('EDITING');
      setChatHistory(prev => [...prev, {
        sender: 'AI',
        text: "I've generated practice questions for you. Select a question to generate a sample answer."
      }]);
    }
  };

  const handleGenerateAnswer = async (index: number) => {
    if (isGeneratingAnswer) return;
    setIsGeneratingAnswer(true);

    try {
      const question = generatedQuestions[index].q;
      const prompt = "You are an expert interview coach. Provide a sample answer for this interview question for a " + (role?.title || "Product Manager") + " role at " + (role?.company || "a tech company") + ".\n\nQuestion: " + question + "\n\nRole Context:\n" + (role?.jd || "").slice(0, 1000) + "\n\nRequirements:\n1. Write as if you are the candidate speaking.\n2. Use STAR framework where applicable.\n3. Be concise but impactful.\n4. Do NOT use Markdown symbols. Use plain text with paragraphs.";

      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
      });

      const answer = sanitizeText(response.text || "");
      const answerHtml = textToHtml(answer);
      const updatedQuestions = [...generatedQuestions];
      updatedQuestions[index] = { ...updatedQuestions[index], a: answerHtml };
      setGeneratedQuestions(updatedQuestions);

      if (editorRef.current) {
        editorRef.current.setContent(answerHtml);
      }

      setChatHistory(prev => [...prev, {
        sender: 'AI',
        text: "I've generated a suggested answer. Would you like me to refine or improve it?"
      }]);
    } catch (error) {
      console.error("Error generating answer:", error);
      const updatedQuestions = [...generatedQuestions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        a: "This is a sample answer generated based on the STAR framework. Situation: Describe the context. Task: Explain your responsibility. Action: Detail the steps you took. Result: Share the positive outcome."
      };
      setGeneratedQuestions(updatedQuestions);
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  // Initialize Chat
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([{
        sender: 'AI',
        text: "AI is ready to help... (select options and generate first)"
      }]);
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || generatedQuestions.length === 0) return;
    const userMsg = chatInput;
    
    // Include quoted text in history if present
    const historyEntry = quotedText 
      ? { sender: 'USER' as const, text: userMsg, quote: quotedText }
      : { sender: 'USER' as const, text: userMsg };

    setChatHistory(prev => [...prev, historyEntry]);
    setChatInput('');
    
    if (isAIEditMode && quotedText) {
      setIsGeneratingAI(true);
      
      // Visual feedback: Highlight selection to indicate processing
      if (editorRef.current) {
        editorRef.current.setHighlight('#e0e0e0');
      }

      try {
        const editPrompt = "You are an expert editor. Revise the following text based on the user's instruction.\n\nOriginal Text:\n" + quotedText + "\n\nUser Instruction: " + userMsg + "\n\nRequirements:\n1. Return ONLY the revised text.\n2. Maintain the original tone unless instructed otherwise.\n3. Do not include any explanations.\n4. Preserve the original formatting structure.";

        const editResponse = await gemini.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ parts: [{ text: editPrompt }] }],
        });

        const revisedText = editResponse.text || "";
        
        // Directly replace selection in the editor
        if (editorRef.current) {
          // Unset highlight first to ensure new text isn't highlighted
          editorRef.current.setHighlight();
          editorRef.current.replaceSelection(revisedText);
          
          // Trigger auto-save indicator
          setSaveStatus('saving');
          setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
          }, 1000);
        }

        setChatHistory(prev => [...prev, { 
          sender: 'AI', 
          text: "I've updated the text based on your request." 
        }]);
      } catch (error) {
        console.error("AI Revision failed:", error);
        // Remove highlight if error
        if (editorRef.current) {
          editorRef.current.setHighlight();
        }
        setChatHistory(prev => [...prev, { 
          sender: 'AI', 
          text: "I'm sorry, I encountered an error while trying to revise the text. Please try again." 
        }]);
      } finally {
        setIsGeneratingAI(false);
        setQuotedText(null);
        setIsAIEditMode(false);
      }
    } else {
      setQuotedText(null);
      // Real Gemini call for chat refinement
      const currentQ = selectedQuestionIndex !== null ? generatedQuestions[selectedQuestionIndex] : null;
      const chatContext = currentQ ? "Current question: " + currentQ.q + "\nCurrent answer: " + (currentQ.a || "(no answer yet)") : "";

      try {
        const chatPrompt = "You are an interview prep AI assistant. The user is working on interview preparation for a " + (role?.title || "Product Manager") + " role at " + (role?.company || "a company") + ".\n\n" + chatContext + "\n\nUser message: " + userMsg + "\n\nRespond helpfully. If they ask to modify the answer, return the improved answer text directly. If they ask a question, answer it concisely. Keep responses under 200 words.";

        const chatResponse = await gemini.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ parts: [{ text: chatPrompt }] }],
        });

        const aiReply = chatResponse.text || "I can help you refine your answer. Could you be more specific?";

        // If the user asked to modify the answer and we have a selected question, update it
        const modifyKeywords = ["shorter", "concise", "STAR", "format", "rewrite", "improve", "段", "简短", "修改", "分段"];
        if (currentQ && selectedQuestionIndex !== null && modifyKeywords.some(k => userMsg.toLowerCase().includes(k))) {
          const improvedHtml = textToHtml(sanitizeText(aiReply));
          const updatedQuestions = [...generatedQuestions];
          updatedQuestions[selectedQuestionIndex] = { ...updatedQuestions[selectedQuestionIndex], a: improvedHtml };
          setGeneratedQuestions(updatedQuestions);
          if (editorRef.current) {
            editorRef.current.setContent(improvedHtml);
          }
          setChatHistory(prev => [...prev, { sender: 'AI', text: "I've updated the answer based on your request." }]);
        } else {
          setChatHistory(prev => [...prev, { sender: 'AI', text: aiReply }]);
        }
      } catch (error) {
        console.error("Chat error:", error);
        setChatHistory(prev => [...prev, { sender: 'AI', text: "Sorry, I encountered an error. Please try again." }]);
      }
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (generatedQuestions.length === 0) return;
    setChatHistory(prev => [...prev, { sender: 'USER', text: prompt }]);
    setChatInput('');

    const currentQ = selectedQuestionIndex !== null ? generatedQuestions[selectedQuestionIndex] : null;

    try {
      const qPrompt = "You are an interview prep AI. The user clicked a quick action: \"" + prompt + "\".\n\nCurrent question: " + (currentQ?.q || "") + "\nCurrent answer: " + (currentQ?.a || "(none)") + "\n\nRole: " + (role?.title || "") + " at " + (role?.company || "") + "\n\nApply the requested change to the answer and return the improved answer directly. No explanations, just the improved answer text.";

      const qResponse = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ parts: [{ text: qPrompt }] }],
      });

      const improved = sanitizeText(qResponse.text || "");
      const improvedHtml = textToHtml(improved);

      if (currentQ && selectedQuestionIndex !== null && improved) {
        const updatedQuestions = [...generatedQuestions];
        updatedQuestions[selectedQuestionIndex] = { ...updatedQuestions[selectedQuestionIndex], a: improvedHtml };
        setGeneratedQuestions(updatedQuestions);
        if (editorRef.current) {
          editorRef.current.setContent(improvedHtml);
        }
        setChatHistory(prev => [...prev, { sender: 'AI', text: "Done! I've updated the answer." }]);
      } else {
        setChatHistory(prev => [...prev, { sender: 'AI', text: improved || "I couldn't process that request." }]);
      }
    } catch (error) {
      console.error("Quick prompt error:", error);
      setChatHistory(prev => [...prev, { sender: 'AI', text: "Sorry, something went wrong. Please try again." }]);
    }
  };

  const renderToolbar = () => {
    if (editorState !== 'EDITING' || selectedQuestionIndex !== null) return null;
    
    return (
      <div className="px-6 py-4 border-b border-[#E3E3E3] flex items-center justify-between bg-white flex-shrink-0">
         <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F0F4F9] rounded-lg text-sm font-bold text-[#1F1F1F]">
             <Briefcase className="w-4 h-4 text-[#0B57D0]" />
             {role?.title} @ {role?.company}
           </div>
           {savedToWorkspace && (
             <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-in fade-in duration-300">
               <Check className="w-3.5 h-3.5" /> Saved to Workspace
             </div>
           )}
         </div>
         
         <div className="flex items-center gap-2">
           <button 
             onClick={generateQuestions}
             className="p-2 text-[#444746] hover:bg-[#F0F4F9] rounded-lg transition-colors flex items-center gap-1.5 text-sm font-bold"
           >
             <RefreshCw className="w-4 h-4" /> Regenerate
           </button>
           <button 
             onClick={() => {
               if (onSaveQuestion && role) {
                 generatedQuestions.forEach((q, idx) => {
                   onSaveQuestion({
                     id: `saved-${Date.now()}-${idx}`,
                     roleId: role.id,
                     type: settings.types[0] || 'General',
                     question: q.q,
                     answer: q.a,
                     lastModified: new Date().toISOString(),
                     savedAt: new Date().toISOString(),
                     source: 'MOCK_PREP'
                   });
                 });
               }
               setSavedToWorkspace(true);
               setTimeout(() => setSavedToWorkspace(false), 3000);
             }}
             className="p-2 text-[#444746] hover:bg-[#F0F4F9] rounded-lg transition-colors flex items-center gap-1.5 text-sm font-bold"
           >
             <Save className="w-4 h-4" /> Save All
           </button>
           <div className="flex items-center gap-2 text-xs font-bold text-[#444746] px-2 min-w-[80px] justify-end">
             {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>}
             {saveStatus === 'saved' && <><Check className="w-3 h-3" /> Saved</>}
             {saveStatus === 'error' && <><X className="w-3 h-3 text-red-500" /> Offline — changes will sync when online</>}
           </div>
         </div>
      </div>
    );
  };

  const renderEditorContent = () => {
    switch (editorState) {
      case 'EMPTY':
        const isValid = role && settings.types.length > 0;
        
        return (
          <div className="h-full flex flex-col animate-in fade-in duration-500">
            <div className="max-w-5xl mx-auto w-full p-6">
              
              {/* Header & Guidance Text */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">Mock Interview Prep</h2>
                <p className="text-[17px] text-[#444746] font-medium">
                  Define your focus to generate targeted mock questions.
                </p>
              </div>

              <div className="space-y-6">
                {/* 1. Select Role */}
                <div className="bg-white p-5 rounded-2xl border border-[#E3E3E3] shadow-sm w-full flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#1F1F1F]">Select a role</h3>
                    <span className="text-[10px] text-[#0B57D0] font-bold uppercase tracking-wider bg-[#E8F0FE] px-2 py-0.5 rounded">Required</span>
                  </div>
                  <div className="relative flex-1 flex flex-col justify-center">
                    <button 
                      onClick={() => setShowRoleSelector(!showRoleSelector)}
                      className="w-full flex items-center justify-between p-3.5 bg-[#F0F4F9] border border-[#E3E3E3] rounded-xl text-sm font-medium text-[#1F1F1F] hover:border-[#0B57D0] transition-all"
                    >
                      <div className="flex items-center gap-2 truncate pr-4">
                        <Briefcase className="w-4 h-4 text-[#444746] flex-shrink-0" />
                        <span className="truncate">
                          {role ? `${role.title} — ${role.company}` : <span className="text-[#444746]">Select from My Roles or Create new</span>}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-[#444746] flex-shrink-0 transition-transform ${showRoleSelector ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showRoleSelector && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E3E3E3] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="max-h-[240px] overflow-y-auto">
                          {roles.length === 0 ? (
                            <div className="p-4 text-center text-sm text-[#444746]">No roles found.</div>
                          ) : (
                            roles.map(r => (
                              <button
                                key={r.id}
                                onClick={() => {
                                  onSelectRole(r);
                                  setShowRoleSelector(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-[#F0F4F9] transition-colors flex items-center justify-between ${role?.id === r.id ? 'bg-[#E8F0FE] text-[#0B57D0] font-bold' : 'text-[#1F1F1F]'}`}
                              >
                                <div className="truncate pr-4">
                                  <p className="font-bold truncate">{r.title}</p>
                                  <p className="text-xs opacity-70 truncate">{r.company}</p>
                                </div>
                                {role?.id === r.id && <Check className="w-4 h-4 flex-shrink-0" />}
                              </button>
                            ))
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            onSelectRole(null);
                            onNavigate('ROLES');
                          }}
                          className="w-full p-3 border-t border-[#E3E3E3] bg-[#FAFAFA] text-[#0B57D0] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#F0F4F9] transition-colors"
                        >
                          <Plus className="w-4 h-4" /> Create new role
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Question Types */}
                <div className="bg-white p-5 rounded-2xl border border-[#E3E3E3] shadow-sm w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#1F1F1F]">Question types</h3>
                    <span className="text-[10px] text-[#0B57D0] font-bold uppercase tracking-wider bg-[#E8F0FE] px-2 py-0.5 rounded">Select at least 1</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUESTION_TYPES.map(type => (
                      <div 
                        key={type.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all h-full ${settings.types.includes(type.id) ? 'bg-[#F0F4F9] border-[#0B57D0]' : 'bg-white border-[#E3E3E3] hover:border-[#C4C7C5]'}`}
                      >
                        <button
                          onClick={() => {
                            const newTypes = settings.types.includes(type.id) 
                              ? settings.types.filter(t => t !== type.id)
                              : [...settings.types, type.id];
                            onUpdateSettings({ ...settings, types: newTypes });
                          }}
                          className="flex-1 flex items-center gap-3 text-left h-full"
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${settings.types.includes(type.id) ? 'bg-[#0B57D0] border-[#0B57D0]' : 'bg-white border-[#C4C7C5]'}`}>
                            {settings.types.includes(type.id) && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1F1F1F] truncate">{type.label}</p>
                            <p className="text-[11px] text-[#444746] truncate">{type.description.split(',')[0]}</p>
                          </div>
                        </button>
                        <button 
                          onClick={() => setShowInfo(type.id)}
                          className="p-1.5 text-[#444746] hover:bg-[#E3E3E3] rounded-full transition-colors flex-shrink-0"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Generation count */}
                <div className="bg-white p-5 rounded-2xl border border-[#E3E3E3] shadow-sm w-full flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#1F1F1F] mb-1">Count</h3>
                      <p className="text-xs text-[#444746]">Max 10</p>
                    </div>
                    <div className="flex items-center bg-[#F0F4F9] rounded-xl p-1 border border-[#E3E3E3]">
                      <button 
                        onClick={() => onUpdateSettings({ ...settings, qty: Math.max(1, settings.qty - 1) })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-[#1F1F1F]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="px-3 flex flex-col items-center min-w-[40px]">
                        <span className="font-bold text-base leading-none">{settings.qty}</span>
                      </div>
                      <button 
                        onClick={() => onUpdateSettings({ ...settings, qty: Math.min(10, settings.qty + 1) })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-[#1F1F1F]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex flex-col items-center pt-8">
                <button 
                  onClick={generateQuestions}
                  disabled={!isValid}
                  className="w-full max-w-[280px] py-3.5 bg-[#0B57D0] text-white rounded-full font-bold text-base shadow-md hover:shadow-lg hover:bg-[#0B67EF] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Generate
                </button>
                
                {!isValid && (
                  <p className="text-center text-xs text-red-500 font-medium mt-3">
                    {!role ? "Please select a role." : "Please select at least one question type."}
                  </p>
                )}
              </div>
            </div>

            {/* Info Modal */}
            {showInfo && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-8 max-w-[560px] w-full shadow-2xl animate-in zoom-in-95 duration-200 relative">
                  <button 
                    onClick={() => setShowInfo(null)}
                    className="absolute top-4 right-4 p-2 text-[#444746] hover:bg-[#F0F4F9] rounded-full transition-colors"
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                  
                  <h4 className="text-xl font-bold text-[#1F1F1F] mb-4">
                    {QUESTION_TYPES.find(t => t.id === showInfo)?.label}
                  </h4>
                  
                  <div className="space-y-4">
                    <p className="text-sm text-[#1F1F1F] leading-relaxed">
                      {QUESTION_TYPES.find(t => t.id === showInfo)?.explanation}
                    </p>
                    
                    <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#E3E3E3]">
                      <p className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">Example Question</p>
                      <p className="text-sm text-[#444746] italic leading-relaxed">
                        {QUESTION_TYPES.find(t => t.id === showInfo)?.example}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button 
                      onClick={() => setShowInfo(null)}
                      className="px-6 py-2 bg-[#0B57D0] text-white rounded-full font-bold hover:bg-[#0B67EF] transition-all"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'GENERATING':
        return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-8">
              <Loader2 className="w-16 h-16 text-[#0B57D0] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#0B57D0] animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-[#1F1F1F] mb-2">Generating Questions...</h3>
            <p className="text-[#444746] max-w-xs mx-auto">AI is analyzing your role context and crafting targeted interview questions.</p>
          </div>
        );

      case 'EDITING':
        if (selectedQuestionIndex !== null) {
          const currentQuestion = generatedQuestions[selectedQuestionIndex];
          
          return (
            <div ref={workspaceContainerRef} className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300 selection:bg-[#FFF9C4] selection:text-[#1F1F1F] [&_*]:outline-none [&_*]:ring-0">
              <SelectionTooltip onQuote={handleQuote} onAIEdit={handleAIEdit} containerRef={workspaceContainerRef} />
              {/* Detail View Header - Minimalist */}
              <div className="flex items-center justify-between mb-6 pt-1">
                <button 
                  onClick={() => {
                    if (initialQuestionId) {
                      onNavigate('QUESTION_BANK');
                    } else {
                      setSelectedQuestionIndex(null);
                      setIsEditingQuestion(false);
                    }
                  }}
                  className="flex items-center gap-1 text-sm font-medium text-[#444746] hover:text-[#0B57D0] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> {initialQuestionId ? 'Back to Question Bank' : 'Back to list'}
                </button>
                
                <div className="flex items-center gap-2">
                  {/* Save button removed */}
                </div>
              </div>

              {/* Detail View Content - Document Style */}
              <div className="flex-1 flex flex-col space-y-4 max-w-3xl mx-auto w-full pb-6">
                {/* Question Area - Document Feel */}
                <section className="bg-[#E8F0FE] p-5 rounded-xl border border-[#D3E3FD] shadow-sm relative group flex-shrink-0 focus:outline-none">
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-medium text-[#1F1F1F] leading-relaxed flex-1 pr-4">
                      {isEditingQuestion ? (
                        <textarea 
                          className="w-full p-0 text-[14px] font-medium text-[#1F1F1F] leading-relaxed bg-transparent border-none focus:ring-0 outline-none resize-none min-h-[60px]"
                          value={tempQuestionText}
                          onChange={(e) => setTempQuestionText(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        currentQuestion.q
                      )}
                    </p>
                    
                    <div className="flex-shrink-0 flex flex-col gap-2">
                      {!isEditingQuestion ? (
                        <button 
                          onClick={() => {
                            setTempQuestionText(currentQuestion.q);
                            setIsEditingQuestion(true);
                          }}
                          className="w-8 h-8 flex items-center justify-center text-[#444746] hover:text-[#0B57D0] transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              const updated = [...generatedQuestions];
                              updated[selectedQuestionIndex] = { ...updated[selectedQuestionIndex], q: tempQuestionText };
                              setGeneratedQuestions(updated);
                              setIsEditingQuestion(false);
                            }}
                            className="px-3 py-1 bg-[#1F1F1F] text-white rounded-full text-[11px] font-bold hover:bg-[#444746] transition-all"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setIsEditingQuestion(false)}
                            className="px-3 py-1 bg-white border border-[#E3E3E3] text-[#444746] rounded-full text-[11px] font-bold hover:bg-[#F0F4F9] transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </section>
                
                {/* Answer / Notes Area */}
                <section className="flex-1 flex flex-col space-y-3 min-h-[400px] overflow-hidden">
                  <div className="flex items-center justify-between px-1 flex-shrink-0">
                    <label className="text-[10px] font-bold text-[#444746] uppercase tracking-widest opacity-60">Notes</label>
                    {(isGeneratingAnswer || isGeneratingAI) && (
                      <span className="flex items-center gap-2 text-[11px] font-bold text-[#0B57D0] animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" /> AI is thinking...
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col bg-white rounded-xl border border-[#E3E3E3] shadow-sm min-h-0 overflow-hidden relative">
                    {isGeneratingAI && (
                      <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in duration-200">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-[#0B57D0] animate-spin" />
                          <span className="text-xs font-bold text-[#0B57D0]">AI Editing...</span>
                        </div>
                      </div>
                    )}

                    {isRecordingInterface ? (
                      <RecordingWorkspace />
                    ) : isGeneratingAnswer && !currentQuestion.a ? (
                      <div className="flex-1 flex flex-col items-center justify-center animate-pulse p-8">
                        <Loader2 className="w-8 h-8 text-[#0B57D0] animate-spin mb-4" />
                        <p className="text-sm font-medium text-[#444746]">Crafting a professional response...</p>
                      </div>
                    ) : currentQuestion.a ? (
                      <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto p-4">
                          <RichTextEditor
                            ref={editorRef}
                            content={currentQuestion.a}
                            onChange={(content) => {
                              const updated = [...generatedQuestions];
                              updated[selectedQuestionIndex] = { ...updated[selectedQuestionIndex], a: content };
                              setGeneratedQuestions(updated);
                            }}
                            placeholder="Write your answer or notes here..."
                            onAskCoPilot={handleQuote}
                            saveStatus={saveStatus}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 overflow-y-auto">
                        <div className="w-16 h-16 bg-[#F0F4F9] rounded-full flex items-center justify-center mb-6">
                          <Lightbulb className="w-8 h-8 text-[#0B57D0]" />
                        </div>
                        <h4 className="text-lg font-bold text-[#1F1F1F] mb-2">Ready to prepare?</h4>
                        <p className="text-sm text-[#444746] mb-8 max-w-xs">Get an AI-suggested answer or start drafting your own notes below.</p>
                        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                          <button 
                            onClick={() => handleGenerateAnswer(selectedQuestionIndex)}
                            disabled={isGeneratingAnswer}
                            className="w-full px-6 py-3 bg-[#0B57D0] text-white rounded-full font-bold text-sm shadow-md hover:bg-[#0B67EF] transition-all flex items-center justify-center gap-2"
                          >
                            {isGeneratingAnswer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Generate Answer
                          </button>
                          <button 
                            onClick={handleTryAnswer}
                            className="w-full px-6 py-3 border border-[#E3E3E3] rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 bg-white text-[#444746] hover:bg-[#F0F4F9]"
                          >
                            <Mic className="w-4 h-4" />
                            Try Answer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          );
        }

        return (
          <div className="max-w-4xl mx-auto w-full bg-white rounded-xl border border-[#E3E3E3] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {generatedQuestions.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  setSelectedQuestionIndex(idx);
                  setChatHistory([{
                    sender: 'AI',
                    text: `I'm here to help you with this question. You can ask me to generate an answer, evaluate your notes, or provide tips.`
                  }]);
                }}
                className={`group relative py-6 px-6 sm:px-8 transition-all cursor-pointer hover:bg-[#F8F9FA] flex items-center min-h-[130px] ${
                  idx !== generatedQuestions.length - 1 ? 'border-b border-[#E3E3E3]' : ''
                }`}
              >
                <div className="flex items-start gap-4 flex-1 pr-24 sm:pr-32">
                  <div className="mt-1 w-6 h-6 rounded-full bg-[#F0F4F9] text-[#444746] text-xs font-bold flex items-center justify-center flex-shrink-0 group-hover:bg-[#0B57D0] group-hover:text-white transition-colors">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#1F1F1F] text-[17px] font-medium leading-relaxed group-hover:text-[#0B57D0] transition-colors">
                      {item.q}
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons (Right Side) */}
                <div className="absolute right-8 sm:right-12 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const updated = [...generatedQuestions];
                      updated.splice(idx, 1);
                      setGeneratedQuestions(updated);
                      if (updated.length === 0) setEditorState('SETTINGS');
                    }}
                    className="w-10 h-10 flex items-center justify-center text-[#444746] hover:bg-[#FFDAD6] hover:text-[#B3261E] rounded-lg transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggle save logic (visual only for now)
                      const btn = e.currentTarget;
                      const icon = btn.querySelector('svg');
                      if (icon?.classList.contains('fill-current')) {
                        icon.classList.remove('fill-current');
                        btn.classList.remove('text-[#0B57D0]');
                        btn.classList.add('text-[#444746]');
                      } else {
                        icon?.classList.add('fill-current');
                        btn.classList.remove('text-[#444746]');
                        btn.classList.add('text-[#0B57D0]');
                      }
                    }}
                    className="w-10 h-10 flex items-center justify-center text-[#444746] hover:bg-[#E8F0FE] hover:text-[#0B57D0] rounded-lg transition-colors"
                    title="Save"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Answer Hint in Bottom Right (Optional, keeping for visual feedback if answered) */}
                {item.a && (
                  <div className="absolute bottom-2 right-20 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-emerald-600 bg-emerald-50 border border-emerald-100">
                      Answered
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const isSetupMode = editorState === 'EMPTY';

  return (
    <div className="h-full animate-in fade-in duration-500 flex flex-col min-h-0">
      <div className={`${isSetupMode ? '' : 'bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)]'} flex flex-col overflow-hidden flex-1 ${cardHeightClass}`}>
        {renderToolbar()}
        
        {selectedQuestionIndex === null ? (
          <div className={`flex-1 overflow-y-auto ${isSetupMode ? '' : 'p-5 bg-[#FAFAFA]'}`}>
            {renderEditorContent()}
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Content */}
            <div className="flex-1 overflow-y-auto p-5 bg-white border-b lg:border-b-0 lg:border-r border-[#E3E3E3]">
              {renderEditorContent()}
            </div>
            
            {/* Right Chat (Copilot) */}
            <div className="w-full lg:w-[35%] flex flex-col bg-[#FAFAFA]">
              <div className="p-4 border-b border-[#E3E3E3] bg-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0B57D0]" />
                <h3 className="text-sm font-bold text-[#1F1F1F]">Copilot</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.sender === 'USER' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'USER' ? 'bg-[#1F1F1F] text-white' : 'bg-[#E8F0FE] text-[#0B57D0]'}`}>
                      {msg.sender === 'USER' ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col gap-2 max-w-[85%]">
                      {msg.sender === 'USER' && (msg as any).quote && (
                        <div className="bg-[#F2F2F2] border-l-2 border-[#0B57D0] p-2 rounded text-[10px] text-[#444746] italic line-clamp-2">
                          "{ (msg as any).quote }"
                        </div>
                      )}
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border shadow-sm whitespace-pre-wrap ${msg.sender === 'USER' ? 'bg-[#F2F2F2] border-[#E3E3E3] text-[#1F1F1F] rounded-tr-none' : 'bg-white border-[#D3E3FD] text-[#1F1F1F] rounded-tl-none'}`}>
                        {msg.text}
                      </div>
                      {((idx === 0 && msg.sender === 'AI') || msg.text.includes("I've transcribed your recording")) && (
                        <div className="flex flex-col gap-1 mt-1">
                          {["Make it concise", "Add STAR format", "Sound more confident"].map(s => (
                            <button key={s} onClick={() => handleQuickPrompt(s)} className="text-xs bg-[#F8F9FA] hover:bg-[#E8F0FE] text-[#444746] px-3 py-1.5 rounded-md transition-colors text-left w-fit">
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white border-t border-[#E3E3E3]">
                {quotedText && (
                  <div className="mb-3 bg-[#F0F4F9] border border-[#D3E3FD] rounded-xl p-3 relative animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-start gap-2 pr-6">
                      <Quote className="w-3.5 h-3.5 text-[#0B57D0] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs text-[#444746] leading-relaxed ${!isQuoteExpanded ? 'line-clamp-2' : ''}`}>
                          {quotedText}
                        </p>
                        {quotedText.length > 100 && (
                          <button 
                            onClick={() => setIsQuoteExpanded(!isQuoteExpanded)}
                            className="text-[10px] font-bold text-[#0B57D0] mt-1 hover:underline"
                          >
                            {isQuoteExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => setQuotedText(null)}
                      className="absolute top-2 right-2 p-1 text-[#444746] hover:bg-[#E3E3E3] rounded-full transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="relative">
                  <input 
                    ref={chatInputRef}
                    type="text" 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)} 
                    placeholder="Ask AI to improve your answer..." 
                    className="w-full pl-4 pr-12 py-3 bg-[#F0F4F9] border-none rounded-full text-sm text-[#1F1F1F] placeholder-[#444746] focus:ring-2 focus:ring-[#0B57D0] outline-none transition-all" 
                  />
                  <button type="submit" disabled={!chatInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#1F1F1F] text-white rounded-full disabled:opacity-30 hover:bg-[#444746] transition-all">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {showMergePrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#1F1F1F] mb-2">Existing Notes Detected</h3>
            <p className="text-sm text-[#444746] mb-6">You already have some draft notes for this question. How would you like to add your new recording?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => applyTranscription(pendingTranscription, 'append')}
                className="w-full py-3 bg-[#0B57D0] text-white rounded-xl font-bold hover:bg-[#0B67EF] transition-colors"
              >
                Append to existing notes
              </button>
              <button 
                onClick={() => applyTranscription(pendingTranscription, 'overwrite')}
                className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
              >
                Overwrite existing notes
              </button>
              <button 
                onClick={handleCancelMerge}
                className="w-full py-3 bg-white border border-[#E3E3E3] text-[#444746] rounded-xl font-bold hover:bg-[#F0F4F9] transition-colors"
              >
                Cancel and discard recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

