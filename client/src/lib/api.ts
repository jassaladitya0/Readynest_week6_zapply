import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Token helpers ----
export const getAccessToken = () => localStorage.getItem('zapply_access_token');
export const getRefreshToken = () => localStorage.getItem('zapply_refresh_token');
export const setTokens = (access: string, refresh: string) => {
  localStorage.setItem('zapply_access_token', access);
  localStorage.setItem('zapply_refresh_token', refresh);
};
export const clearTokens = () => {
  localStorage.removeItem('zapply_access_token');
  localStorage.removeItem('zapply_refresh_token');
};

// ---- Request interceptor: attach token ----
api.interceptors.request.use((config: any) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- Response interceptor: auto-refresh on 401 ----
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response: any) => response,
  async (error: any) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = data.accessToken;
        localStorage.setItem('zapply_access_token', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH API
// ============================================================
export const authAPI = {
  sendOTP: (phone: string, purpose: 'register' | 'login') =>
    api.post('/auth/send-otp', { phone, purpose }).then((r: any) => r.data),

  checkAvailability: (userId?: string, phone?: string) =>
    api.post('/auth/check-availability', { userId, phone }).then((r: any) => r.data),

  register: (payload: {
    phone: string; userId: string; displayName: string;
    password: string; otp: string; publicKey: string;
  }) => api.post('/auth/register', payload).then((r: any) => r.data),

  login: (identifier: string, password: string, otp?: string) =>
    api.post('/auth/login', { identifier, password, otp }).then((r: any) => r.data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r: any) => r.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r: any) => r.data),
};

// ============================================================
// USERS API
// ============================================================
export const usersAPI = {
  getMe: () => api.get('/users/me').then((r: any) => r.data.user),

  updateMe: (updates: { displayName?: string; bio?: string; avatar?: string; privacySettings?: object }) =>
    api.put('/users/me', updates).then((r: any) => r.data.user),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/me/change-password', { currentPassword, newPassword }).then((r: any) => r.data),

  search: (q: string) =>
    api.get('/users/search', { params: { q } }).then((r: any) => r.data.users),

  getUser: (userId: string) =>
    api.get(`/users/${userId}`).then((r: any) => r.data.user),

  report: (reportedUserId: string, reason: string, description?: string) =>
    api.post('/users/report', { reportedUserId, reason, description }).then((r: any) => r.data),
};

// ============================================================
// ADMIN API
// ============================================================
const adminApi = axios.create({ baseURL: API_URL, timeout: 15000 });
adminApi.interceptors.request.use((config: any) => {
  const token = sessionStorage.getItem('zapply_admin_token');
  if (token) config.headers['x-admin-token'] = token;
  return config;
});

export const adminAPI = {
  login: (username: string, password: string, secretKey: string) =>
    adminApi.post('/admin/login', { username, password, secretKey }).then((r: any) => r.data),

  getStats: () => adminApi.get('/admin/stats').then((r: any) => r.data),

  getUsers: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    adminApi.get('/admin/users', { params }).then((r: any) => r.data),

  getUser: (id: string) => adminApi.get(`/admin/users/${id}`).then((r: any) => r.data),

  warnUser: (id: string, reason: string) =>
    adminApi.post(`/admin/users/${id}/warn`, { reason }).then((r: any) => r.data),

  suspendUser: (id: string, reason: string, hours?: number) =>
    adminApi.post(`/admin/users/${id}/suspend`, { reason, hours }).then((r: any) => r.data),

  unsuspendUser: (id: string) =>
    adminApi.post(`/admin/users/${id}/unsuspend`).then((r: any) => r.data),

  deleteUser: (id: string, reason: string) =>
    adminApi.delete(`/admin/users/${id}`, { data: { reason } }).then((r: any) => r.data),

  getReports: (params?: { page?: number; limit?: number; status?: string }) =>
    adminApi.get('/admin/reports', { params }).then((r: any) => r.data),

  updateReport: (id: string, status: string, adminNotes?: string) =>
    adminApi.patch(`/admin/reports/${id}`, { status, adminNotes }).then((r: any) => r.data),

  getActions: () => adminApi.get('/admin/actions').then((r: any) => r.data),
};

export default api;
