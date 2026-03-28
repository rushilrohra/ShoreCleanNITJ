import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('shoreclean_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && typeof window !== 'undefined') {
      localStorage.clear();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
};

export const eventsAPI = {
  getAll: () => api.get('/api/events'),
  getById: (id) => api.get(`/api/events/${id}`),
  create: (data) => api.post('/api/events', data),
  generateDescription: (data) => api.post('/api/events/generate-description', data),
  getMyEvents: () => api.get('/api/events/my'),
  update: (id, data) => api.put(`/api/events/${id}`, data),
  remove: (id) => api.delete(`/api/events/${id}`),
  getRegistrations: (id) => api.get(`/api/events/${id}/registrations`),
  updateRegistrationStatus: (eId, rId, status) =>
    api.patch(`/api/events/${eId}/registrations/${rId}/status`, { status }),
  exportCSV: (id) =>
    api.get(`/api/events/${id}/registrations/export`, { responseType: 'blob' }),
};

export const registrationsAPI = {
  register: (event_id) => api.post('/api/registrations', { event_id }),
  getMy: () => api.get('/api/registrations/my'),
  getPassData: (registrationId) => api.get(`/api/registrations/${registrationId}/pass`),
  cancel: (id) => api.post(`/api/registrations/${id}/cancel`),
};

export const scanAPI = {
  verify: (qr_token) => api.post('/api/scan/verify', { qr_token }),
  reject: (reg_id) => api.post('/api/scan/reject', { reg_id }),
  scan: (qr_token, scan_type, event_id) =>
    api.post('/api/scan', { qr_token, scan_type, event_id }),
  getEventStatus: (event_id) => api.get(`/api/scan/event/${event_id}/status`),
};

export const announcementsAPI = {
  generatePoster: async (event_id) => {
    try {
      return await api.post('/api/announcements/generate-poster', { event_id });
    } catch (error) {
      // Local resilience: backend may auto-shift ports when one is occupied.
      const primaryBase = String(api.defaults.baseURL || '').replace(/\/$/, '');
      const fallbackOrigins = [
        'http://localhost:5000',
        'http://localhost:5001',
        'http://localhost:5002',
        'http://localhost:5003',
        'http://localhost:5004',
      ].filter((origin, index, arr) => origin !== primaryBase && arr.indexOf(origin) === index);
      const fallbackPaths = ['/api/announcements/generate-poster', '/api/admin/generate-poster'];
      const token = typeof window !== 'undefined' ? localStorage.getItem('shoreclean_token') : null;
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      if (error?.response?.status === 404 || error?.code === 'ERR_NETWORK' || error?.response?.status === 500) {
        for (const origin of fallbackOrigins) {
          const client = axios.create({ baseURL: origin });
          for (const path of fallbackPaths) {
            try {
              return await client.post(path, { event_id }, { headers: authHeaders, timeout: 10000 });
            } catch (fallbackError) {
              const status = fallbackError?.response?.status;
              if (status && status !== 404 && status !== 500) {
                throw fallbackError;
              }
            }
          }
        }

        throw new Error(
          'Poster API route not found on available local backends. Ensure ShoreClean backend is running and exposes /api/announcements/generate-poster.'
        );
      }
      throw error;
    }
  },
  sendEmail: async (event_id) => {
    try {
      return await api.post('/api/announcements/send-email', { event_id });
    } catch (error) {
      const primaryBase = String(api.defaults.baseURL || '').replace(/\/$/, '');
      const fallbackOrigins = [
        'http://localhost:5000',
        'http://localhost:5001',
        'http://localhost:5002',
        'http://localhost:5003',
        'http://localhost:5004',
      ].filter((origin, index, arr) => origin !== primaryBase && arr.indexOf(origin) === index);
      const fallbackPaths = ['/api/announcements/send-email', '/api/admin/send-announcement'];
      const token = typeof window !== 'undefined' ? localStorage.getItem('shoreclean_token') : null;
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      if (error?.response?.status === 404 || error?.code === 'ERR_NETWORK' || error?.response?.status === 500) {
        for (const origin of fallbackOrigins) {
          const client = axios.create({ baseURL: origin });
          for (const path of fallbackPaths) {
            try {
              return await client.post(path, { event_id }, { headers: authHeaders, timeout: 10000 });
            } catch (fallbackError) {
              const status = fallbackError?.response?.status;
              if (status && status !== 404 && status !== 500) {
                throw fallbackError;
              }
            }
          }
        }

        throw new Error(
          'Announcement email API route not found on available local backends. Ensure ShoreClean backend is running and exposes /api/announcements/send-email.'
        );
      }

      throw error;
    }
  },
};

export default api;
