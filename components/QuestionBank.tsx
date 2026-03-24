import React, { useState, useRef, useEffect } from 'react';
import { TargetRole, SavedQuestion } from '../types';
import {
  Search,
  Clock,
  ChevronRight,
  Filter,
  Briefcase,
  FileText,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2
} from 'lucide-react';

interface QuestionBankProps {
  roles: TargetRole[];
  savedQuestions: SavedQuestion[];
  onSelectQuestion: (question: SavedQuestion) => void;
  onDeleteQuestion?: (id: string) => void;
}

const QUESTION_TYPES = [
  { id: 'Behavioral & Experience', label: 'Behavioral & Experience', color: 'bg-blue-100 text-blue-700' },
  { id: 'Product Design & Sense', label: 'Product Design & Sense', color: 'bg-purple-100 text-purple-700' },
  { id: 'Analytical & Execution', label: 'Analytical & Execution', color: 'bg-green-100 text-green-700' },
  { id: 'Strategy & Vision', label: 'Strategy & Vision', color: 'bg-orange-100 text-orange-700' },
];

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

const QuestionBank: React.FC<QuestionBankProps> = ({ roles, savedQuestions, onSelectQuestion, onDeleteQuestion }) => {
  const [selectedRole, setSelectedRole] = useState<TargetRole | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter questions based on role, types, and search query (exclude live interview questions)
  const filteredQuestions = savedQuestions.filter(q => {
    if ((q as any).source === 'LIVE_INTERVIEW') return false;
    if (selectedRole && q.roleId !== selectedRole.id) return false;
    if (selectedTypes.length > 0 && !selectedTypes.includes(q.type)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        q.question.toLowerCase().includes(query) || 
        (q.answer && q.answer.toLowerCase().includes(query))
      );
    }
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.lastModified || a.savedAt).getTime();
    const dateB = new Date(b.lastModified || b.savedAt).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // Group questions by role for the main view if no role is selected
  // However, the requirement says: "Level 1: Show Roles list".
  // So if !selectedRole, show roles.

  if (!selectedRole) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-500">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Question Bank</h1>
          <p className="text-[#444746] mt-2">
            These are the questions you saved in Mock Prep. You can revisit, edit, and continue refining them anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(role => {
            const roleQuestions = savedQuestions.filter(q => q.roleId === role.id && (q as any).source !== 'LIVE_INTERVIEW');
            return (
              <div 
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className="bg-white p-6 rounded-2xl border border-[#E3E3E3] shadow-sm hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#F0F4F9] rounded-xl flex items-center justify-center group-hover:bg-[#E3E3E3] transition-colors text-2xl select-none">
                    {getRoleEmoji(role.company)}
                  </div>
                  <span className="bg-[#F0F4F9] text-[#444746] text-xs font-bold px-2 py-1 rounded-full">
                    {roleQuestions.length} Questions
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#1F1F1F] mb-1 group-hover:text-[#0B57D0] transition-colors">
                  {role.title}
                </h3>
                <p className="text-sm text-[#444746]">{role.company}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Role Detail View
  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6">
        <button 
          onClick={() => setSelectedRole(null)}
          className="text-sm text-[#444746] hover:text-[#0B57D0] mb-2 flex items-center gap-1"
        >
          <ChevronRight className="w-4 h-4 rotate-180" /> Back to Roles
        </button>
        <h1 className="text-2xl font-bold text-[#1F1F1F]">{selectedRole.title}</h1>
        <p className="text-[#444746]">{selectedRole.company}</p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          {QUESTION_TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => {
                if (selectedTypes.includes(type.id)) {
                  setSelectedTypes(selectedTypes.filter(t => t !== type.id));
                } else {
                  setSelectedTypes([...selectedTypes, type.id]);
                }
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                selectedTypes.includes(type.id)
                  ? `${type.color} border-transparent ring-2 ring-offset-1 ring-current`
                  : 'bg-white text-[#444746] border-[#E3E3E3] hover:bg-[#F0F4F9]'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444746]" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#E3E3E3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:border-[#0B57D0]"
            />
          </div>
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E3E3E3] rounded-lg text-sm text-[#444746] hover:bg-[#F0F4F9]"
          >
            <Clock className="w-4 h-4" />
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            {sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-6">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E3E3E3] border-dashed">
            <p className="text-[#444746]">No questions found matching your filters.</p>
          </div>
        ) : (
          filteredQuestions.map((q, index) => (
            <div
              key={q.id}
              onClick={() => onSelectQuestion(q)}
              className="bg-white p-4 rounded-xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      QUESTION_TYPES.find(t => t.id === q.type)?.color || 'bg-gray-100 text-gray-700'
                    }`}>
                      {q.type}
                    </span>
                    <span className="text-xs text-[#444746] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(q.lastModified || q.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-[#1F1F1F] line-clamp-2 group-hover:text-[#0B57D0] transition-colors">
                    {q.question}
                  </h3>
                </div>
                <div className="relative flex-shrink-0" ref={openMenuId === q.id ? menuRef : null}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === q.id ? null : q.id); }}
                    className="p-2 text-[#444746] hover:bg-[#F0F4F9] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {openMenuId === q.id && (
                    <div className="absolute right-0 top-8 bg-white border border-[#E3E3E3] rounded-xl shadow-lg z-10 py-1 w-36 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteQuestion?.(q.id); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#B3261E] hover:bg-[#FFDAD6] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuestionBank;
