
export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  date: string;
}

export interface RoleSource {
  id: string;
  name: string;
  type: string;
  date: string;
}

export interface InterviewQuestion {
  text: string;
  notes?: string;
}

export interface TargetRole {
  id: string;
  title: string;
  company: string;
  jd: string;
  teamInfo: string;
  // New Context Fields
  location?: string;
  employmentType?: string;
  keyResponsibilities?: string;
  qualifications?: string;
  companyOverview?: string;
  teamOverview?: string;
  additionalInfo?: string;
  interviewQuestionsList?: InterviewQuestion[];
  generalNotes?: string;
  preparationNotes?: string;
  insights?: string;

  // New Context structure (aligned with upload content types)
  companyTeamOverview?: string;
  productOverview?: string;
  industryInsights?: string;
  interviewExperiences?: string;

  // Legacy fields for backward compatibility
  interviewQuestions?: string[];
  companyBackground?: string;
  teamBackground?: string;
  additionalNotes?: string;
  sources?: RoleSource[];
}

export interface NavigationSource {
  type: 'QUESTION_BANK' | 'DIRECT';
  roleId?: string;
  roleTitle?: string;
}

export type AppView = 
  | 'DASHBOARD' 
  | 'PROFILE' 
  | 'ROLES' 
  | 'MOCK_PREP' 
  | 'LIVE_INTERVIEW'
  | 'QUESTION_BANK'
  | 'DOCS_REPORTS';

export type WorkspaceTab = 
  | 'TARGET'
  | 'INTERVIEW_QUESTIONS'
  | 'MOCK_INTERVIEW';

export interface SavedQuestion {
  id: string;
  roleId: string;
  type: string; // e.g., 'Behavioral', 'Product Design'
  question: string;
  answer?: string;
  lastModified: string; // ISO date string
  savedAt: string; // ISO date string
  source?: 'MOCK_PREP';
  // Restoration Fields
  chatHistory?: { sender: 'USER' | 'AI'; text: string; quote?: string }[];
  transcription?: string;
}

export interface TranscriptItem {
  question: string;
  answer: string;
  rating: 'Strong' | 'Pass' | 'Needs improvement';
  feedback: string;
  note?: string;
  timestamp?: string;
}

export interface InterviewSession {
  id: string;
  roleId: string;
  roleTitle: string;
  company: string;
  date: string; // ISO string
  duration: number; // seconds
  interviewer: {
    name: string;
    avatar: string;
  };
  overallRating: 'Good' | 'Excellent' | 'Needs Improvement';
  summary: string;
  strengths: string[];
  improvements: string[];
  transcript: TranscriptItem[];
}

export interface InterviewFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  transcript: string;
}

// --- Career Profile Structures ---

export interface Education {
  id: string;
  institutionName: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  gpa: string;
  relevantCoursework: string;
  additionalDetails: string;
}

export interface WorkExperience {
  id: string;
  companyName: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Project {
  id: string;
  projectName: string;
  projectDescription: string;
  startDate: string;
  endDate: string;
  projectLink: string;
}

export interface UserSkills {
  technicalSkills: string;
  toolsAndTechnologies: string;
  softSkills: string;
}

export interface UserProfile {
  // Personal
  fullName: string;
  profilePhoto: string;
  targetRole: string;
  employmentType: string;
  email: string;
  phoneNumber: string;
  location: string;
  personalWebsite: string;
  linkedInProfile: string;

  // Sections
  education: Education[];
  workExperience: WorkExperience[];
  projects: Project[];
  skills: UserSkills;
}
