
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  User,
  Briefcase,
  MessageSquare,
  FileText,
  Video,
  ClipboardList,
  File,
  ChevronRight,
  ChevronDown,
  LogOut
} from 'lucide-react';
import Profile from './components/Profile';
import RoleList, { INITIAL_ROLES } from './components/RoleList';
import Dashboard from './components/Dashboard';
import { RoleContextBuilder, InterviewPrepBuilder } from './components/Workspace';
import MockInterview from './components/MockInterview';
import QuestionBank from './components/QuestionBank';
import InterviewReports from './components/InterviewReports';
import Login from './components/Login';
import { TargetRole, AppView, UserProfile, SavedQuestion, NavigationSource } from './types';
import { getRoles, updateRole, getSavedQuestions, saveQuestion, deleteSavedQuestion, getProfile, updateProfile, createRole } from './api';

// Moved from Profile.tsx to act as the single source of truth
const INITIAL_PROFILE: UserProfile = {
  fullName: "Claire Liu",
  profilePhoto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=256&h=256&auto=format&fit=crop",
  targetRole: "Product Manager, Data Analyst",
  employmentType: "Full-time",
  email: "claire.liu@example.com",
  phoneNumber: "+1 (555) 123-4567",
  location: "Los Angeles / San Francisco",
  personalWebsite: "https://claireliu.com",
  linkedInProfile: "https://linkedin.com/in/claireliu",
  education: [
    {
      id: 'edu-1',
      institutionName: "University of Southern California (USC)",
      degree: "M.S.",
      fieldOfStudy: "Communication Data Science",
      startDate: "2024",
      endDate: "2026",
      gpa: "3.8",
      relevantCoursework: "Applied Machine Learning, Data Visualization & Storytelling, Product Analytics",
      additionalDetails: ""
    }
  ],
  workExperience: [
    {
      id: 'exp-1',
      companyName: "AI Content Startup (SaaS)",
      jobTitle: "Product Management Intern",
      startDate: "Jun 2024",
      endDate: "Aug 2024",
      description: "• Led AI writing feature definitions, increasing new user activation by 12%\n• Partnered with Engineering & Design teams for rapid sprint execution\n• Analyzed feature performance using SQL and internal dashboards"
    },
    {
      id: 'exp-2',
      companyName: "E-commerce Platform",
      jobTitle: "Data Analyst Intern",
      startDate: "Jun 2023",
      endDate: "Aug 2023",
      description: "• Built conversion funnel dashboards for product and marketing teams\n• Conducted A/B test analysis to inform feature prioritization"
    },
    {
      id: 'exp-missing-demo',
      companyName: "",
      jobTitle: "Research Assistant",
      startDate: "2022",
      endDate: "2023",
      description: ""
    }
  ],
  projects: [
    {
      id: 'proj-1',
      projectName: "AI Writing Tool Onboarding Optimization",
      projectDescription: "Optimized the onboarding flow for a new AI writing tool.",
      startDate: "Jan 2024",
      endDate: "Mar 2024",
      projectLink: "https://github.com/claireliu/ai-onboarding"
    }
  ],
  skills: {
    technicalSkills: "SQL, Python, A/B Testing, Data Analysis",
    toolsAndTechnologies: "Figma, Amplitude, Tableau",
    softSkills: "PRD Writing, Experiment Design, Metrics Definition, Storytelling"
  }
};

const INITIAL_SAVED_QUESTIONS: SavedQuestion[] = [
  // Role 1: Associate Product Manager — OpenAI
  { id: 'q-openai-1', roleId: 'claire-pm-1', type: 'Behavioral & Experience', question: 'Tell me about a time you had to align multiple stakeholders with conflicting priorities.', lastModified: '2026-03-03T10:00:00Z', savedAt: '2026-03-03T10:00:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-2', roleId: 'claire-pm-1', type: 'Behavioral & Experience', question: 'Describe a situation where you had to make a difficult decision with limited data.', lastModified: '2026-03-02T14:30:00Z', savedAt: '2026-03-02T14:30:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-3', roleId: 'claire-pm-1', type: 'Product Design & Sense', question: 'How would you improve the user onboarding experience for ChatGPT?', lastModified: '2026-03-01T09:15:00Z', savedAt: '2026-03-01T09:15:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-4', roleId: 'claire-pm-1', type: 'Product Design & Sense', question: 'Design a feature to increase engagement for OpenAI\'s API developers.', lastModified: '2026-02-28T16:45:00Z', savedAt: '2026-02-28T16:45:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-5', roleId: 'claire-pm-1', type: 'Analytical & Execution', question: 'ChatGPT\'s daily active users dropped by 10%. How would you investigate?', lastModified: '2026-02-27T11:20:00Z', savedAt: '2026-02-27T11:20:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-6', roleId: 'claire-pm-1', type: 'Analytical & Execution', question: 'Define the key success metrics for the new Voice Mode.', lastModified: '2026-02-26T13:10:00Z', savedAt: '2026-02-26T13:10:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-7', roleId: 'claire-pm-1', type: 'Strategy & Vision', question: 'Should OpenAI launch its own search engine? Evaluate the pros and cons.', lastModified: '2026-02-25T15:50:00Z', savedAt: '2026-02-25T15:50:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-8', roleId: 'claire-pm-1', type: 'Strategy & Vision', question: 'How should OpenAI differentiate itself from competitors like Anthropic and Google?', lastModified: '2026-02-24T08:30:00Z', savedAt: '2026-02-24T08:30:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-9', roleId: 'claire-pm-1', type: 'Product Design & Sense', question: 'What is the most underrated feature of ChatGPT and how would you market it?', lastModified: '2026-02-23T12:00:00Z', savedAt: '2026-02-23T12:00:00Z', source: 'MOCK_PREP' },
  { id: 'q-openai-10', roleId: 'claire-pm-1', type: 'Behavioral & Experience', question: 'Tell me about a time you failed to meet a deadline.', lastModified: '2026-02-22T10:45:00Z', savedAt: '2026-02-22T10:45:00Z', source: 'MOCK_PREP' },

  // Role 2: Product Growth Analyst — TikTok
  { id: 'q-tiktok-1', roleId: 'claire-da-1', type: 'Analytical & Execution', question: 'Retention for new users has decreased. How would you analyze the cause?', lastModified: '2026-02-21T09:00:00Z', savedAt: '2026-02-21T09:00:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-2', roleId: 'claire-da-1', type: 'Analytical & Execution', question: 'How would you measure the success of a new video editing tool on TikTok?', lastModified: '2026-02-20T11:30:00Z', savedAt: '2026-02-20T11:30:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-3', roleId: 'claire-da-1', type: 'Analytical & Execution', question: 'We want to increase ad revenue without hurting user retention. How do we balance this?', lastModified: '2026-02-19T15:15:00Z', savedAt: '2026-02-19T15:15:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-4', roleId: 'claire-da-1', type: 'Analytical & Execution', question: 'Design an A/B test for a new \'Shop\' tab layout.', lastModified: '2026-02-18T10:00:00Z', savedAt: '2026-02-18T10:00:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-5', roleId: 'claire-da-1', type: 'Product Design & Sense', question: 'How would you improve the \'For You\' page algorithm transparency?', lastModified: '2026-02-17T14:45:00Z', savedAt: '2026-02-17T14:45:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-6', roleId: 'claire-da-1', type: 'Product Design & Sense', question: 'Design a feature to help creators monetize their content better.', lastModified: '2026-02-16T16:20:00Z', savedAt: '2026-02-16T16:20:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-7', roleId: 'claire-da-1', type: 'Product Design & Sense', question: 'How would you improve the live streaming experience on TikTok?', lastModified: '2026-02-15T09:30:00Z', savedAt: '2026-02-15T09:30:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-8', roleId: 'claire-da-1', type: 'Analytical & Execution', question: 'What metrics would you track to evaluate the health of the creator ecosystem?', lastModified: '2026-02-14T13:00:00Z', savedAt: '2026-02-14T13:00:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-9', roleId: 'claire-da-1', type: 'Product Design & Sense', question: 'Should TikTok expand into long-form video? Why or why not?', lastModified: '2026-02-13T11:15:00Z', savedAt: '2026-02-13T11:15:00Z', source: 'MOCK_PREP' },
  { id: 'q-tiktok-10', roleId: 'claire-da-1', type: 'Analytical & Execution', question: 'Calculate the lifetime value (LTV) of a TikTok user.', lastModified: '2026-02-12T15:40:00Z', savedAt: '2026-02-12T15:40:00Z', source: 'MOCK_PREP' },

  // Role 3: Product Marketing Manager — Notion
  { id: 'q-notion-1', roleId: 'claire-pmm-1', type: 'Strategy & Vision', question: 'How would you position Notion against Microsoft Loop and Google Workspace?', lastModified: '2026-02-11T11:00:00Z', savedAt: '2026-02-11T11:00:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-2', roleId: 'claire-pmm-1', type: 'Strategy & Vision', question: 'Draft a go-to-market strategy for Notion\'s new AI calendar feature.', lastModified: '2026-02-10T09:45:00Z', savedAt: '2026-02-10T09:45:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-3', roleId: 'claire-pmm-1', type: 'Strategy & Vision', question: 'How should Notion expand its user base beyond tech startups?', lastModified: '2026-02-09T13:20:00Z', savedAt: '2026-02-09T13:20:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-4', roleId: 'claire-pmm-1', type: 'Strategy & Vision', question: 'Evaluate the opportunity for Notion to enter the education market more aggressively.', lastModified: '2026-02-08T15:50:00Z', savedAt: '2026-02-08T15:50:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-5', roleId: 'claire-pmm-1', type: 'Behavioral & Experience', question: 'Tell me about a successful product launch you managed.', lastModified: '2026-02-07T10:10:00Z', savedAt: '2026-02-07T10:10:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-6', roleId: 'claire-pmm-1', type: 'Behavioral & Experience', question: 'Describe a time you had to pivot your marketing strategy due to market changes.', lastModified: '2026-02-06T14:30:00Z', savedAt: '2026-02-06T14:30:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-7', roleId: 'claire-pmm-1', type: 'Behavioral & Experience', question: 'How do you handle feedback from product teams that contradicts your market research?', lastModified: '2026-02-05T11:45:00Z', savedAt: '2026-02-05T11:45:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-8', roleId: 'claire-pmm-1', type: 'Strategy & Vision', question: 'What pricing strategy would you recommend for Notion\'s enterprise plan?', lastModified: '2026-02-04T16:00:00Z', savedAt: '2026-02-04T16:00:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-9', roleId: 'claire-pmm-1', type: 'Behavioral & Experience', question: 'Tell me about a time you had to influence a product roadmap based on customer feedback.', lastModified: '2026-02-03T09:20:00Z', savedAt: '2026-02-03T09:20:00Z', source: 'MOCK_PREP' },
  { id: 'q-notion-10', roleId: 'claire-pmm-1', type: 'Strategy & Vision', question: 'Identify a partnership opportunity for Notion and explain its strategic value.', lastModified: '2026-02-02T13:40:00Z', savedAt: '2026-02-02T13:40:00Z', source: 'MOCK_PREP' },
];

// Empty state for signed-in users (fresh start)
const EMPTY_PROFILE: UserProfile = {
  fullName: "",
  profilePhoto: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&h=256&auto=format&fit=crop",
  targetRole: "",
  employmentType: "",
  email: "",
  phoneNumber: "",
  location: "",
  personalWebsite: "",
  linkedInProfile: "",
  education: [],
  workExperience: [],
  projects: [],
  skills: { technicalSkills: "", toolsAndTechnologies: "", softSkills: "" },
};

const App: React.FC = () => {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<'LOGIN' | 'GUEST' | 'USER'>('LOGIN');

  const handleGuest = () => {
    setUserProfile(INITIAL_PROFILE);
    setRoles(INITIAL_ROLES);
    setSavedQuestions(INITIAL_SAVED_QUESTIONS);
    setAuthMode('GUEST');
  };

  const handleSignIn = (_email: string, _password: string) => {
    setUserProfile(EMPTY_PROFILE);
    setRoles([]);
    setSavedQuestions([]);
    setAuthMode('USER');
  };

  // Load all data from Supabase when USER logs in
  useEffect(() => {
    if (authMode === 'USER') {
      getProfile().then((p: any) => {
        if (p && p.fullName) setUserProfile(p);
      }).catch(console.error);
      getRoles().then(setRoles).catch(console.error);
      getSavedQuestions().then(setSavedQuestions).catch(console.error);
    }
  }, [authMode]);

  const handleLogout = () => {
    setAuthMode('LOGIN');
    setView('DASHBOARD');
    setSelectedRole(null);
  };

  // ── App state ───────────────────────────────────────────────────────────────
  const [view, setView] = useState<AppView>('DASHBOARD');
  const [selectedRole, setSelectedRole] = useState<TargetRole | null>(null);
  const [roles, setRoles] = useState<TargetRole[]>([]);

  // Navigation source tracking (v3)
  const [navSource, setNavSource] = useState<NavigationSource | null>(null);
  const [questionBankSelectedRole, setQuestionBankSelectedRole] = useState<string | null>(null);

  // Lifted Mock Prep State
  const [mockPrepSettings, setMockPrepSettings] = useState({
    types: [] as string[],
    qty: 3
  });

  // Lifted State
  const [userProfile, setUserProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Completion Logic - Hardcoded to 75% for Demo purposes as requested
  const completionPercentage = 75;

  const handleSelectRole = (role: TargetRole) => {
    setSelectedRole(role);
    setView('ROLES'); // Go to Context view of the role
  };

  const handleRoleCreate = (newRole: TargetRole) => {
    setRoles(prev => [newRole, ...prev]);
  };

  const handleUpdateRole = async (updatedRole: TargetRole) => {
    try {
      const saved = await updateRole(updatedRole.id, {
        title: updatedRole.title,
        company: updatedRole.company,
        jd: updatedRole.jd,
        teamInfo: updatedRole.teamInfo,
        companyBackground: updatedRole.companyBackground || '',
        teamBackground: updatedRole.teamBackground || '',
        additionalNotes: updatedRole.additionalNotes || '',
        interviewQuestions: updatedRole.interviewQuestions || [],
        // v3 role fields
        location: updatedRole.location || '',
        employmentType: updatedRole.employmentType || '',
        keyResponsibilities: updatedRole.keyResponsibilities || '',
        qualifications: updatedRole.qualifications || '',
        companyOverview: updatedRole.companyOverview || '',
        teamOverview: updatedRole.teamOverview || '',
        additionalInfo: updatedRole.additionalInfo || '',
        interviewQuestionsList: updatedRole.interviewQuestionsList || [],
        generalNotes: updatedRole.generalNotes || '',
        preparationNotes: updatedRole.preparationNotes || '',
        insights: updatedRole.insights || '',
      });
      setSelectedRole(saved);
      setRoles(prev => prev.map(r => r.id === saved.id ? saved : r));
    } catch (err) {
      console.error('Failed to save role:', err);
      // Still update local state so the UI isn't broken
      setSelectedRole(updatedRole);
      setRoles(prev => prev.map(r => r.id === updatedRole.id ? updatedRole : r));
    }
  };

  const handleSaveQuestion = (question: SavedQuestion) => {
    setSavedQuestions(prev => {
      const exists = prev.some(q => q.question === question.question && q.roleId === question.roleId);
      if (exists) return prev;
      return [question, ...prev];
    });
    // Persist to backend (backend handles dedup/upsert by question+roleId)
    if (authMode === 'USER') {
      saveQuestion({
        roleId: question.roleId,
        type: question.type,
        question: question.question,
        answer: question.answer,
        source: question.source || 'MOCK_PREP',
        chatHistory: question.chatHistory,
        transcription: question.transcription,
      }).catch(console.error);
    }
  };

  const handleDeleteQuestion = (id: string) => {
    setSavedQuestions(prev => prev.filter(q => q.id !== id));
    if (authMode === 'USER') {
      deleteSavedQuestion(id).catch(console.error);
    }
  };

  const handleSelectSavedQuestion = (question: SavedQuestion) => {
    const role = roles.find(r => r.id === question.roleId);
    if (role) {
      setSelectedRole(role);
      setSelectedQuestionId(question.id);
      // We need to set mockPrepSettings types to include this question's type so it doesn't look weird?
      // Or just let InterviewPrepBuilder handle it.
      setView('MOCK_PREP');
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'DASHBOARD':
        return (
          <Dashboard
            userProfile={userProfile}
            roles={roles}
            onNavigate={setView}
            onSelectRole={handleSelectRole}
          />
        );
      case 'PROFILE':
        return (
          <Profile
            profile={userProfile}
            onUpdateProfile={(profileOrUpdater: any) => {
              const newProfile = typeof profileOrUpdater === 'function'
                ? profileOrUpdater(userProfile)
                : profileOrUpdater;
              setUserProfile(newProfile);
              if (authMode === 'USER') {
                updateProfile(newProfile).catch(console.error);
              }
            }}
            completionPercentage={completionPercentage}
          />
        );
      case 'ROLES':
        if (!selectedRole) {
          return (
            <RoleList
              roles={roles}
              onSelectRole={handleSelectRole}
              onRoleCreate={handleRoleCreate}
              onRoleDelete={(roleId) => setRoles(prev => prev.filter(r => r.id !== roleId))}
              isGuest={authMode === 'GUEST'}
            />
          );
        }
        return (
          <div className="h-full flex flex-col">
            <div className="mb-6 flex items-center justify-between">
               <div>
                 <button onClick={() => setSelectedRole(null)} className="text-sm text-[#444746] hover:text-[#0B57D0] mb-1 flex items-center gap-1">
                   <ChevronRight className="w-4 h-4 rotate-180" /> Back to Role List
                 </button>
               </div>
            </div>
            <RoleContextBuilder role={selectedRole} onUpdate={handleUpdateRole} />
          </div>
        );
      case 'MOCK_PREP':
        return (
          <InterviewPrepBuilder
            role={selectedRole}
            roles={roles}
            onSelectRole={setSelectedRole}
            onNavigate={setView}
            settings={mockPrepSettings}
            onUpdateSettings={setMockPrepSettings}
            savedQuestions={savedQuestions}
            onSaveQuestion={handleSaveQuestion}
            initialQuestionId={selectedQuestionId}
          />
        );
      case 'LIVE_INTERVIEW':
        return (
          <MockInterview
            workspace={selectedRole}
            roles={roles}
            onSelectRole={setSelectedRole}
            onSaveSession={(questions) => {
              setSavedQuestions(prev => [...questions, ...prev]);
              if (authMode === 'USER') {
                questions.forEach((q: SavedQuestion) => {
                  saveQuestion({
                    roleId: q.roleId,
                    type: q.type,
                    question: q.question,
                    answer: q.answer,
                    source: 'LIVE_INTERVIEW',
                    chatHistory: q.chatHistory,
                    transcription: q.transcription,
                  }).catch(console.error);
                });
              }
            }}
          />
        );
      case 'QUESTION_BANK':
        return (
          <QuestionBank
            roles={roles}
            savedQuestions={savedQuestions}
            onSelectQuestion={handleSelectSavedQuestion}
            onDeleteQuestion={handleDeleteQuestion}
          />
        );
      case 'DOCS_REPORTS':
        return (
          <InterviewReports
            roles={roles}
            onNavigate={setView}
            useMockData={authMode === 'GUEST'}
          />
        );
      default:
        return null;
    }
  };

  const NavItem = ({
    id,
    label,
    icon: Icon,
    isActive,
    onClick,
    hasSubItems = false,
    isExpanded = false
  }: {
    id: AppView,
    label: string,
    icon: any,
    isActive: boolean,
    onClick: () => void,
    hasSubItems?: boolean,
    isExpanded?: boolean
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
        isActive
          ? 'bg-[#D3E3FD] text-[#041E49]'
          : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
      }`}
    >
      <Icon className={`w-5 h-5 ${isActive ? 'text-[#041E49]' : 'text-[#444746]'}`} />
      <span className="flex-1 text-left">{label}</span>
      {hasSubItems && (
        <ChevronDown className={`w-4 h-4 text-[#444746] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      )}
    </button>
  );

  const SubNavItem = ({
    id,
    label,
    isActive,
    onClick
  }: {
    id: AppView,
    label: string,
    isActive: boolean,
    onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 pl-12 pr-4 py-2.5 rounded-lg text-sm transition-all ${
        isActive
          ? 'text-[#0B57D0] font-bold bg-[#F0F4F9]'
          : 'text-[#444746] hover:text-[#1F1F1F] hover:bg-[#F0F4F9]/50'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );

  // Show login page until user authenticates
  if (authMode === 'LOGIN') {
    return <Login onGuest={handleGuest} onSignIn={handleSignIn} />;
  }

  return (
    <div className="flex h-screen bg-[#F0F4F9] font-sans text-[#1F1F1F] overflow-hidden">
      {/* GLOBAL SIDEBAR - Fixed */}
      <aside className="w-64 bg-white border-r border-[#E3E3E3] flex flex-col flex-shrink-0 z-50">
        {/* Brand */}
        <div className="h-20 flex items-center px-6 border-b border-[#E3E3E3]/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1F1F1F] rounded-lg flex items-center justify-center shadow-sm">
              <span className="font-bold text-white text-lg">L</span>
            </div>
            <span className="text-lg font-bold text-[#1F1F1F] tracking-tight">LandIt</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          <NavItem
            id="DASHBOARD"
            label="Dashboard"
            icon={LayoutDashboard}
            isActive={view === 'DASHBOARD'}
            onClick={() => setView('DASHBOARD')}
          />
          <NavItem
            id="PROFILE"
            label="My Profile"
            icon={User}
            isActive={view === 'PROFILE'}
            onClick={() => setView('PROFILE')}
          />
          <NavItem
            id="ROLES"
            label="My Roles"
            icon={Briefcase}
            isActive={view === 'ROLES'}
            onClick={() => {
              setSelectedRole(null);
              setView('ROLES');
            }}
          />

          {/* Interviews Group */}
          <div className="pt-4 pb-1">
            <div className="px-4 py-2 flex items-center justify-between text-[#444746]">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                <span className="text-sm font-medium">Interviews</span>
              </div>
            </div>
            <div className="space-y-0.5 mt-1">
              <SubNavItem
                id="MOCK_PREP"
                label="Mock Prep"
                isActive={view === 'MOCK_PREP'}
                onClick={() => setView('MOCK_PREP')}
              />
              <SubNavItem
                id="LIVE_INTERVIEW"
                label="Live Interview"
                isActive={view === 'LIVE_INTERVIEW'}
                onClick={() => setView('LIVE_INTERVIEW')}
              />
            </div>
          </div>

          {/* Docs Group */}
          <div className="pt-2">
            <div className="px-4 py-2 flex items-center justify-between text-[#444746]">
              <div className="flex items-center gap-3">
                <File className="w-5 h-5" />
                <span className="text-sm font-medium">My Docs</span>
              </div>
            </div>
            <div className="space-y-0.5 mt-1">
              <SubNavItem
                id="QUESTION_BANK"
                label="Question Bank"
                isActive={view === 'QUESTION_BANK'}
                onClick={() => setView('QUESTION_BANK')}
              />
              <SubNavItem
                id="DOCS_REPORTS"
                label="Interview Reports"
                isActive={view === 'DOCS_REPORTS'}
                onClick={() => setView('DOCS_REPORTS')}
              />
            </div>
          </div>
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-[#E3E3E3]">
          <div className="flex items-center gap-3 p-2 rounded-xl">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-[#E3E3E3] flex-shrink-0">
              {userProfile.profilePhoto
                ? <img src={userProfile.profilePhoto} alt="User" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[#E3E3E3] flex items-center justify-center"><User className="w-4 h-4 text-[#444746]" /></div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1F1F1F] truncate">
                {authMode === 'GUEST' ? 'Guest' : (userProfile.fullName || 'My Account')}
              </p>
              <p className="text-xs text-[#444746] truncate flex items-center gap-1">
                {authMode === 'GUEST'
                  ? <span className="text-[10px] font-bold text-[#E8710A] bg-orange-50 px-1.5 py-0.5 rounded">DEMO MODE</span>
                  : 'Free Plan'
                }
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 text-[#C4C7C5] hover:text-[#B3261E] hover:bg-[#FFDAD6] rounded-lg transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[#F0F4F9] p-6">
        <div className="max-w-6xl mx-auto h-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
