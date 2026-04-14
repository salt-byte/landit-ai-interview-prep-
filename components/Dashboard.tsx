import React, { useState, useEffect } from 'react';
import { TargetRole, UserProfile, AppView, SavedQuestion } from '../types';
import { Video, MessageSquare, Calendar as CalendarIcon, ArrowUpRight, ChevronLeft, ChevronRight, Edit2, HelpCircle, Edit3, User } from 'lucide-react';
import { getDashboardStats, listInterviewSessions, getDimensionScores } from '../api';

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
  const [sessionsByRole, setSessionsByRole] = useState<Record<string, number>>({});
  const [dimensionScores, setDimensionScores] = useState<{dimension: string, label: string, score: number}[]>([]);

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

      // Load dimension scores for radar chart
      // Backend returns { dimensions: [...] }
      getDimensionScores().then((res: any) => {
        const scores = res?.dimensions ?? res ?? [];
        if (Array.isArray(scores) && scores.length > 0) {
          setDimensionScores(scores.map((s: any) => ({
            dimension: s.dimension,
            label: s.label || s.dimension.replace(/_/g, ' '),
            score: s.score || 0,
          })));
        }
      }).catch(() => {});

      // Load interview sessions to populate calendar
      listInterviewSessions().then((sessions: any[]) => {
        const dates: Record<number, 'LIVE' | 'MOCK' | 'BOTH'> = {};
        const roleCounts: Record<string, number> = {};
        for (const s of sessions) {
          const d = new Date(s.date);
          const day = d.getDate();
          if (dates[day]) {
            dates[day] = 'BOTH';
          } else {
            dates[day] = 'LIVE';
          }
          // Count sessions per role (any status with feedback counts)
          if (s.roleId) {
            const rid = String(s.roleId);
            roleCounts[rid] = (roleCounts[rid] || 0) + 1;
          }
        }
        setSessionDates(dates);
        setSessionsByRole(roleCounts);
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

  // Profile Strength Logic — computed from actual profile data
  const profileStrength = (() => {
    const fields = [
      userProfile.fullName, userProfile.targetRole, userProfile.email,
      userProfile.location, userProfile.phoneNumber,
      userProfile.skills?.technicalSkills, userProfile.skills?.toolsAndTechnologies, userProfile.skills?.softSkills,
    ];
    const filled = fields.filter((f: any) => f && f.trim()).length;
    const base = (filled / fields.length) * 60;
    let section = 0;
    if (userProfile.education?.length) section += 15;
    if (userProfile.workExperience?.length) section += 15;
    if (userProfile.projects?.length) section += 10;
    return Math.min(Math.round(base + section), 100);
  })();
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
        className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)] p-5 flex flex-col gap-4"
      >
        
        {/* Section 1: Metrics */}
        <div className="grid grid-cols-2 gap-4 flex-shrink-0">
          <div
            onClick={() => onNavigate('LIVE_INTERVIEW')}
            className="bg-[#FAFAFA] px-4 py-2.5 rounded-xl border border-[#E3E3E3] hover:border-[#65558F] hover:shadow-sm transition-all cursor-pointer group relative overflow-hidden flex items-center gap-3"
          >
             <div className="p-2 bg-[#F3E8FF] rounded-lg text-[#65558F] group-hover:scale-110 transition-transform flex-shrink-0">
               <Video className="w-4 h-4" />
             </div>
             <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-[#1F1F1F] leading-tight">{stats.liveInterviews}</h3>
                <p className="text-xs text-[#444746] font-medium">Interviews</p>
             </div>
          </div>

          <div
            onClick={() => onNavigate('MOCK_PREP')}
            className="bg-[#FAFAFA] px-4 py-2.5 rounded-xl border border-[#E3E3E3] hover:border-[#0B57D0] hover:shadow-sm transition-all cursor-pointer group relative overflow-hidden flex items-center gap-3"
          >
             <div className="p-2 bg-[#D3E3FD] rounded-lg text-[#041E49] group-hover:scale-110 transition-transform flex-shrink-0">
               <MessageSquare className="w-4 h-4" />
             </div>
             <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-[#1F1F1F] leading-tight">{stats.mockQuestions}</h3>
                <p className="text-xs text-[#444746] font-medium">Questions</p>
             </div>
          </div>
        </div>

        {/* Section 2: Calendar (Secondary Container) */}
        <div className="flex flex-col bg-[#F8FAFC] rounded-[10px] border border-[rgba(0,0,0,0.04)] p-4">
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

        {/* Section 3: PM Competency Radar */}
        {(() => {
          const DEMO_DIMENSION_SCORES = [
            { dimension: 'product_intuition',          label: 'Product Intuition',    score: 3.6 },
            { dimension: 'user_empathy',               label: 'User Empathy',         score: 4.2 },
            { dimension: 'metrics_driven_thinking',    label: 'Metrics & Data',       score: 2.9 },
            { dimension: 'structured_problem_solving', label: 'Problem Solving',      score: 3.8 },
            { dimension: 'prioritization_tradeoffs',   label: 'Prioritization',       score: 3.2 },
            { dimension: 'execution_delivery',         label: 'Execution',            score: 4.0 },
            { dimension: 'strategic_thinking',         label: 'Strategic Thinking',   score: 2.7 },
            { dimension: 'cross_functional_leadership',label: 'Leadership',           score: 3.5 },
            { dimension: 'stakeholder_communication',  label: 'Communication',        score: 4.1 },
            { dimension: 'technical_fluency',          label: 'Technical Fluency',    score: 2.5 },
          ];
          const DIMENSION_COLORS = [
            '#1A73E8', '#D93025', '#F9AB00', '#1E8E3E', '#9334E6',
            '#00A9A7', '#E8710A', '#C2185B', '#3F51B5', '#795548',
          ];
          const hasData = dimensionScores.length > 0;
          const dims = hasData ? dimensionScores : DEMO_DIMENSION_SCORES;
          const CX = 210;
          const CY = 180;
          const R_MAX = 115;
          const R_LABEL = 138;
          const polygonFill = hasData ? 'rgba(11, 87, 208, 0.15)' : 'rgba(154, 160, 166, 0.15)';
          const polygonStroke = hasData ? '#0B57D0' : '#9AA0A6';
          const dotFill = hasData ? '#0B57D0' : '#9AA0A6';
          return (
          <div className="flex flex-col bg-[#F8FAFC] rounded-[10px] border border-[rgba(0,0,0,0.04)] p-4">
            <h3 className="font-bold text-[#1F1F1F] text-base mb-3">PM Competency Profile</h3>
            <div className="flex items-center justify-center">
              <svg viewBox="0 0 420 380" className="w-full max-w-[360px]">
                {/* Background rings */}
                {[1, 2, 3, 4, 5].map(level => {
                  const r = (level / 5) * R_MAX;
                  return (
                    <circle key={level} cx={CX} cy={CY} r={r} fill="none" stroke="#E3E3E3" strokeWidth={level === 5 ? 1.5 : 0.5} strokeDasharray={level < 5 ? "2 2" : "none"} />
                  );
                })}
                {/* Axis lines + labels */}
                {dims.map((d, i) => {
                  const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
                  const x2 = CX + R_MAX * Math.cos(angle);
                  const y2 = CY + R_MAX * Math.sin(angle);
                  const lx = CX + R_LABEL * Math.cos(angle);
                  const ly = CY + R_LABEL * Math.sin(angle);
                  const cosA = Math.cos(angle);
                  const textAnchor = cosA > 0.2 ? 'start' : cosA < -0.2 ? 'end' : 'middle';
                  return (
                    <g key={d.dimension}>
                      <line x1={CX} y1={CY} x2={x2} y2={y2} stroke="#E3E3E3" strokeWidth="0.5" />
                      <text x={lx} y={ly} textAnchor={textAnchor} dominantBaseline="central" className="text-[11px] font-semibold" fill={DIMENSION_COLORS[i]}>{d.label}</text>
                    </g>
                  );
                })}
                {/* Data polygon */}
                <polygon
                  points={dims.map((d, i) => {
                    const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
                    const r = (d.score / 5) * R_MAX;
                    return `${CX + r * Math.cos(angle)},${CY + r * Math.sin(angle)}`;
                  }).join(' ')}
                  fill={polygonFill}
                  stroke={polygonStroke}
                  strokeWidth="2"
                />
                {/* Score dots */}
                {dims.map((d, i) => {
                  const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
                  const r = (d.score / 5) * R_MAX;
                  return (
                    <circle key={`dot-${i}`} cx={CX + r * Math.cos(angle)} cy={CY + r * Math.sin(angle)} r="3.5" fill={dotFill} stroke="white" strokeWidth="1.5" />
                  );
                })}
              </svg>
            </div>
            {!hasData && (
              <p className="text-center text-xs text-[#80868B] mt-2 italic">Demo scores — complete your first interview to see your real profile</p>
            )}
          </div>
          );
        })()}

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
             {userProfile.profilePhoto
               ? <img src={userProfile.profilePhoto} alt={userProfile.fullName} className="w-full h-full object-cover" />
               : <div className="w-full h-full bg-[#F0F4F9] flex items-center justify-center"><User className="w-8 h-8 text-[#444746]" /></div>
             }
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
                  <div className={`h-full ${getStrengthColor(profileStrength)} rounded-full`} style={{width: `${profileStrength}%`}}></div>
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
                      <span className="text-lg font-bold text-[#0B57D0]">{sessionsByRole[String(role.id)] || 0}</span>
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
