import React, { useState, useEffect } from 'react';
import { TargetRole, UserProfile, AppView, SavedQuestion } from '../types';
import { Video, MessageSquare, Calendar as CalendarIcon, ArrowUpRight, ChevronLeft, ChevronRight, Edit2, HelpCircle, Edit3 } from 'lucide-react';
import { getDashboardStats, listInterviewSessions } from '../api';

interface DashboardProps {
  userProfile: UserProfile;
  roles: TargetRole[];
  savedQuestions?: SavedQuestion[];
  onNavigate: (view: AppView) => void;
  onSelectRole: (role: TargetRole) => void;
  isGuest?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ userProfile, roles, savedQuestions, onNavigate, onSelectRole, isGuest }) => {
  // Stats — loaded from backend or computed from props
  const [stats, setStats] = useState({ liveInterviews: 0, mockQuestions: 0 });
  const [sessionDates, setSessionDates] = useState<Record<number, 'LIVE' | 'MOCK' | 'BOTH'>>({});

  useEffect(() => {
    if (isGuest) {
      // Guest mode: compute from local data
      setStats({
        liveInterviews: 0,
        mockQuestions: savedQuestions?.length || 0,
      });
    } else {
      // USER mode: load from backend
      getDashboardStats().then((data: any) => {
        setStats({
          liveInterviews: data.live_interviews || 0,
          mockQuestions: data.mock_questions || 0,
        });
      }).catch(() => {});

      // Load interview sessions to populate calendar
      listInterviewSessions().then((sessions: any[]) => {
        const dates: Record<number, 'LIVE' | 'MOCK' | 'BOTH'> = {};
        for (const s of sessions) {
          const d = new Date(s.date);
          const day = d.getDate();
          if (dates[day]) {
            dates[day] = 'BOTH';
          } else {
            dates[day] = 'LIVE';
          }
        }
        setSessionDates(dates);
      }).catch(() => {});
    }
  }, [isGuest, savedQuestions]);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calendar Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Real events from backend sessions
  const events = sessionDates;

  const getEventStyle = (type?: 'LIVE' | 'MOCK' | 'BOTH') => {
    if (!type) return '';
    switch (type) {
      case 'LIVE': return 'bg-[#E8DEF8] text-[#4A148C] font-bold hover:bg-[#D8C8F8]'; // Purple
      case 'MOCK': return 'bg-[#D3E3FD] text-[#041E49] font-bold hover:bg-[#C3D3FD]'; // Blue
      case 'BOTH': return 'bg-[#0B57D0] text-white font-bold hover:bg-[#0B67EF]'; // Darker Blue
      default: return '';
    }
  };

  const handleDayClick = (day: number) => {
    const type = events[day];
    if (!type) return;
    if (type === 'LIVE' || type === 'BOTH') onNavigate('LIVE_INTERVIEW');
    else if (type === 'MOCK') onNavigate('MOCK_PREP');
  };

  // Profile Strength Logic
  const profileStrength = 75;
  const getStrengthColor = (val: number) => {
    if (val > 80) return 'bg-[#14AE5C]'; // Green
    if (val >= 60) return 'bg-[#FA7B17]'; // Orange
    return 'bg-[#B3261E]'; // Red
  };
  const getStrengthTextColor = (val: number) => {
    if (val > 80) return 'text-[#14AE5C]';
    if (val >= 60) return 'text-[#FA7B17]';
    return 'text-[#B3261E]';
  };

  // Helper for Role Emojis
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      
      {/* UNIFIED LEFT CARD: Metrics + Calendar */}
      <div 
        className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)] p-5 flex flex-col gap-6 overflow-hidden h-full"
      >
        
        {/* Section 1: Metrics */}
        <div className="grid grid-cols-2 gap-4 flex-shrink-0">
          <div 
            onClick={() => onNavigate('LIVE_INTERVIEW')}
            className="bg-[#FAFAFA] p-4 rounded-xl border border-[#E3E3E3] hover:border-[#65558F] hover:shadow-sm transition-all cursor-pointer group relative overflow-hidden"
          >
             <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-[#F3E8FF] rounded-lg text-[#65558F] group-hover:scale-110 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#65558F] opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             <div>
                <h3 className="text-3xl font-bold text-[#1F1F1F] mb-0.5">{stats.liveInterviews}</h3>
                <p className="text-sm text-[#444746] font-medium leading-tight">Interviews Completed</p>
             </div>
          </div>

          <div 
            onClick={() => onNavigate('MOCK_PREP')}
            className="bg-[#FAFAFA] p-4 rounded-xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:shadow-sm transition-all cursor-pointer group relative overflow-hidden"
          >
             <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-[#D3E3FD] rounded-lg text-[#041E49] group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#0B57D0] opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             <div>
                <h3 className="text-3xl font-bold text-[#1F1F1F] mb-0.5">{stats.mockQuestions}</h3>
                <p className="text-sm text-[#444746] font-medium leading-tight">Questions Prepared</p>
             </div>
          </div>
        </div>

        {/* Section 2: Calendar (Secondary Container) */}
        <div className="flex flex-col overflow-y-auto bg-[#F8FAFC] rounded-[10px] border border-[rgba(0,0,0,0.04)] p-4">
          <div className="flex items-end justify-between mb-3 flex-shrink-0">
            <div>
              <h3 className="font-bold text-[#1F1F1F] text-base flex items-center gap-2">
                Practice Calendar
                <div className="group/tooltip relative">
                  <HelpCircle className="w-3.5 h-3.5 text-[#C4C7C5] cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-[#1F1F1F] text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    Tracks your interview and mock practice history.
                  </div>
                </div>
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[#444746]">{monthNames[month]} {year}</span>
              <div className="flex gap-0.5">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-white/80 rounded-full text-[#444746] transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={handleNextMonth} className="p-1 hover:bg-white/80 rounded-full text-[#444746] transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="h-6 text-[10px] font-bold text-[#444746] uppercase flex items-center justify-center">{day}</div>
            ))}
            
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
               <div key={`empty-${i}`} className="h-[34px]" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === year;
              const hasEvent = isCurrentMonth && events[day];
              const isToday = isCurrentMonth && day === new Date().getDate();

              return (
                <div 
                  key={day} 
                  onClick={() => handleDayClick(day)}
                  className={`
                    h-[34px] rounded-lg flex items-center justify-center text-[13px] relative transition-colors
                    ${hasEvent ? `${getEventStyle(events[day])} cursor-pointer` : 'text-[#1F1F1F] hover:bg-white/80 cursor-default'}
                    ${isToday ? 'ring-2 ring-[#1F1F1F] ring-offset-1' : ''}
                  `}
                >
                  {day}
                </div>
              );
            })}
          </div>
          
          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-[#E3E3E3]/60 flex gap-4 text-[11px] font-medium justify-center flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#E8DEF8]"></div>
              <span className="text-[#444746]">Live</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D3E3FD]"></div>
              <span className="text-[#444746]">Mock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0B57D0]"></div>
              <span className="text-[#444746]">Both</span>
            </div>
          </div>
        </div>
      </div>

      {/* UNIFIED RIGHT CARD: Profile + Roles */}
      <div 
        className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)] flex flex-col overflow-hidden h-full"
      >
        
        {/* Section 1: Profile Summary */}
        <div className="p-5 border-b border-[#E3E3E3] flex items-center gap-6 flex-shrink-0">
           <div 
             onClick={() => onNavigate('PROFILE')}
             className="w-20 h-20 rounded-full border-2 border-[#E3E3E3] overflow-hidden hover:border-[#0B57D0] transition-colors cursor-pointer flex-shrink-0"
           >
             <img src={userProfile.profilePhoto} alt={userProfile.fullName} className="w-full h-full object-cover" />
           </div>
           
           <div className="flex-1 min-w-0">
             <div className="flex justify-between items-start mb-1">
                <h2 className="text-xl font-bold text-[#1F1F1F] truncate">{userProfile.fullName}</h2>
                <button 
                  onClick={() => onNavigate('PROFILE')}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#1F1F1F] bg-[#F0F4F9] hover:bg-[#E3E3E3] px-3 py-1.5 rounded-full transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
             </div>
             <p className="text-sm text-[#444746] mb-3 truncate">{userProfile.targetRole}</p>
             
             <div className="w-full max-w-xs">
                <div className="flex items-center justify-between mb-1.5">
                   <span className={`text-xs font-bold ${getStrengthTextColor(profileStrength)} uppercase tracking-wider`}>{profileStrength}% Complete</span>
                </div>
                <div className="w-full h-1.5 bg-[#F0F4F9] rounded-full overflow-hidden">
                  <div className={`h-full ${getStrengthColor(profileStrength)} w-[75%] rounded-full`}></div>
                </div>
             </div>
           </div>
        </div>

        {/* Section 2: Active Roles */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#FAFAFA] overflow-hidden">
          <div className="p-6 pb-2 flex-shrink-0">
             <h3 className="font-bold text-[#1F1F1F] text-lg">
               You are working on {roles.length} {roles.length === 1 ? 'role' : 'roles'}.
             </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-3">
            {roles.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-[#444746] text-sm">
                 No active roles. <button onClick={() => onNavigate('ROLES')} className="text-[#0B57D0] font-bold hover:underline ml-1">Add one</button>
               </div>
            ) : (
              roles.map((role, idx) => (
                <div 
                  key={role.id}
                  onClick={() => onSelectRole(role)}
                  className="bg-white p-5 rounded-xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:shadow-md cursor-pointer transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#F0F4F9] border border-[#E3E3E3] flex items-center justify-center text-xl">
                        {getRoleEmoji(role.company)}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#1F1F1F] text-base group-hover:text-[#0B57D0] transition-colors">{role.title}</h4>
                        <p className="text-xs text-[#444746] font-medium">{role.company}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSelectRole(role); }}
                      className="p-2 text-[#444746] hover:bg-[#F0F4F9] rounded-full transition-colors"
                      title="Edit Role"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-[#F0F4F9]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-[#0B57D0]">{idx % 2 === 0 ? '2' : '0'}</span>
                      <span className="text-xs font-bold text-[#444746] uppercase tracking-wider">Interviews Completed</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
