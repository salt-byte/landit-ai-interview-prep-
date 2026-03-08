import type {
  Education,
  Experience,
  Project,
  UserProfile,
  UploadedFile,
  TargetRole,
  RoleSource,
  InterviewFeedback,
} from './types';

const DEFAULT_PROD_API_URL = 'https://landit-ai-interview-prep.onrender.com';

function resolveBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  return DEFAULT_PROD_API_URL;
}

const BASE_URL = resolveBaseUrl();

function tempId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

type RawExtractedProfile = {
  name?: string;
  headline?: string;
  bio?: string;
  avatar?: string;
  target_roles?: string;
  location?: string;
  education_level?: string;
  years_of_experience?: string;
  interests?: string;
  skills?: {
    technical?: string;
    product?: string;
    communication?: string;
  };
  education?: Array<{
    school?: string;
    degree?: string;
    major?: string;
    year?: string;
    key_coursework?: string;
    academic_focus?: string;
  }>;
  experience?: Array<{
    company?: string;
    role?: string;
    type?: string;
    duration?: string;
    responsibilities?: string;
  }>;
  projects?: Array<{
    name?: string;
    context?: string;
    role?: string;
    tools?: string;
    outcome?: string;
    learnings?: string;
  }>;
};

function normalizeExtractedProfile(raw: RawExtractedProfile): Partial<UserProfile> {
  const education: Education[] = (raw.education ?? []).map((item, index) => ({
    id: tempId('edu', index),
    school: item.school ?? '',
    degree: item.degree ?? '',
    major: item.major ?? '',
    year: item.year ?? '',
    keyCoursework: item.key_coursework ?? '',
    academicFocus: item.academic_focus ?? '',
  }));

  const experience: Experience[] = (raw.experience ?? []).map((item, index) => ({
    id: tempId('exp', index),
    company: item.company ?? '',
    role: item.role ?? '',
    type: item.type ?? 'Full-time',
    duration: item.duration ?? '',
    responsibilities: item.responsibilities ?? '',
  }));

  const projects: Project[] = (raw.projects ?? []).map((item, index) => ({
    id: tempId('proj', index),
    name: item.name ?? '',
    context: item.context ?? '',
    role: item.role ?? '',
    tools: item.tools ?? '',
    outcome: item.outcome ?? '',
    learnings: item.learnings ?? '',
  }));

  return {
    name: raw.name ?? '',
    headline: raw.headline ?? '',
    bio: raw.bio ?? '',
    avatar: raw.avatar ?? '',
    targetRoles: raw.target_roles ?? '',
    location: raw.location ?? '',
    educationLevel: raw.education_level ?? '',
    yearsOfExperience: raw.years_of_experience ?? '',
    interests: raw.interests ?? '',
    skills: {
      technical: raw.skills?.technical ?? '',
      product: raw.skills?.product ?? '',
      communication: raw.skills?.communication ?? '',
    },
    education,
    experience,
    projects,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${options?.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile & { completion_percentage: number }> {
  return request('/api/profile');
}

export async function updateProfile(
  data: Omit<UserProfile, 'id'>
): Promise<UserProfile & { completion_percentage: number }> {
  return request('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getDocuments(): Promise<UploadedFile[]> {
  return request('/api/profile/documents');
}

export async function uploadAndParseDocument(
  file: File
): Promise<{ extracted: Partial<UserProfile>; document_id: number; document: UploadedFile; parse_error?: string | null }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/profile/documents/upload-and-parse`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const raw = await res.json() as {
    extracted: RawExtractedProfile;
    document_id: number;
    document: UploadedFile;
    parse_error?: string | null;
  };

  return {
    ...raw,
    extracted: normalizeExtractedProfile(raw.extracted),
  };
}

export async function uploadDocument(
  file: File,
  typeOverride?: string
): Promise<UploadedFile & { detected_type: string }> {
  const form = new FormData();
  form.append('file', file);
  if (typeOverride) {
    form.append('type_override', typeOverride);
  }
  const res = await fetch(`${BASE_URL}/api/profile/documents/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  await request(`/api/profile/documents/${docId}`, { method: 'DELETE' });
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function getRoles(): Promise<TargetRole[]> {
  return request('/api/roles');
}

export async function getRole(id: string): Promise<TargetRole> {
  return request(`/api/roles/${id}`);
}

export async function createRole(
  data: Omit<TargetRole, 'id' | 'sources'>
): Promise<TargetRole> {
  return request('/api/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(
  id: string,
  data: Omit<TargetRole, 'id' | 'sources'>
): Promise<TargetRole> {
  return request(`/api/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(id: string): Promise<void> {
  await request(`/api/roles/${id}`, { method: 'DELETE' });
}

export async function parseLink(
  url: string
): Promise<{ title: string; company: string; jd: string; teamInfo: string }> {
  const raw = await request<{
    title: string;
    company: string;
    jd: string;
    teamInfo?: string;
    team_info?: string;
  }>('/api/roles/parse-link', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

  return {
    title: raw.title,
    company: raw.company,
    jd: raw.jd,
    teamInfo: raw.teamInfo ?? raw.team_info ?? '',
  };
}

export async function uploadRoleSource(
  roleId: string,
  file: File
): Promise<RoleSource> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/roles/${roleId}/sources/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function addRoleSource(
  roleId: string,
  url: string
): Promise<RoleSource & { extracted_preview: string }> {
  return request(`/api/roles/${roleId}/sources/add-link`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function deleteRoleSource(
  roleId: string,
  sourceId: string
): Promise<void> {
  await request(`/api/roles/${roleId}/sources/${sourceId}`, { method: 'DELETE' });
}

export async function analyzeJD(roleId: string): Promise<unknown> {
  return request(`/api/roles/${roleId}/analyze-jd`, { method: 'POST' });
}

// ─── Interview Prep ───────────────────────────────────────────────────────────

export async function generatePrep(
  roleId: string,
  data: { mode?: string; categories?: string[] } = {}
): Promise<{ content: string; version: number }> {
  return request(`/api/prep/${roleId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'QA', ...data }),
  });
}

export async function getPrep(
  roleId: string
): Promise<{ content: string; version: number; is_user_edited: boolean } | null> {
  try {
    return await request(`/api/prep/${roleId}`);
  } catch {
    return null;
  }
}

export async function updatePrep(
  roleId: string,
  content: string
): Promise<{ ok: boolean; version: number }> {
  return request(`/api/prep/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function chatPrep(
  roleId: string,
  message: string,
  currentContent: string
): Promise<{ content: string; ai_message: string }> {
  return request(`/api/prep/${roleId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, current_content: currentContent }),
  });
}

// ─── Mock Interview ───────────────────────────────────────────────────────────

export async function createInterviewSession(data: {
  role_id?: number;
  interviewer_id?: string;
  transcript_consent?: boolean;
}): Promise<{ id: number; status: string }> {
  return request('/api/interview/sessions', {
    method: 'POST',
    body: JSON.stringify({
      interviewer_id: 'alex',
      transcript_consent: true,
      ...data,
    }),
  });
}

export async function getInterviewFeedback(
  sessionId: number
): Promise<InterviewFeedback> {
  const raw = await request<{
    session_id: number;
    overall_score: number;
    strengths: string[];
    improvements: string[];
    recommended_actions: string[];
    transcript: string;
    dimension_scores: Record<string, number>;
  }>(`/api/interview/sessions/${sessionId}/feedback`);

  return {
    score: raw.overall_score,
    strengths: raw.strengths,
    improvements: raw.improvements,
    recommended_actions: raw.recommended_actions,
    transcript: raw.transcript,
    dimension_scores: raw.dimension_scores,
  };
}

export function createInterviewWS(sessionId: number): WebSocket {
  const wsBase = BASE_URL.replace(/^http/, 'ws');
  return new WebSocket(`${wsBase}/api/interview/sessions/${sessionId}/stream`);
}
