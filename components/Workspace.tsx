
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Mail, 
  Lightbulb, 
  HelpCircle, 
  Video, 
  ChevronLeft,
  ChevronRight,
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
  FileQuestion
} from 'lucide-react';
import { TargetRole, RoleSource, WorkspaceTab } from '../types';
import MockInterview from './MockInterview';
import {
  updateRole, addRoleSource, uploadRoleSource, deleteRoleSource,
  generatePrep, getPrep, updatePrep, chatPrep,
} from '../api';

interface WorkspaceProps {
  workspace: TargetRole;
}

// --- Shared Types ---
type EditorState = 'EMPTY' | 'PICKER' | 'SETTINGS' | 'GENERATING' | 'EDITING';


// --- Role Context Builder Sub-Component (New Split Layout) ---
const RoleContextBuilder: React.FC<{
  role: TargetRole;
  onUpdate: (role: TargetRole) => void
}> = ({ role, onUpdate }) => {
  const [localRole, setLocalRole] = useState<TargetRole>(role);
  const [sources, setSources] = useState<RoleSource[]>(role.sources || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if prop changes
  useEffect(() => {
    setLocalRole(role);
    setSources(role.sources || []);
  }, [role]);

  const handleChange = (field: keyof TargetRole, value: any) => {
    const updated = { ...localRole, [field]: value };
    setLocalRole(updated);
    onUpdate(updated);
  };

  const handleLinkAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    setIsAnalyzing(true);
    try {
      const newSource = await addRoleSource(role.id, linkInput.trim());
      setSources(prev => [...prev, newSource]);
      setLinkInput('');
    } catch (err) {
      console.error('Failed to add source', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    setIsAnalyzing(true);
    try {
      const newSource = await uploadRoleSource(role.id, file);
      setSources(prev => [...prev, newSource]);
    } catch (err) {
      console.error('Failed to upload source', err);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSource = (id: string) => {
    deleteRoleSource(role.id, id).catch(() => {});
    setSources(sources.filter(s => s.id !== id));
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-140px)] animate-in fade-in duration-500">
      
      {/* LEFT: Source Inputs */}
      <div className="lg:col-span-4 flex flex-col h-full min-h-0">
        <div className="bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm flex flex-col h-full overflow-hidden p-6">
          {/* Header */}
          <div className="mb-6 flex-shrink-0">
             <h3 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Source Inputs</h3>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            
            {/* Input 1: File Upload */}
            <div className="flex-shrink-0 mb-6">
              <label 
                className="flex items-center justify-center w-full p-6 border border-dashed border-[#C4C7C5] rounded-2xl cursor-pointer hover:bg-[#F0F4F9] hover:border-[#0B57D0] transition-all gap-3 group"
              >
                <div className="bg-[#0B57D0] p-2 rounded-full text-white shadow-sm group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-[#1F1F1F] text-center">Add Source</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </label>
              <p className="text-xs text-[#444746] mt-3 text-center px-4 leading-relaxed">
                 Upload job descriptions, internal notes, or other relevant documents.
              </p>
            </div>

            {/* Input 2: Link Analysis (Refined) */}
            <div className="mb-8">
               <div className="relative">
                 <input 
                   value={linkInput}
                   onChange={(e) => setLinkInput(e.target.value)}
                   placeholder="Paste URL to analyze..."
                   className="w-full pl-4 pr-12 py-3 bg-[#F0F4F9] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0B57D0] text-[#1F1F1F]"
                 />
                 <button 
                   onClick={handleLinkAnalyze}
                   disabled={!linkInput.trim() || isAnalyzing}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#1F1F1F] text-white rounded-lg hover:bg-[#444746] disabled:opacity-50 transition-colors"
                 >
                   {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                 </button>
               </div>
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
      <div className="lg:col-span-8 flex flex-col h-full min-h-0">
        <div className="bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm flex flex-col h-full overflow-hidden">
          
          {/* Header */}
          <div className="px-8 py-6 border-b border-[#E3E3E3] bg-white flex items-center justify-between flex-shrink-0">
             <div>
               <div className="flex items-center gap-3">
                 <h3 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Role Context</h3>
               </div>
               <p className="text-sm text-[#444746] mt-1">The more details you provide, the better AI can prepare you.</p>
             </div>
             
             <button
              onClick={() => {
                if (isEditing) {
                  const { id, sources: _s, ...roleData } = localRole;
                  updateRole(id, roleData).catch(() => {});
                  onUpdate(localRole);
                }
                setIsEditing(!isEditing);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                isEditing
                  ? 'bg-[#1F1F1F] text-white hover:bg-[#444746] shadow-md'
                  : 'bg-[#F0F4F9] text-[#1F1F1F] hover:bg-[#E3E3E3]'
              }`}
            >
              {isEditing ? <><Check className="w-4 h-4" /> Save</> : <><Edit3 className="w-4 h-4" /> Edit</>}
            </button>
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
                             onUpdate(updated);
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

    </div>
  );
};

// --- Interview Prep Builder Sub-Component (NEW) ---
const InterviewPrepBuilder: React.FC<{ role: TargetRole }> = ({ role }) => {
  const [editorState, setEditorState] = useState<EditorState>('EMPTY');
  const [content, setContent] = useState('');
  
  // Settings Config
  const [generationMode, setGenerationMode] = useState<'QUESTIONS' | 'QA'>('QA');
  const [selectedCategories, setSelectedCategories] = useState({
    fundamentals: true,
    business: true,
    case: true,
    behavioral: true,
    technical: true
  });

  // State: Chat
  const [chatHistory, setChatHistory] = useState<{sender: 'AI'|'USER', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Constants
  const CATEGORIES = [
    { id: 'fundamentals', label: 'Role Fundamentals', description: 'Core competencies and basic role knowledge' },
    { id: 'business', label: 'Business & Product Thinking', description: 'Strategic thinking and product sense' },
    { id: 'case', label: 'Case & Scenario Questions', description: 'Problem solving in hypothetical situations' },
    { id: 'behavioral', label: 'Behavioral & Leadership', description: 'Culture fit and soft skills (STAR)' },
    { id: 'technical', label: 'Depth / Technical', description: 'Specific technical skills and tools' }
  ];

  // Load existing prep content on mount
  useEffect(() => {
    getPrep(role.id).then(result => {
      if (result?.content) {
        setContent(result.content);
        setEditorState('EDITING');
      }
    }).catch(() => {});
  }, [role.id]);

  // Initialize Chat
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([{
        sender: 'AI',
        text: `Welcome to Interview Prep! I can help you build a bank of predicted questions and answers tailored to ${role.company}.`
      }]);
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleGenerateClick = () => {
    setEditorState('SETTINGS');
  };

  const handleConfirmGenerate = async () => {
    setEditorState('GENERATING');
    const categories = Object.entries(selectedCategories)
      .filter(([, v]) => v)
      .map(([k]) => k);
    try {
      const result = await generatePrep(role.id, { mode: generationMode, categories });
      setContent(result.content);
      setEditorState('EDITING');
      setChatHistory(prev => [...prev, {
        sender: 'AI',
        text: `I've generated your interview prep guide. Edit directly or ask me to refine it.`
      }]);
    } catch (err) {
      console.error('Failed to generate prep', err);
      setEditorState('EMPTY');
    }
  };

  const handleManualAdd = () => {
    setEditorState('EDITING');
    setContent(`# Interview Questions\n\nPaste your questions here...`);
    setChatHistory(prev => [...prev, {
      sender: 'AI',
      text: `Ready for your input. Paste your existing questions on the left, and I can help you refine them.`
    }]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatHistory(prev => [...prev, { sender: 'USER', text: userMsg }]);
    setChatInput('');
    try {
      const result = await chatPrep(role.id, userMsg, content);
      setContent(result.content);
      setChatHistory(prev => [...prev, { sender: 'AI', text: result.ai_message }]);
    } catch (err) {
      console.error('Chat failed', err);
      setChatHistory(prev => [...prev, { sender: 'AI', text: 'Sorry, something went wrong.' }]);
    }
  };

  const renderToolbar = () => {
    if (editorState !== 'EDITING') return null;
    return (
      <div className="px-6 py-4 border-b border-[#E3E3E3] flex items-center justify-between bg-[#FAFAFA]">
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-[#E3E3E3]"></div>
           <div className="w-3 h-3 rounded-full bg-[#E3E3E3]"></div>
           <span className="text-xs font-medium text-[#444746] ml-2">Interview_Prep_Bank.md</span>
         </div>
         <div className="flex items-center gap-2">
           <button className="p-2 text-[#444746] hover:bg-[#E3E3E3] rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5">
             <Check className="w-3.5 h-3.5" /> Auto-saved
           </button>
           <div className="h-4 w-px bg-[#C4C7C5] mx-1"></div>
           <button className="p-2 text-[#444746] hover:bg-[#E3E3E3] rounded-lg transition-colors flex items-center gap-1.5 text-sm font-bold">
             <Download className="w-4 h-4" /> Download
           </button>
         </div>
      </div>
    );
  };

  const renderEditorContent = () => {
    switch (editorState) {
      case 'GENERATING':
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-[#0B57D0] animate-spin mb-4" />
            <p className="text-[#1F1F1F] font-medium">AI is generating interview questions...</p>
            <p className="text-sm text-[#444746] mt-2">Analyzing job description and common patterns</p>
          </div>
        );
      case 'EMPTY':
        return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
             <div className="max-w-2xl w-full">
                <div className="w-16 h-16 bg-[#F0F4F9] rounded-full flex items-center justify-center mx-auto mb-6"><FileQuestion className="w-8 h-8 text-[#0B57D0]" /></div>
                <h2 className="text-2xl font-bold text-[#1F1F1F] mb-3">Interview Prep Bank</h2>
                <p className="text-[#444746] mb-10 max-w-lg mx-auto">Build a comprehensive list of predicted questions and structure your answers for <b>{role.title}</b>.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                   <button onClick={handleGenerateClick} className="group bg-white p-6 rounded-2xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:shadow-md transition-all relative overflow-hidden">
                      <div className="flex items-center gap-3 mb-3"><div className="p-2 bg-[#F0F4F9] rounded-lg group-hover:scale-110 transition-transform text-[#0B57D0]"><Sparkles className="w-5 h-5" /></div><h3 className="font-bold text-[#1F1F1F]">Generate from Scratch</h3></div>
                      <p className="text-sm text-[#444746] leading-relaxed">Generate targeted questions across 5 core categories based on the JD.</p>
                   </button>
                   <button onClick={handleManualAdd} className="group bg-white p-6 rounded-2xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:shadow-md transition-all relative overflow-hidden">
                      <div className="flex items-center gap-3 mb-3"><div className="p-2 bg-[#F0F4F9] rounded-lg group-hover:scale-110 transition-transform text-[#0B57D0]"><Upload className="w-5 h-5" /></div><h3 className="font-bold text-[#1F1F1F]">Build from Existing</h3></div>
                      <p className="text-sm text-[#444746] leading-relaxed">Upload or paste your existing question bank to refine and structure it.</p>
                   </button>
                </div>
             </div>
          </div>
        );
      case 'SETTINGS':
        return (
          <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
             <div className="max-w-lg w-full bg-white p-8 rounded-[24px] shadow-sm border border-[#E3E3E3]">
                <div className="flex items-center gap-2 mb-6">
                  <button onClick={() => setEditorState('EMPTY')} className="p-2 -ml-2 hover:bg-[#F0F4F9] rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-[#444746]" /></button>
                  <h3 className="text-xl font-bold text-[#1F1F1F]">Configure Generation</h3>
                </div>

                <div className="mb-8">
                  <h4 className="text-sm font-bold text-[#444746] uppercase tracking-wider mb-3">Output Mode</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setGenerationMode('QUESTIONS')}
                      className={`p-3 rounded-xl border text-left transition-all ${generationMode === 'QUESTIONS' ? 'bg-[#F0F4F9] border-[#0B57D0] ring-1 ring-[#0B57D0]' : 'border-[#E3E3E3] hover:border-[#C4C7C5]'}`}
                    >
                      <span className="block font-bold text-[#1F1F1F] text-sm">Questions Only</span>
                      <span className="text-xs text-[#444746]">Just the list</span>
                    </button>
                    <button 
                      onClick={() => setGenerationMode('QA')}
                      className={`p-3 rounded-xl border text-left transition-all ${generationMode === 'QA' ? 'bg-[#F0F4F9] border-[#0B57D0] ring-1 ring-[#0B57D0]' : 'border-[#E3E3E3] hover:border-[#C4C7C5]'}`}
                    >
                      <span className="block font-bold text-[#1F1F1F] text-sm">Questions + Answers</span>
                      <span className="text-xs text-[#444746]">With frameworks</span>
                    </button>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-sm font-bold text-[#444746] uppercase tracking-wider mb-3">Coverage Categories</h4>
                  <div className="space-y-2">
                    {CATEGORIES.map(cat => (
                      <label key={cat.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#E3E3E3] hover:bg-[#FAFAFA] cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedCategories[cat.id as keyof typeof selectedCategories]}
                          onChange={(e) => setSelectedCategories(prev => ({ ...prev, [cat.id]: e.target.checked }))}
                          className="mt-1 w-4 h-4 text-[#0B57D0] rounded border-gray-300 focus:ring-[#0B57D0]" 
                        />
                        <div>
                          <span className="block font-bold text-[#1F1F1F] text-sm">{cat.label}</span>
                          <span className="text-xs text-[#444746]">{cat.description}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleConfirmGenerate}
                  className="w-full py-3 bg-[#0B57D0] text-white rounded-full font-bold shadow-lg hover:bg-[#0B67EF] transition-transform active:scale-95"
                >
                  Generate Interview Guide
                </button>
             </div>
          </div>
        );
      case 'EDITING':
        return (
          <div className="max-w-[800px] mx-auto bg-white min-h-[1000px] shadow-sm border border-[#E3E3E3] p-12 transition-all">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={() => { if (content) updatePrep(role.id, content).catch(() => {}); }}
              className="w-full h-full min-h-[900px] outline-none resize-none font-mono text-sm leading-relaxed text-[#1F1F1F]"
              placeholder="Interview prep content..."
              spellCheck={false}
            />
          </div>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500">
      <div className="lg:col-span-8 flex flex-col h-full min-h-0">
        <div className="bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm flex flex-col h-full overflow-hidden">
          {renderToolbar()}
          <div className="flex-1 overflow-y-auto p-8 bg-[#FAFAFA]">{renderEditorContent()}</div>
        </div>
      </div>
      <div className="lg:col-span-4 flex flex-col h-full min-h-0">
        <div className="bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm flex flex-col h-full overflow-hidden">
           <div className="px-5 py-4 border-b border-[#E3E3E3] bg-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#0B57D0]" /><h3 className="text-sm font-bold text-[#1F1F1F]">Chat</h3></div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
             {chatHistory.map((msg, idx) => (
               <div key={idx} className={`flex gap-3 ${msg.sender === 'USER' ? 'flex-row-reverse' : ''}`}>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'USER' ? 'bg-[#1F1F1F] text-white' : 'bg-[#E8F0FE] text-[#0B57D0]'}`}>{msg.sender === 'USER' ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}</div>
                 <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[85%] border shadow-sm ${msg.sender === 'USER' ? 'bg-[#F2F2F2] border-[#E3E3E3] text-[#1F1F1F] rounded-tr-none' : 'bg-[#E8F0FE] border-[#D3E3FD] text-[#1F1F1F] rounded-tl-none'}`}>{msg.text}</div>
               </div>
             ))}
             <div ref={chatEndRef} />
           </div>
           <div className="p-4 bg-white border-t border-[#E3E3E3]">
             <form onSubmit={handleSendMessage} className="relative">
               <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={editorState === 'EDITING' ? "Type instructions for AI..." : "AI is ready to help..."} disabled={editorState !== 'EDITING'} className="w-full pl-4 pr-12 py-3 bg-[#F0F4F9] border-none rounded-full text-sm text-[#1F1F1F] placeholder-[#444746] focus:ring-2 focus:ring-[#0B57D0] outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all" />
               <button type="submit" disabled={!chatInput.trim() || editorState !== 'EDITING'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#1F1F1F] text-white rounded-full disabled:opacity-30 hover:bg-[#444746] transition-all"><Send className="w-3.5 h-3.5" /></button>
             </form>
             {editorState === 'EDITING' && (
                <div className="mt-3 flex flex-wrap gap-2 px-1">
                  <span className="text-xs font-bold text-[#444746] self-center mr-1">Try:</span>
                  {["Add more case questions", "Make answers concise", "Increase difficulty"].map(s => (
                    <button key={s} onClick={() => setChatInput(s)} className="text-[10px] sm:text-xs bg-white border border-[#E3E3E3] hover:border-[#0B57D0] hover:text-[#0B57D0] text-[#444746] px-2.5 py-1 rounded-full transition-colors whitespace-nowrap">{s}</button>
                  ))}
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

const Workspace: React.FC<WorkspaceProps> = ({ workspace }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('TARGET');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [roleData, setRoleData] = useState<TargetRole>(workspace);

  // Sync props to state if workspace changes
  useEffect(() => {
    setRoleData(workspace);
  }, [workspace]);

  const tabs = [
    { id: 'TARGET', label: 'Context', icon: Briefcase },
    { id: 'INTERVIEW_QUESTIONS', label: 'Interview Prep', icon: ClipboardList },
    { id: 'MOCK_INTERVIEW', label: 'Live Interview', icon: Video },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'TARGET':
        return <RoleContextBuilder role={roleData} onUpdate={setRoleData} />;
      case 'INTERVIEW_QUESTIONS':
        return <InterviewPrepBuilder role={roleData} />;
      case 'MOCK_INTERVIEW':
        return <MockInterview workspace={roleData} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm">
            <div className="w-20 h-20 bg-[#F0F4F9] rounded-full flex items-center justify-center mb-6">
              <Lightbulb className="w-10 h-10 text-[#C4C7C5]" />
            </div>
            <p className="text-xl font-bold text-[#1F1F1F]">{tabs.find(t => t.id === activeTab)?.label} - Tool Coming Soon</p>
            <p className="text-base text-[#444746] mt-2">We are working on this module.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex items-start h-full">
      {/* Collapsible Sidebar Navigation - Sticky */}
      <div 
        className={`mr-8 py-4 transition-all duration-300 ease-in-out lg:sticky lg:top-24 flex flex-col gap-2 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Toggle Button moved to top-left aligned with Nav items */}
        <div className={`flex mb-2 ${isSidebarCollapsed ? 'justify-center' : 'justify-start px-2'}`}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 text-[#444746] hover:bg-[#E3E3E3] rounded-lg transition-colors"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
             {isSidebarCollapsed ? (
               <ChevronsRight className="w-5 h-5" />
             ) : (
               <ChevronsLeft className="w-5 h-5" />
             )}
          </button>
        </div>

        <div className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WorkspaceTab)}
              title={isSidebarCollapsed ? tab.label : ''}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-full text-sm font-bold transition-all overflow-hidden whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#D3E3FD] text-[#041E49] shadow-sm'
                  : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
              } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            >
              <tab.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-[#041E49]' : 'text-[#444746]'}`} />
              {!isSidebarCollapsed && <span>{tab.label}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Workspace Content Area - Takes remaining width */}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default Workspace;