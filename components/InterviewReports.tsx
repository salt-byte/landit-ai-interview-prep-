import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Star, 
  ChevronLeft, 
  RefreshCw, 
  Check, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  PlayCircle,
  Edit3,
  User
} from 'lucide-react';
import { TargetRole, InterviewSession, AppView } from '../types';
import { listInterviewSessions, getInterviewSessionDetail } from '../api';

// --- Mock Data ---

const MOCK_SESSIONS: InterviewSession[] = [
  // Product Growth Analyst - TikTok
  {
    id: 's1',
    roleId: 'role-tiktok-1', // Assuming this matches a role ID
    roleTitle: 'Product Growth Analyst',
    company: 'TikTok',
    date: '2026-03-03T14:30:00',
    duration: 1080, // 18 mins
    interviewer: { 
      name: 'Emma Chen', 
      avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Good',
    summary: 'Strong structure, needs deeper technical metrics.',
    strengths: ['Clear communication', 'Good structure'],
    improvements: ['More specific metrics', 'Better time management'],
    transcript: [
      {
        question: "Tell me about a time you had to align multiple stakeholders with conflicting priorities.",
        answer: "I was leading a project to launch a new feature...",
        rating: "Strong",
        feedback: "Excellent use of STAR method.",
        note: "I felt confident here."
      },
      {
        question: "How would you improve user retention for TikTok?",
        answer: "I would focus on the onboarding experience...",
        rating: "Pass",
        feedback: "Good ideas, but could be more data-driven.",
        note: "Need to mention specific metrics next time."
      }
    ]
  },
  {
    id: 's2',
    roleId: 'role-tiktok-1',
    roleTitle: 'Product Growth Analyst',
    company: 'TikTok',
    date: '2026-03-01T10:00:00',
    duration: 900, // 15 mins
    interviewer: { 
      name: 'Alex Morgan', 
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Needs Improvement',
    summary: 'Good energy, but answers lacked depth.',
    strengths: ['Enthusiasm', 'Cultural fit'],
    improvements: ['Technical depth', 'Strategic thinking'],
    transcript: []
  },
  {
    id: 's3',
    roleId: 'role-tiktok-1',
    roleTitle: 'Product Growth Analyst',
    company: 'TikTok',
    date: '2026-02-28T16:00:00',
    duration: 1200, // 20 mins
    interviewer: { 
      name: 'Victor Hale', 
      avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Good',
    summary: 'Solid performance, good analytical skills.',
    strengths: ['Analytical thinking', 'Problem solving'],
    improvements: ['Communication clarity'],
    transcript: []
  },
  // Associate Product Manager - OpenAI
  {
    id: 's4',
    roleId: 'role-openai-1',
    roleTitle: 'Associate Product Manager',
    company: 'OpenAI',
    date: '2026-03-02T09:00:00',
    duration: 1500, // 25 mins
    interviewer: { 
      name: 'Dr. Adrian Park', 
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Excellent',
    summary: 'Outstanding technical depth and product sense.',
    strengths: ['Technical depth', 'Product sense', 'Vision'],
    improvements: [],
    transcript: []
  },
  {
    id: 's5',
    roleId: 'role-openai-1',
    roleTitle: 'Associate Product Manager',
    company: 'OpenAI',
    date: '2026-02-25T11:00:00',
    duration: 1100, // 18 mins
    interviewer: { 
      name: 'Emma Wilson', 
      avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Good',
    summary: 'Good behavioral answers, but needs more structure.',
    strengths: ['Behavioral answers', 'Empathy'],
    improvements: ['Structure'],
    transcript: []
  },
  // Product Marketing Manager - Notion
  {
    id: 's6',
    roleId: 'role-notion-1',
    roleTitle: 'Product Marketing Manager',
    company: 'Notion',
    date: '2026-03-03T13:00:00',
    duration: 1300, // 21 mins
    interviewer: { 
      name: 'Sophia Ramirez', 
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Good',
    summary: 'Great storytelling, but needs more focus on metrics.',
    strengths: ['Storytelling', 'Creativity'],
    improvements: ['Metrics focus'],
    transcript: []
  },
  {
    id: 's7',
    roleId: 'role-notion-1',
    roleTitle: 'Product Marketing Manager',
    company: 'Notion',
    date: '2026-02-20T15:00:00',
    duration: 1000, // 16 mins
    interviewer: { 
      name: 'Alex Morgan', 
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Good',
    summary: 'Decent performance, but lacked specific examples.',
    strengths: ['Communication'],
    improvements: ['Specific examples'],
    transcript: []
  },
  {
    id: 's8',
    roleId: 'role-notion-1',
    roleTitle: 'Product Marketing Manager',
    company: 'Notion',
    date: '2026-02-15T10:00:00',
    duration: 1400, // 23 mins
    interviewer: { 
      name: 'Victor Hale', 
      avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200&h=200' 
    },
    overallRating: 'Good',
    summary: 'Strong strategic thinking.',
    strengths: ['Strategic thinking'],
    improvements: ['Tactical execution'],
    transcript: []
  }
];

// Helper to format time
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface InterviewReportsProps {
  roles: TargetRole[];
  onNavigate?: (view: AppView) => void;
  useMockData?: boolean;
}

// Helper to get role emoji (Same as QuestionBank)
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

const InterviewReports: React.FC<InterviewReportsProps> = ({ roles, onNavigate, useMockData = false }) => {
  const [viewState, setViewState] = useState<'ROLE_LIST' | 'SESSION_LIST' | 'REPORT_DETAIL'>('ROLE_LIST');
  const [selectedRole, setSelectedRole] = useState<TargetRole | null>(null);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // State for Report Detail (Notes)
  const [questionNotes, setQuestionNotes] = useState<{[key: number]: string}>({});
  const [expandedNotes, setExpandedNotes] = useState<{[key: number]: boolean}>({});
  const [savedNotes, setSavedNotes] = useState<{[key: number]: boolean}>({});

  useEffect(() => {
    if (useMockData) {
      setSessions(MOCK_SESSIONS);
      return;
    }
    setIsLoading(true);
    listInterviewSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [useMockData]);

  const handleSaveNote = (index: number) => {
    // In a real app, this would save to the backend
    // Here we just update the UI state to show it's saved
    setSavedNotes(prev => ({ ...prev, [index]: true }));
    
    // Update the mock session data in memory so it persists if we navigate back
    if (selectedSession && selectedSession.transcript[index]) {
      selectedSession.transcript[index].note = questionNotes[index];
    }

    // Hide "Saved" message after 2 seconds
    setTimeout(() => {
      setSavedNotes(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
    }, 2000);
  };

  const getSessionsForRole = (roleId: string) => {
    if (useMockData) {
      // Guest: map demo role IDs to mock sessions by company
      const role = roles.find(r => r.id === roleId);
      if (!role) return [];
      return MOCK_SESSIONS.filter(s => s.company.toLowerCase() === role.company.toLowerCase());
    }
    return sessions.filter(s => s.roleId === roleId);
  };

  const handleRoleClick = (role: TargetRole) => {
    setSelectedRole(role);
    setViewState('SESSION_LIST');
  };

  const handleSessionClick = async (session: InterviewSession) => {
    if (!useMockData) {
      try {
        const detail = await getInterviewSessionDetail(parseInt(session.id));
        setSelectedSession(detail);
      } catch {
        setSelectedSession(session);
      }
    } else {
      setSelectedSession(session);
    }
    setViewState('REPORT_DETAIL');
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setViewState('ROLE_LIST');
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setViewState('SESSION_LIST');
  };

  const handleGoPractice = () => {
    if (onNavigate) onNavigate('LIVE_INTERVIEW');
  };

  const handleSaveAndExit = () => {
    if (onNavigate) onNavigate('DASHBOARD');
  };

  // --- VIEW: ROLE LIST ---
  if (viewState === 'ROLE_LIST') {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Interview Reports</h1>
          <p className="text-[#444746] mt-1">Review your past interview performances and track your progress.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-[#E3E3E3] animate-pulse">
                <div className="w-12 h-12 bg-[#E3E3E3] rounded-xl mb-4" />
                <div className="h-4 bg-[#E3E3E3] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[#E3E3E3] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => {
            const roleSess = getSessionsForRole(role.id);
            return (
              <div
                key={role.id}
                onClick={() => handleRoleClick(role)}
                className="bg-white p-6 rounded-2xl border border-[#E3E3E3] shadow-sm hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#F0F4F9] rounded-xl flex items-center justify-center group-hover:bg-[#E3E3E3] transition-colors text-2xl select-none">
                    {getRoleEmoji(role.company)}
                  </div>
                  <span className="bg-[#F0F4F9] text-[#444746] text-xs font-bold px-2 py-1 rounded-full">
                    {roleSess.length} Interviews
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
        )}
      </div>
    );
  }

  // --- VIEW: SESSION LIST ---
  if (viewState === 'SESSION_LIST' && selectedRole) {
    const roleSessions = getSessionsForRole(selectedRole.id);

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button 
            onClick={handleBackToRoles}
            className="flex items-center gap-1 text-sm text-[#444746] hover:text-[#1F1F1F] mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Roles
          </button>
          <h1 className="text-2xl font-bold text-[#1F1F1F]">{selectedRole.title}</h1>
          <p className="text-[#444746]">{selectedRole.company}</p>
        </div>

        <div className="space-y-4">
          {roleSessions.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#E3E3E3]">
              <p className="text-[#444746]">No interview sessions for this role yet.</p>
            </div>
          )}
          {roleSessions.map((session) => (
            <div 
              key={session.id}
              onClick={() => handleSessionClick(session)}
              className="bg-white rounded-xl border border-[#E3E3E3] p-5 hover:border-[#0B57D0] hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-[#E3E3E3] flex-shrink-0">
                    <img src={session.interviewer.avatar} alt={session.interviewer.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1F1F1F]">{session.interviewer.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-[#444746] mt-1">
                      <span>{new Date(session.date).toLocaleDateString()}</span>
                      <span className="w-1 h-1 rounded-full bg-[#C4C7C5]"></span>
                      <span>{Math.round(session.duration / 60)} min</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-1">
                  <div className="flex items-center gap-2 bg-[#F8F9FA] px-3 py-1 rounded-lg border border-[#E3E3E3]">
                    <span className="text-xs font-bold text-[#444746]">Overall Rating:</span>
                    <span className={`text-xs font-bold ${
                      session.overallRating === 'Excellent' ? 'text-[#137333]' : 
                      session.overallRating === 'Good' ? 'text-[#0B57D0]' : 'text-[#E37400]'
                    }`}>
                      {session.overallRating}
                    </span>
                  </div>
                  <p className="text-sm text-[#444746] italic max-w-md text-right truncate">"{session.summary}"</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- VIEW: REPORT DETAIL ---
  if (viewState === 'REPORT_DETAIL' && selectedSession) {
    return (
      <div className="h-full overflow-y-auto bg-[#F0F4F9] animate-in fade-in duration-300">
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
          
          {/* Top Actions */}
          <div className="flex items-center justify-between">
            <button 
              onClick={handleBackToSessions}
              className="flex items-center gap-1 text-sm text-[#444746] hover:text-[#1F1F1F] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back to List
            </button>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleGoPractice}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0B57D0] text-white rounded-full text-sm font-bold hover:bg-[#0B67EF] transition-colors shadow-sm"
              >
                <Play className="w-4 h-4 fill-current" /> Go Practice
              </button>
            </div>
          </div>

          {/* Single White Container for Report */}
          <div className="bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm overflow-hidden">
            
            {/* Section 1: Interview Report Header */}
            <div className="p-8 border-b border-[#E3E3E3]">
              {/* Row 1: Title & Rating */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <h1 className="text-3xl font-bold text-[#1F1F1F]">Interview Report</h1>
                
                <div className="flex items-center gap-3 bg-[#F8F9FA] px-4 py-2 rounded-xl border border-[#E3E3E3]">
                  <span className="text-sm font-bold text-[#444746]">Overall Rating</span>
                  <div className="flex gap-1">
                    <Star className={`w-5 h-5 fill-current ${selectedSession.overallRating === 'Excellent' ? 'text-[#137333]' : selectedSession.overallRating === 'Good' ? 'text-[#0B57D0]' : 'text-[#E37400]'}`} />
                    <Star className={`w-5 h-5 fill-current ${selectedSession.overallRating === 'Excellent' ? 'text-[#137333]' : selectedSession.overallRating === 'Good' ? 'text-[#0B57D0]' : 'text-[#E37400]'}`} />
                    <Star className={`w-5 h-5 fill-current ${selectedSession.overallRating === 'Excellent' ? 'text-[#137333]' : selectedSession.overallRating === 'Good' ? 'text-[#0B57D0]' : 'text-[#E37400]/30'}`} />
                    <Star className={`w-5 h-5 fill-current ${selectedSession.overallRating === 'Excellent' ? 'text-[#137333]' : 'text-[#0B57D0]/30'}`} />
                    <Star className={`w-5 h-5 fill-current ${selectedSession.overallRating === 'Excellent' ? 'text-[#137333]' : 'text-[#0B57D0]/30'}`} />
                  </div>
                  <span className={`text-sm font-bold ml-1 ${selectedSession.overallRating === 'Excellent' ? 'text-[#137333]' : selectedSession.overallRating === 'Good' ? 'text-[#0B57D0]' : 'text-[#E37400]'}`}>
                    {selectedSession.overallRating}
                  </span>
                </div>
              </div>

              {/* Row 2: Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Role */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <Briefcase className="w-3.5 h-3.5" /> Role
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base truncate" title={selectedSession.roleTitle}>
                    {selectedSession.roleTitle}
                  </div>
                </div>

                {/* Interviewer */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5" /> Interviewer
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base truncate">
                    {selectedSession.interviewer.name}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <Calendar className="w-3.5 h-3.5" /> Date
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base">
                    {new Date(selectedSession.date).toLocaleDateString()}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <Clock className="w-3.5 h-3.5" /> Duration
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base">
                    {formatTime(selectedSession.duration)}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Overall Evaluation */}
            <div className="p-8 border-b border-[#E3E3E3] bg-[#FAFAFA]/50">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#0B57D0]" />
                <h2 className="text-xl font-bold text-[#1F1F1F]">Overall Evaluation</h2>
              </div>
              
              <p className="text-[#444746] leading-relaxed mb-8 text-base">
                {selectedSession.summary}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F1F1F] mb-4">
                    <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" /> Strengths
                  </h4>
                  <ul className="space-y-3">
                    {selectedSession.strengths.map((str, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[#444746] leading-relaxed">
                        <span className="w-1.5 h-1.5 bg-[#2ECC71] rounded-full mt-2 flex-shrink-0"></span> {str}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F1F1F] mb-4">
                    <AlertCircle className="w-4 h-4 text-[#E74C3C]" /> Areas to Improve
                  </h4>
                  <ul className="space-y-3">
                    {selectedSession.improvements.map((imp, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[#444746] leading-relaxed">
                        <span className="w-1.5 h-1.5 bg-[#E74C3C] rounded-full mt-2 flex-shrink-0"></span> {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 3: Transcript and Analysis */}
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-[#1F1F1F]">Transcript and Analysis</h2>
                <button className="flex items-center gap-2 text-[#0B57D0] font-bold text-sm hover:bg-[#E8F0FE] px-4 py-2 rounded-full transition-colors">
                  <PlayCircle className="w-4 h-4" /> View Recording
                </button>
              </div>

              <div className="space-y-10">
                {selectedSession.transcript.length > 0 ? (
                  selectedSession.transcript.map((res, idx) => {
                    const note = questionNotes[idx] || res.note || '';
                    const isNoteExpanded = expandedNotes[idx];

                    // Determine color based on rating
                    const ratingColor = res.rating === 'Strong' ? 'bg-[#2ECC71]' : res.rating === 'Pass' ? 'bg-[#F1C40F]' : 'bg-[#E74C3C]';
                    const ratingText = res.rating === 'Strong' ? 'text-[#2ECC71]' : res.rating === 'Pass' ? 'text-[#F1C40F]' : 'text-[#E74C3C]';

                    return (
                      <div key={idx} className="relative pl-6 border-l-2 border-[#E3E3E3] hover:border-[#0B57D0] transition-colors group">
                        {/* Question Number Bubble */}
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-[#E3E3E3] group-hover:border-[#0B57D0] transition-colors"></div>
                        
                        {/* Question */}
                        <div className="mb-4">
                          <span className="text-xs font-bold text-[#0B57D0] uppercase tracking-wider mb-1 block">Question {idx + 1}</span>
                          <h3 className="text-lg font-bold text-[#1F1F1F] leading-snug">{res.question}</h3>
                        </div>

                        {/* Answer */}
                        <div className="mb-4">
                          <div className="text-[#444746] text-sm leading-relaxed whitespace-pre-wrap">
                            {res.answer}
                          </div>
                        </div>

                        {/* Rating & Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${ratingColor}`}></div>
                            <span className={`text-xs font-bold ${ratingText}`}>{res.rating}</span>
                          </div>
                          
                          {!isNoteExpanded && !note ? (
                            <button 
                              onClick={() => setExpandedNotes(prev => ({ ...prev, [idx]: true }))}
                              className="text-xs font-bold text-[#444746] hover:text-[#0B57D0] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit3 className="w-3 h-3" /> Add Note
                            </button>
                          ) : null}
                        </div>

                        {/* Note Editor */}
                        {(isNoteExpanded || note) && (
                          <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <textarea
                              value={note}
                              onChange={(e) => setQuestionNotes(prev => ({ ...prev, [idx]: e.target.value }))}
                              placeholder="Add your reflection notes here..."
                              className="w-full p-3 bg-[#F8F9FA] border border-[#E3E3E3] rounded-lg text-sm text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 resize-none h-20 mb-2"
                            />
                            <div className="flex justify-end">
                              {savedNotes[idx] ? (
                                <span className="text-xs font-bold text-[#137333] flex items-center gap-1 animate-in fade-in duration-200">
                                  <Check className="w-3 h-3" /> Saved
                                </span>
                              ) : (
                                <button 
                                  onClick={() => handleSaveNote(idx)}
                                  className="px-3 py-1.5 bg-[#0B57D0] text-white text-xs font-bold rounded-lg hover:bg-[#0B67EF] transition-colors"
                                >
                                  Save Note
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 text-center text-[#444746]">
                    <p>No detailed transcript available for this session.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InterviewReports;
