const BASE = import.meta.env.VITE_API_URL ?? '/api';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('tracker_token');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }

    return res.json();
  } catch (error) {
    if ((error as any)?.name === 'AbortError') throw new Error('Request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const projectsApi = {
  list: () => apiFetch<any[]>('/projects'),
  get: (id: number) => apiFetch<any>(`/projects/${id}`),
  create: (data: any) => apiFetch<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/projects/${id}`, { method: 'DELETE' }),
};

export const tasksApi = {
  list: (projectId: number) => apiFetch<any[]>(`/projects/${projectId}/tasks`),
  create: (projectId: number, data: any) => apiFetch<any>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  update: (projectId: number, taskId: number, data: any) => apiFetch<any>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (projectId: number, taskId: number) => apiFetch<any>(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
  toggle: (projectId: number, taskId: number) => apiFetch<any>(`/projects/${projectId}/tasks/${taskId}/toggle`, { method: 'PATCH' }),
  reorder: (projectId: number, order: number[]) => apiFetch<any>(`/projects/${projectId}/tasks/reorder`, { method: 'PATCH', body: JSON.stringify({ order }) }),
};

export const authApi = {
  login: (username: string, password: string) => apiFetch<{ token: string; user: { id: number; username: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => apiFetch<{ id: number; username: string }>('/auth/me'),
};

export const aiApi = {
  generateTasks: (projectName: string, description: string) =>
    apiFetch<{ tasks: { subject: string; planStart: string; planEnd: string; pic: string }[] }>(
      '/ai/generate-tasks',
      {
        method: 'POST',
        body: JSON.stringify({ projectName, description }),
      }
    ),
};
