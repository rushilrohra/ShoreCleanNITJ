const API_BASE = process.env.REACT_APP_API_BASE || '/api';

const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
    register: async (email, password, firstName, lastName, role = 'volunteer') => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, firstName, lastName, role }),
        });
        return res.json();
    },

    login: async (email, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        return res.json();
    },
};

// ─── Events ───────────────────────────────────────────────────────────────────
export const eventsApi = {
    getAll: async () => {
        const res = await fetch(`${API_BASE}/events`);
        return res.json();
    },

    getById: async (eventId) => {
        const res = await fetch(`${API_BASE}/events/${eventId}`);
        return res.json();
    },

    create: async (eventData) => {
        const res = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(eventData),
        });
        return res.json();
    },

    getMyEvents: async () => {
        const res = await fetch(`${API_BASE}/events/my-events`, {
            headers: getAuthHeaders(),
        });
        return res.json();
    },
};

// ─── QR Attendance ────────────────────────────────────────────────────────────
export const qrApi = {
    checkIn: async (eventId, latitude, longitude) => {
        const res = await fetch(`${API_BASE}/qr/checkin`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ eventId, latitude, longitude }),
        });
        return res.json();
    },

    checkOut: async (eventId, latitude, longitude) => {
        const res = await fetch(`${API_BASE}/qr/checkout`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ eventId, latitude, longitude }),
        });
        return res.json();
    },
};

// ─── Organizer Scanner (registration-based flow) ────────────────────────────
export const scanApi = {
    scan: async (qr_token, scan_type, event_id) => {
        const res = await fetch(`${API_BASE}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_token, scan_type, event_id }),
        });
        return res.json();
    },

    eventStatus: async (eventId) => {
        const res = await fetch(`${API_BASE}/scan/event/${eventId}/status`);
        return res.json();
    },
};

// ─── Waste Photo Upload ────────────────────────────────────────────────────────
export const wasteApi = {
    uploadPhoto: async (eventId, photoFile) => {
        const formData = new FormData();
        formData.append('eventId', eventId);
        formData.append('photo', photoFile);
        const res = await fetch(`${API_BASE}/waste/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: formData,
        });
        return res.json();
    },
};

// ─── Certificates ─────────────────────────────────────────────────────────────
export const certificatesApi = {
    getMyCertificates: async () => {
        const res = await fetch(`${API_BASE}/certificates/my-certificates`, {
            headers: getAuthHeaders(),
        });
        return res.json();
    },

    generate: async (eventId) => {
        const res = await fetch(`${API_BASE}/certificates/generate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ eventId }),
        });
        return res.json();
    },

    verify: async (hash) => {
        const res = await fetch(`${API_BASE}/certificates/verify/${hash}`);
        return res.json();
    },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
    getVolunteerDashboard: async () => {
        const res = await fetch(`${API_BASE}/dashboard/volunteer`, {
            headers: getAuthHeaders(),
        });
        return res.json();
    },

    getLeaderboard: async () => {
        const res = await fetch(`${API_BASE}/dashboard/leaderboard`);
        return res.json();
    },
};

// ─── Admin / Poster / Announcements ──────────────────────────────────────────
export const adminApi = {
    getFraudFlags: async () => {
        const res = await fetch(`${API_BASE}/admin/fraud-flags`, {
            headers: getAuthHeaders(),
        });
        return res.json();
    },

    getEventStats: async (eventId) => {
        const res = await fetch(`${API_BASE}/admin/event-stats/${eventId}`, {
            headers: getAuthHeaders(),
        });
        return res.json();
    },

    generatePoster: async (eventId) => {
        const res = await fetch(`${API_BASE}/admin/generate-poster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId }),
        });
        return res.json();
    },

    sendAnnouncement: async (eventId) => {
        const res = await fetch(`${API_BASE}/admin/send-announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId }),
        });
        return res.json();
    },
};

// ─── Poster API (used by PosterGenerator component) ─────────────────────────
export const posterApi = {
    generate: async (eventId, template = 'master', heroImage = null) => {
        // Primary route used by this backend.
        let res = await fetch(`${API_BASE}/admin/generate-poster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, template, heroImage }),
        });

        // Fallback for alternate backend route variants.
        if (res.status === 404) {
            res = await fetch(`${API_BASE}/admin/poster/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, template, heroImage }),
            });
        }

        return res.json();
    },
};
