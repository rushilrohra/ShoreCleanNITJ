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
};

export const scanAPI = {
  scan: (qr_token, scan_type, event_id) =>
    api.post('/api/scan', { qr_token, scan_type, event_id }),
  getEventStatus: (event_id) => api.get(`/api/scan/event/${event_id}/status`),
};

export const announcementsAPI = {
  generatePoster: (event_id) => api.post('/api/announcements/generate-poster', { event_id }),
  sendEmail: (event_id) => api.post('/api/announcements/send-email', { event_id }),
};

export default api;
