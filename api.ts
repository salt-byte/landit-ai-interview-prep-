import type {
    UserProfile,
    UploadedFile,
    TargetRole,
    RoleSource,
    InterviewFeedback,
    SavedQuestion,
    InterviewSession,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
): Promise<{ extracted: Partial<UserProfile>; document_id: number; document: UploadedFile }> {
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
    return res.json();
}

export async function uploadDocument(
    file: File
): Promise<UploadedFile & { detected_type: string }> {
    const form = new FormData();
    form.append('file', file);
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

export async function createRole(
    data: Omit<TargetRole, 'id'>
): Promise<TargetRole> {
    return request('/api/roles', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateRole(
    id: string,
    data: Omit<TargetRole, 'id'>
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
    const raw = await request<{ title: string; company: string; jd: string; team_info?: string; teamInfo?: string }>('/api/roles/parse-link', {
        method: 'POST',
        body: JSON.stringify({ url }),
    });
    return {
        title: raw.title || '',
        company: raw.company || '',
        jd: raw.jd || '',
        teamInfo: raw.teamInfo || raw.team_info || '',
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

export async function addRoleLinkSource(
    roleId: string,
    url: string
): Promise<RoleSource> {
    return request(`/api/roles/${roleId}/sources/add-link`, {
        method: 'POST',
        body: JSON.stringify({ url }),
    });
}

export async function deleteRoleSource(roleId: string, sourceId: string): Promise<void> {
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

export async function listInterviewSessions(): Promise<InterviewSession[]> {
    return request('/api/interview/sessions');
}

export async function getInterviewSessionDetail(sessionId: number): Promise<InterviewSession> {
    return request(`/api/interview/sessions/${sessionId}/detail`);
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
        transcript: raw.transcript,
    };
}

export function createInterviewWS(sessionId: number): WebSocket {
    const wsBase = BASE_URL.replace(/^http/, 'ws');
    return new WebSocket(`${wsBase}/api/interview/sessions/${sessionId}/stream`);
}

// ─── Question Bank ────────────────────────────────────────────────────────────

export async function getSavedQuestions(
    roleId?: string,
    questionType?: string
): Promise<SavedQuestion[]> {
    const params = new URLSearchParams();
    if (roleId) params.set('role_id', roleId);
    if (questionType) params.set('question_type', questionType);
    const qs = params.toString();
    return request(`/api/interview/questions${qs ? `?${qs}` : ''}`);
}

export async function saveQuestion(
    data: Omit<SavedQuestion, 'id' | 'lastModified' | 'savedAt'>
): Promise<SavedQuestion> {
    return request('/api/interview/questions', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateSavedQuestion(
    id: string,
    data: { answer?: string; chatHistory?: any[]; transcription?: string }
): Promise<SavedQuestion> {
    return request(`/api/interview/questions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteSavedQuestion(id: string): Promise<void> {
    await request(`/api/interview/questions/${id}`, { method: 'DELETE' });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<{
    live_interviews: number;
    mock_questions: number;
    profile_completion: number;
    roles_count: number;
}> {
    return request('/api/dashboard/stats');
}
