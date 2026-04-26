/**
 * API client for LandIt backend.
 * Base URL is configured via VITE_API_URL environment variable.
 * Auth is handled by Supabase — tokens come from supabase.auth.getSession().
 */

import { supabase } from './lib/supabase';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Inject Supabase JWT token if available
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If the caller passed their own AbortSignal (e.g. for cancel-on-modal-close),
  // honor it instead of creating an internal timeout-only controller.
  let signal = options.signal;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  if (!signal) {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
    signal = controller.signal;
  }
  const res = await fetch(url, { ...options, headers, signal }).finally(() => {
    if (timeout) clearTimeout(timeout);
  });

  if (res.status === 401) {
    await supabase.auth.signOut();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getProfile() {
  return request<any>('/api/profile');
}

export async function updateProfile(data: any) {
  return request<any>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getDocuments() {
  return request<any[]>('/api/profile/documents');
}

export async function uploadDocument(file: File, typeOverride?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (typeOverride) formData.append('type_override', typeOverride);

  return request<any>('/api/profile/documents/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function uploadAndParseDocument(
  file: File,
  extractedText?: string,
  signal?: AbortSignal,
) {
  const formData = new FormData();
  formData.append('file', file);
  if (extractedText) formData.append('extracted_text', extractedText);

  return request<any>('/api/profile/documents/upload-and-parse', {
    method: 'POST',
    body: formData,
    signal,
  });
}

export async function deleteDocument(docId: string) {
  return request<any>(`/api/profile/documents/${docId}`, {
    method: 'DELETE',
  });
}

// ─── Roles ──────────────────────────────────────────────────────────────────

export async function getRoles() {
  return request<any[]>('/api/roles');
}

export async function createRole(data: any) {
  return request<any>('/api/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRole(roleId: string) {
  return request<any>(`/api/roles/${roleId}`);
}

export async function updateRole(roleId: string, data: any) {
  return request<any>(`/api/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(roleId: string) {
  return request<any>(`/api/roles/${roleId}`, {
    method: 'DELETE',
  });
}

export async function parseLink(url: string) {
  return request<any>('/api/roles/parse-link', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function uploadRoleSource(roleId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return request<any>(`/api/roles/${roleId}/sources/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function addLinkSource(roleId: string, url: string) {
  return request<any>(`/api/roles/${roleId}/sources/add-link`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function deleteRoleSource(roleId: string, sourceId: string) {
  return request<any>(`/api/roles/${roleId}/sources/${sourceId}`, {
    method: 'DELETE',
  });
}

export async function analyzeJD(roleId: string) {
  return request<any>(`/api/roles/${roleId}/analyze-jd`, {
    method: 'POST',
  });
}

export async function getDimensionModel(roleId: string) {
  return request<any>(`/api/roles/${roleId}/dimension-model`);
}

export async function updateDimensionModel(roleId: string, dimensions: any) {
  return request<any>(`/api/roles/${roleId}/dimension-model`, {
    method: 'PUT',
    body: JSON.stringify({ dimensions }),
  });
}

// ─── Interview Prep ─────────────────────────────────────────────────────────

export async function generatePrep(roleId: string, mode = 'QA', categories?: string[]) {
  return request<any>(`/api/prep/${roleId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ mode, categories }),
  });
}

export async function getPrep(roleId: string) {
  return request<any>(`/api/prep/${roleId}`);
}

export async function updatePrep(roleId: string, content: string) {
  return request<any>(`/api/prep/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function chatPrep(roleId: string, message: string, currentContent: string) {
  return request<any>(`/api/prep/${roleId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, current_content: currentContent }),
  });
}

// ─── Mock Interview ─────────────────────────────────────────────────────────

export async function createInterviewSession(roleId?: string, interviewerId = 'alex') {
  return request<any>('/api/interview/sessions', {
    method: 'POST',
    body: JSON.stringify({
      role_id: roleId ? parseInt(roleId) : null,
      interviewer_id: interviewerId,
    }),
  });
}

export async function listInterviewSessions() {
  return request<any[]>('/api/interview/sessions');
}

export async function getSessionDetail(sessionId: string) {
  return request<any>(`/api/interview/sessions/${sessionId}/detail`);
}

export async function getInterviewFeedback(sessionId: string) {
  return request<any>(`/api/interview/sessions/${sessionId}/feedback`);
}

export async function finishSession(sessionId: number, transcript: {role: string, text: string}[], interviewerId?: string) {
  return request<any>(`/api/interview/sessions/${sessionId}/finish`, {
    method: 'POST',
    body: JSON.stringify({ transcript, interviewer_id: interviewerId }),
  });
}

export async function updateTranscriptNote(sessionId: string, itemIndex: number, note: string) {
  return request<any>(`/api/interview/sessions/${sessionId}/feedback/notes/${itemIndex}`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  });
}

export async function createInterviewWS(sessionId: string): Promise<WebSocket> {
  const wsBase = API_BASE.replace(/^http/, 'ws');
  const token = await getToken() || '';
  return new WebSocket(`${wsBase}/api/interview/sessions/${sessionId}/stream?token=${token}`);
}

// ─── Question Bank ──────────────────────────────────────────────────────────

export async function getSavedQuestions(roleId?: string, questionType?: string) {
  const params = new URLSearchParams();
  if (roleId) params.append('role_id', roleId);
  if (questionType) params.append('question_type', questionType);
  const qs = params.toString();
  return request<any[]>(`/api/interview/questions${qs ? `?${qs}` : ''}`);
}

export async function saveQuestion(data: {
  roleId: string;
  type: string;
  question: string;
  answer?: string;
  source?: string;
  chatHistory?: any[];
  transcription?: string;
}) {
  return request<any>('/api/interview/questions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSavedQuestion(
  questionId: string,
  data: { answer?: string; chatHistory?: any[]; transcription?: string },
) {
  return request<any>(`/api/interview/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSavedQuestion(questionId: string) {
  return request<any>(`/api/interview/questions/${questionId}`, {
    method: 'DELETE',
  });
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  return request<any>('/api/dashboard/stats');
}

// ─── Compute ────────────────────────────────────────────────────────────────

export async function getGapMatrix(roleId: string) {
  return request<any>(`/api/compute/gap-matrix/${roleId}`);
}

export async function getUserDimensions() {
  return request<any>('/api/compute/user-dimensions');
}

export async function extractUserDimensions() {
  return request<any>('/api/compute/extract-user-dimensions', {
    method: 'POST',
  });
}

export async function getWeaknessVector() {
  return request<any>('/api/compute/weakness-vector');
}

export async function getDimensionScores() {
  return request<any>('/api/compute/user-dimensions');
}

export async function getAbilityCurve() {
  return request<any>('/api/compute/ability-curve');
}
