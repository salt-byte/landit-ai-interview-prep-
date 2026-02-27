
import React, { useState, useEffect } from 'react';
import { Plus, ArrowUpRight, FileText, Globe, Loader2, Link as LinkIcon, Sparkles } from 'lucide-react';
import { TargetRole } from '../types';
import { getRoles, createRole, parseLink } from '../api';

interface RoleListProps {
  onSelectRole: (role: TargetRole) => void;
}

const RoleList: React.FC<RoleListProps> = ({ onSelectRole }) => {
  const [roles, setRoles] = useState<TargetRole[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [newRole, setNewRole] = useState({ title: '', company: '', jd: '', teamInfo: '' });

  // UI State for Modal
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'LINK'>('MANUAL');
  const [linkInput, setLinkInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    getRoles().then(setRoles).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!newRole.title || !newRole.company || !newRole.jd) return;
    setIsCreating(true);
    try {
      const role = await createRole({
        ...newRole,
        interviewQuestions: [],
        companyBackground: '',
        teamBackground: '',
        additionalNotes: '',
      });
      setRoles(prev => [role, ...prev]);
      resetModal();
    } catch (e) {
      console.error('Failed to create role', e);
    } finally {
      setIsCreating(false);
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setNewRole({ title: '', company: '', jd: '', teamInfo: '' });
    setActiveTab('MANUAL');
    setLinkInput('');
    setIsAnalyzing(false);
  };

  const handleAnalyzeLink = async () => {
    if (!linkInput.trim()) return;
    setIsAnalyzing(true);
    try {
      const extracted = await parseLink(linkInput.trim());
      setNewRole({
        title: extracted.title,
        company: extracted.company,
        jd: extracted.jd,
        teamInfo: extracted.teamInfo,
      });
      setActiveTab('MANUAL');
    } catch (e) {
      console.error('Failed to parse link', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRoleEmoji = (company: string) => {
    const c = company.toLowerCase();
    
    // OpenAI -> Brain
    if (c.includes('openai')) return '🧠';
    
    // TikTok -> Chart
    if (c.includes('tiktok') || c.includes('bytedance')) return '📊';
    
    // Notion -> Memo
    if (c.includes('notion')) return '📝';

    // Fallback -> Briefcase
    return '💼';
  };

  const isFormValid = newRole.title.trim() !== '' && newRole.company.trim() !== '' && newRole.jd.trim() !== '';

  return (
    <div className="space-y-4">
      {/* Create New Role Button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-between p-4 bg-[#F0F4F9] border border-dashed border-[#C4C7C5] rounded-2xl hover:bg-[#E3E3E3] hover:border-[#444746] transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-full border border-[#E3E3E3]">
            <Plus className="w-5 h-5 text-[#444746]" />
          </div>
          <span className="font-medium text-[#444746] group-hover:text-[#1F1F1F]">Add new target role</span>
        </div>
      </button>

      {/* Role Grid */}
      <div className="grid grid-cols-1 gap-4">
        {roles.map(role => (
          <div 
            key={role.id}
            onClick={() => onSelectRole(role)}
            className="group bg-white border border-[#E3E3E3] rounded-2xl p-6 cursor-pointer hover:border-[#0B57D0] hover:shadow-sm transition-all relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                {/* Emoji Container */}
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-3xl select-none">
                  {getRoleEmoji(role.company)}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-[#1F1F1F] group-hover:text-[#0B57D0] transition-colors">{role.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-[#444746]">{role.company}</span>
                  </div>
                  <p className="mt-3 text-sm text-[#444746] line-clamp-2 leading-relaxed">
                    {role.jd}
                  </p>
                </div>
              </div>
              
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight className="w-5 h-5 text-[#0B57D0]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-[#1F1F1F]/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-[24px] w-full max-w-xl shadow-xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-8 pb-4">
               <h3 className="text-2xl font-normal text-[#1F1F1F] mb-2">New Target Role</h3>
               <p className="text-[#444746] text-sm">Start by providing the basic information for the role you want to prepare for.</p>
            </div>

            {/* Tabs */}
            <div className="px-8 mb-6">
                <div className="flex p-1 bg-[#F0F4F9] rounded-xl">
                    <button 
                        onClick={() => setActiveTab('MANUAL')} 
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'MANUAL' ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#444746] hover:text-[#1F1F1F]'}`}
                    >
                        <FileText className="w-4 h-4" />
                        Manual Input
                    </button>
                    <button 
                        onClick={() => setActiveTab('LINK')} 
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'LINK' ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#444746] hover:text-[#1F1F1F]'}`}
                    >
                        <Globe className="w-4 h-4" />
                        Parse from Link
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="px-8 overflow-y-auto flex-1">
                {activeTab === 'MANUAL' ? (
                    <div className="space-y-5 pb-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-[#444746] uppercase mb-1.5 ml-1">Job Title</label>
                                <input 
                                    value={newRole.title}
                                    onChange={e => setNewRole({...newRole, title: e.target.value})}
                                    className="w-full px-4 py-3 bg-[#F0F4F9] border-none rounded-xl focus:ring-2 focus:ring-[#0B57D0] outline-none text-[#1F1F1F] font-medium placeholder-[#444746]/50 transition-all" 
                                    placeholder="e.g. Product Manager"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#444746] uppercase mb-1.5 ml-1">Company</label>
                                <input 
                                    value={newRole.company}
                                    onChange={e => setNewRole({...newRole, company: e.target.value})}
                                    className="w-full px-4 py-3 bg-[#F0F4F9] border-none rounded-xl focus:ring-2 focus:ring-[#0B57D0] outline-none text-[#1F1F1F] font-medium placeholder-[#444746]/50 transition-all" 
                                    placeholder="e.g. Google"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#444746] uppercase mb-1.5 ml-1">Job Description</label>
                            <textarea 
                                rows={8}
                                value={newRole.jd}
                                onChange={e => setNewRole({...newRole, jd: e.target.value})}
                                className="w-full px-4 py-3 bg-[#F0F4F9] border-none rounded-xl focus:ring-2 focus:ring-[#0B57D0] outline-none resize-none text-[#1F1F1F] text-sm leading-relaxed placeholder-[#444746]/50 transition-all" 
                                placeholder="Paste the job requirements here..."
                            />
                        </div>
                    </div>
                ) : (
                    <div className="py-4">
                        <div className="bg-[#F0F4F9] p-8 rounded-2xl text-center border border-dashed border-[#C4C7C5]">
                           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                             <LinkIcon className="w-6 h-6 text-[#0B57D0]" />
                           </div>
                           <h4 className="text-[#1F1F1F] font-bold mb-2">Import from URL</h4>
                           <p className="text-sm text-[#444746] mb-6 max-w-sm mx-auto">
                             Paste a job link (e.g. LinkedIn or a company career page). We’ll automatically extract the role details.
                           </p>
                           
                           <div className="flex items-center gap-2 max-w-lg mx-auto">
                             <input 
                               value={linkInput}
                               onChange={e => setLinkInput(e.target.value)}
                               className="flex-1 pl-4 pr-4 py-3 bg-white border border-[#E3E3E3] rounded-xl focus:ring-2 focus:ring-[#0B57D0] outline-none text-[#1F1F1F] text-sm transition-all"
                               placeholder="https://linkedin.com/jobs/view/..."
                             />
                             <button 
                                onClick={handleAnalyzeLink}
                                disabled={!linkInput.trim() || isAnalyzing}
                                className="bg-[#1F1F1F] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#444746] disabled:opacity-50 transition-all flex items-center gap-2 flex-shrink-0"
                            >
                                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {isAnalyzing ? 'Analyzing...' : 'Parse Link'}
                            </button>
                           </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Buttons */}
            <div className="p-8 pt-6 flex gap-3">
                <button 
                    onClick={resetModal}
                    className="flex-1 px-6 py-3 bg-white border border-[#E3E3E3] text-[#444746] rounded-full hover:bg-[#F0F4F9] font-bold text-sm transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={handleCreate}
                    disabled={!isFormValid || activeTab === 'LINK' || isCreating}
                    className="flex-1 px-6 py-3 bg-[#0B57D0] text-white rounded-full hover:bg-[#0B67EF] font-bold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isCreating ? 'Creating...' : 'Create Workspace'}
                </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleList;
