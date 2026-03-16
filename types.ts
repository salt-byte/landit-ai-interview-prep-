
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

export interface TargetRole {
  id: string;
  title: string;
  company: string;
  jd: string;
  teamInfo: string;
  // New Context Fields
  interviewQuestions?: string[];
  companyBackground?: string;
  teamBackground?: string;
  additionalNotes?: string;
  sources?: RoleSource[];
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
  school: string;
  degree: string;
  major: string;
  year: string;
  keyCoursework: string;
  academicFocus?: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  type: string; // e.g. 'Internship', 'Full-time'
  duration: string;
  responsibilities: string; // Bullet points as a block of text
}

export interface Project {
  id: string;
  name: string;
  context: string;
  role: string;
  tools: string;
  outcome: string;
  learnings?: string;
}

export interface UserSkills {
  technical: string;
  product: string;
  communication: string;
}

export interface UserProfile {
  // Header
  name: string;
  headline: string;
  bio: string;
  avatar: string;
  
  // Basic Info
  targetRoles: string;
  location: string;
  educationLevel: string;
  yearsOfExperience: string;

  // Sections
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: UserSkills;
  interests: string;
}
