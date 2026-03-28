import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import { NavSpacer } from '../../components/Navbar';
import { eventsAPI } from '../../lib/api';

const initialCreateForm = {
  title: '',
  description: '',
  beach_name: '',
  location: '',
  event_date: '',
  start_time: '',
  end_time: '',
  max_volunteers: 100,
};

function formatEventDate(dateValue) {
  if (!dateValue) return '—';
  const dt =
    typeof dateValue === 'string' && dateValue.includes('T')
      ? new Date(dateValue)
      : new Date(`${dateValue}T00:00:00`);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatClock(timeValue) {
  if (!timeValue) return '—';
  const [h = '0', m = '0'] = String(timeValue).split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtTime(dt) {
  return dt
    ? new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';
}

export default function NGODashboardPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(null);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');
  const [registrationsModal, setRegistrationsModal] = useState({
    open: false,
    eventId: null,
    data: null,
    loading: false,
  });
  const [editModal, setEditModal] = useState({ open: false, event: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, event: null });
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [regSearch, setRegSearch] = useState('');

  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [editForm, setEditForm] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const toast = (type, message) => {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  };

  const fetchMyEvents = async (actor = currentUser) => {
    try {
      setLoading(true);
      const res = actor?.role === 'admin' ? await eventsAPI.getAll() : await eventsAPI.getMyEvents();
      setMyEvents(res.data || []);
    } catch (error) {
      toast('error', error?.response?.data?.error || 'Failed to fetch your events');
      setMyEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('shoreclean_token');
    const user = JSON.parse(localStorage.getItem('shoreclean_user') || 'null');
    if (!token) {
      router.push('/login');
      return;
    }
    if (user?.role === 'volunteer') {
      router.push('/dashboard');
      return;
    }
    setCurrentUser(user);
    fetchMyEvents(user);
  }, [router]);

  const openRegistrationsModal = async (eventId) => {
    const event = myEvents.find((e) => e.id === eventId);
    setRegistrationsModal({
      open: true,
      eventId,
      data: event ? { eventTitle: event.title, summary: null, registrations: [] } : null,
      loading: true,
    });
    setRegSearch('');

    try {
      const res = await eventsAPI.getRegistrations(eventId);
      setRegistrationsModal((m) => ({
        ...m,
        loading: false,
        data: {
          eventTitle: event?.title || 'Event',
          summary: res.data.summary,
          registrations: res.data.registrations,
        },
      }));
    } catch (error) {
      setRegistrationsModal((m) => ({ ...m, loading: false }));
      toast('error', error?.response?.data?.error || 'Failed to fetch registrations');
    }
  };

  const closeRegistrationsModal = () => {
    setRegistrationsModal({ open: false, eventId: null, data: null, loading: false });
    setRegSearch('');
  };

  const filteredRegistrations = useMemo(() => {
    const rows = registrationsModal?.data?.registrations || [];
    const q = regSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.volunteer_name || '').toLowerCase().includes(q) ||
        String(r.volunteer_email || '').toLowerCase().includes(q)
    );
  }, [registrationsModal, regSearch]);

  const handleExportCSV = async () => {
    if (!registrationsModal.eventId) return;
    try {
      const res = await eventsAPI.exportCSV(registrationsModal.eventId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${registrationsModal.eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast('error', error?.response?.data?.error || 'Failed to export CSV');
    }
  };

  const handleRegStatusUpdate = async (row, status) => {
    try {
      await eventsAPI.updateRegistrationStatus(registrationsModal.eventId, row.id, status);
      setRegistrationsModal((m) => ({
        ...m,
        data: {
          ...m.data,
          registrations: m.data.registrations.map((r) =>
            r.id === row.id ? { ...r, status } : r
          ),
        },
      }));
      toast('success', `${row.volunteer_name} marked as ${status}`);
    } catch (error) {
      toast('error', error?.response?.data?.error || 'Failed to update status');
    }
  };

  const openEditModal = (event) => {
    setEditModal({ open: true, event });
    setEditForm({
      title: event.title || '',
      description: event.description || '',
      beach_name: event.beach_name || '',
      location: event.location || '',
      event_date: event.event_date || '',
      start_time: String(event.start_time || '').slice(0, 5),
      end_time: String(event.end_time || '').slice(0, 5),
      max_volunteers: event.max_volunteers ?? 100,
      status: event.status || 'active',
    });
    setEditError('');
  };

  const closeEditModal = () => {
    setEditModal({ open: false, event: null });
    setEditForm(null);
    setEditError('');
    setEditLoading(false);
  };

  const submitEdit = async () => {
    if (!editModal.event || !editForm) return;

    setEditLoading(true);
    setEditError('');
    try {
      await eventsAPI.update(editModal.event.id, {
        title: editForm.title,
        description: editForm.description,
        beach_name: editForm.beach_name,
        location: editForm.location,
        event_date: editForm.event_date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        max_volunteers: Number(editForm.max_volunteers || 0),
        status: editForm.status,
      });
      closeEditModal();
      await fetchMyEvents();
      toast('success', 'Event updated.');
    } catch (error) {
      setEditError(error?.response?.data?.error || 'Failed to update event');
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDelete = async () => {
    const ev = deleteModal.event;
    if (!ev) return;

    try {
      await eventsAPI.remove(ev.id);
      setMyEvents((prev) => prev.filter((e) => e.id !== ev.id));
      setDeleteModal({ open: false, event: null });
      toast('success', 'Event deleted.');
    } catch (error) {
      if (error?.response?.status === 400) {
        toast('error', error?.response?.data?.error || 'Cannot delete event');
      } else {
        toast('error', 'Failed to delete event');
      }
      setDeleteModal({ open: false, event: null });
    }
  };

  const handleCreateChange = (key, value) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
    setCreateFieldErrors((prev) => ({ ...prev, [key]: '' }));
    setCreateError('');
    setCreateSuccess('');
  };

  const validateCreate = () => {
    const nextErrors = {};

    if (!createForm.title.trim()) nextErrors.title = 'Title is required.';
    if (!createForm.beach_name.trim()) nextErrors.beach_name = 'Beach name is required.';
    if (!createForm.location.trim()) nextErrors.location = 'Location is required.';
    if (!createForm.event_date) nextErrors.event_date = 'Event date is required.';
    if (!createForm.start_time) nextErrors.start_time = 'Start time is required.';
    if (!createForm.end_time) nextErrors.end_time = 'End time is required.';

    if (createForm.start_time && createForm.end_time && createForm.end_time <= createForm.start_time) {
      nextErrors.end_time = 'End time must be after start time.';
    }

    setCreateFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitCreate = async () => {
    if (!validateCreate()) return;

    setCreateLoading(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      await eventsAPI.create({
        title: createForm.title,
        beach_name: createForm.beach_name,
        location: createForm.location,
        description: createForm.description,
        event_date: createForm.event_date,
        start_time: createForm.start_time,
        end_time: createForm.end_time,
        max_volunteers: Number(createForm.max_volunteers || 100),
      });

      setCreateForm(initialCreateForm);
      setActiveTab('events');
      await fetchMyEvents();
      setCreateSuccess('Event created! Volunteers can now register.');
      toast('success', 'Event created! Volunteers can now register.');
    } catch (error) {
      setCreateError(error?.response?.data?.error || 'Something went wrong');
    } finally {
      setCreateLoading(false);
    }
  };

  const analytics = useMemo(() => {
    const totalEvents = myEvents.length;
    const totalVolunteers = myEvents.reduce((s, e) => s + Number(e.registered_count || 0), 0);
    const completions = myEvents.reduce((s, e) => s + Number(e.done_count || 0), 0);
    const capacityTotal = myEvents.reduce((s, e) => s + Number(e.max_volunteers || 0), 0);
    const avgTurnout =
      totalEvents > 0 ? Math.round((totalVolunteers / (capacityTotal || 1)) * 100) : 0;

    return { totalEvents, totalVolunteers, completions, avgTurnout };
  }, [myEvents]);

  const sortedEventsByTurnout = useMemo(() => {
    return [...myEvents].sort(
      (a, b) => Number(b.registered_count || 0) - Number(a.registered_count || 0)
    );
  }, [myEvents]);

  return (
    <>
      <NavSpacer />

      <section className="page-header">
        <div className="container">
          <h1>NGO Dashboard</h1>
          <p>Manage your beach cleanup events</p>
        </div>
      </section>

      <div className="container page-section">
        <div className="tab-bar" style={{ marginBottom: 'var(--sp-6)' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            📋 My Events
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            ➕ Create Event
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>
        </div>

        {activeTab === 'events' && (
          <section>
            {loading && (
              <div className="text-center" style={{ padding: 'var(--sp-16) 0' }}>
                <span className="spinner spinner-lg" />
              </div>
            )}

            {!loading && myEvents.length === 0 && (
              <div className="empty-state card-flat">
                <div className="empty-icon">🏖️</div>
                <h3>No events yet</h3>
                <p>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setActiveTab('create')}
                  >
                    Create your first event →
                  </button>
                </p>
              </div>
            )}

            {!loading &&
              myEvents.map((event) => {
                const registered = Number(event.registered_count || 0);
                const capacity = Number(event.max_volunteers || 1);
                const pct = registered / (capacity || 1);

                let accent = 'var(--ocean-500)';
                if (event.status === 'cancelled') accent = 'var(--gray-300)';
                else if (pct >= 0.8) accent = 'var(--coral-500)';
                else if (pct >= 0.5) accent = 'var(--sand-500)';

                const statusClass =
                  event.status === 'active'
                    ? 'badge badge-green'
                    : event.status === 'cancelled'
                    ? 'badge badge-red'
                    : 'badge badge-gray';

                return (
                  <div className="card card-hover" style={{ overflow: 'hidden', marginBottom: 'var(--sp-4)' }} key={event.id}>
                    <div style={{ height: 6, background: accent, margin: '-24px -24px var(--sp-4)' }} />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-sand">🏖️ {event.beach_name}</span>
                        <span className={statusClass}>{event.status}</span>
                      </div>
                      <span className="text-sm text-muted">{formatEventDate(event.event_date)}</span>
                    </div>

                    <h3 className="text-display" style={{ fontSize: 20, marginTop: 'var(--sp-2)' }}>
                      {event.title}
                    </h3>

                    <p className="text-sm text-muted" style={{ marginTop: 'var(--sp-2)' }}>
                      📍 {event.location}  ·  🕘 {formatClock(event.start_time)} – {formatClock(event.end_time)}
                    </p>

                    <div className="flex gap-4" style={{ marginTop: 'var(--sp-3)', flexWrap: 'wrap' }}>
                      <div style={{ background: 'var(--gray-100)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}>
                        👥 {event.registered_count || 0} Registered
                      </div>
                      <div style={{ background: 'var(--gray-100)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}>
                        ✅ {event.done_count || 0} Done
                      </div>
                      <div style={{ background: 'var(--gray-100)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}>
                        🟢 {event.active_count || 0} Active
                      </div>
                      <div style={{ background: 'var(--gray-100)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}>
                        ⏳ {event.pending_count || 0} Pending
                      </div>
                    </div>

                    <div className="progress-bar" style={{ marginTop: 'var(--sp-2)' }}>
                      <div
                        className={`progress-fill ${pct < 0.5 ? 'low' : pct < 0.8 ? 'medium' : 'high'}`}
                        style={{ width: `${Math.min(pct * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted">
                      {event.registered_count || 0}/{event.max_volunteers || 0} spots filled
                    </span>

                    <div className="flex gap-2" style={{ marginTop: 'var(--sp-4)', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => openRegistrationsModal(event.id)}>
                        👁 View Registrations
                      </button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openEditModal(event)}>
                        ✏️ Edit Event
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => router.push(`/volunteer/scanner?event=${event.id}`)}
                      >
                        📷 Scanner
                      </button>
                      <button className="btn btn-danger btn-sm" type="button" onClick={() => setDeleteModal({ open: true, event })}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                );
              })}
          </section>
        )}

        {activeTab === 'create' && (
          <section className="container-sm">
            <div className="card">
              <div className="flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Title*</label>
                  <input className="form-input" value={createForm.title} onChange={(e) => handleCreateChange('title', e.target.value)} />
                  {createFieldErrors.title && <span className="form-error">{createFieldErrors.title}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Beach Name*</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Juhu Beach, Versova Beach"
                    value={createForm.beach_name}
                    onChange={(e) => handleCreateChange('beach_name', e.target.value)}
                  />
                  {createFieldErrors.beach_name && <span className="form-error">{createFieldErrors.beach_name}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Location*</label>
                  <input
                    className="form-input"
                    placeholder="Full address for volunteers to navigate to"
                    value={createForm.location}
                    onChange={(e) => handleCreateChange('location', e.target.value)}
                  />
                  {createFieldErrors.location && <span className="form-error">{createFieldErrors.location}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" value={createForm.description} onChange={(e) => handleCreateChange('description', e.target.value)} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Event Date*</label>
                    <input
                      type="date"
                      className="form-input"
                      min={new Date().toISOString().split('T')[0]}
                      value={createForm.event_date}
                      onChange={(e) => handleCreateChange('event_date', e.target.value)}
                    />
                    {createFieldErrors.event_date && <span className="form-error">{createFieldErrors.event_date}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Max Volunteers</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={createForm.max_volunteers}
                      onChange={(e) => handleCreateChange('max_volunteers', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Time*</label>
                    <input
                      type="time"
                      className="form-input"
                      value={createForm.start_time}
                      onChange={(e) => handleCreateChange('start_time', e.target.value)}
                    />
                    {createFieldErrors.start_time && <span className="form-error">{createFieldErrors.start_time}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Time*</label>
                    <input
                      type="time"
                      className="form-input"
                      value={createForm.end_time}
                      onChange={(e) => handleCreateChange('end_time', e.target.value)}
                    />
                    {createFieldErrors.end_time && <span className="form-error">{createFieldErrors.end_time}</span>}
                  </div>
                </div>

                <button type="button" className="btn btn-primary btn-full btn-lg" onClick={submitCreate} disabled={createLoading}>
                  {createLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="spinner" />
                      Creating…
                    </span>
                  ) : (
                    'Create Event'
                  )}
                </button>

                {createError && <div className="alert alert-error">{createError}</div>}
                {createSuccess && <div className="alert alert-success">{createSuccess}</div>}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'analytics' && (
          <section>
            <div className="grid-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="stat-card">
                <div className="stat-value">{analytics.totalEvents}</div>
                <div className="stat-label">Total Events</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{analytics.totalVolunteers}</div>
                <div className="stat-label">Total Volunteers</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{analytics.completions}</div>
                <div className="stat-label">Completions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{analytics.avgTurnout}%</div>
                <div className="stat-label">Avg. Turnout</div>
              </div>
            </div>

            <h2 className="text-display" style={{ fontSize: 22, marginTop: 'var(--sp-8)' }}>
              Top Events by Turnout
            </h2>

            <div className="table-wrapper" style={{ marginTop: 'var(--sp-3)' }}>
              <table>
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Date</th>
                    <th>Registered</th>
                    <th>Done</th>
                    <th>Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEventsByTurnout.length === 0 && (
                    <tr>
                      <td colSpan="5">No events yet.</td>
                    </tr>
                  )}
                  {sortedEventsByTurnout.map((e) => (
                    <tr key={e.id}>
                      <td>{e.title}</td>
                      <td>{formatEventDate(e.event_date)}</td>
                      <td>{e.registered_count || 0}</td>
                      <td>{e.done_count || 0}</td>
                      <td>{e.max_volunteers || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {registrationsModal.open && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div className="modal-title">
                Registrations — {registrationsModal.data?.eventTitle || 'Event'}
              </div>
              <button className="modal-close" type="button" onClick={closeRegistrationsModal}>✕</button>
            </div>

            {registrationsModal.loading ? (
              <div className="text-center" style={{ padding: 'var(--sp-8)' }}>
                <span className="spinner spinner-lg" />
              </div>
            ) : (
              <>
                {registrationsModal.data?.summary && (
                  <div className="card-flat grid-4" style={{ marginBottom: 'var(--sp-4)' }}>
                    <div className="stat-card">
                      <div className="stat-value">{registrationsModal.data.summary.total}</div>
                      <div className="stat-label">Total</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{registrationsModal.data.summary.pending}</div>
                      <div className="stat-label">Pending</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{registrationsModal.data.summary.active}</div>
                      <div className="stat-label">Active</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        {(registrationsModal.data.summary.done || 0) + (registrationsModal.data.summary.absent || 0)}
                      </div>
                      <div className="stat-label">Done + Absent</div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--sp-3)' }}>
                  <div className="form-group" style={{ flex: 1, maxWidth: 420 }}>
                    <input
                      className="form-input"
                      placeholder="Search by name or email…"
                      value={regSearch}
                      onChange={(e) => setRegSearch(e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                    Export CSV
                  </button>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Entry Time</th>
                        <th>Exit Time</th>
                        <th>Duration</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegistrations.length === 0 && (
                        <tr>
                          <td colSpan="8">No registrations found.</td>
                        </tr>
                      )}

                      {filteredRegistrations.map((row) => {
                        const badgeClass =
                          row.status === 'PENDING'
                            ? 'badge badge-blue'
                            : row.status === 'ACTIVE'
                            ? 'badge badge-active'
                            : row.status === 'DONE'
                            ? 'badge badge-green'
                            : 'badge badge-red';

                        return (
                          <tr key={row.id}>
                            <td>{row.volunteer_name}</td>
                            <td>{row.volunteer_email}</td>
                            <td>{row.volunteer_phone || '—'}</td>
                            <td><span className={badgeClass}>{row.status}</span></td>
                            <td>{fmtTime(row.entry_time)}</td>
                            <td>{fmtTime(row.exit_time)}</td>
                            <td>{row.duration_mins ? `${row.duration_mins} min` : '—'}</td>
                            <td>
                              <select
                                value={row.status}
                                onChange={(e) => handleRegStatusUpdate(row, e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--r-sm)',
                                  border: '1px solid var(--color-border)',
                                  fontSize: 13,
                                }}
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="DONE">DONE</option>
                                <option value="ABSENT">ABSENT</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {editModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Edit Event</div>
              <button className="modal-close" type="button" onClick={closeEditModal}>✕</button>
            </div>

            {editForm && (
              <div className="flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Beach Name</label>
                    <input className="form-input" value={editForm.beach_name} onChange={(e) => setEditForm((f) => ({ ...f, beach_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input className="form-input" value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Event Date</label>
                    <input type="date" className="form-input" value={editForm.event_date} onChange={(e) => setEditForm((f) => ({ ...f, event_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Volunteers</label>
                    <input type="number" className="form-input" value={editForm.max_volunteers} onChange={(e) => setEditForm((f) => ({ ...f, max_volunteers: e.target.value }))} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input type="time" className="form-input" value={editForm.start_time} onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input type="time" className="form-input" value={editForm.end_time} onChange={(e) => setEditForm((f) => ({ ...f, end_time: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="cancelled">cancelled</option>
                    <option value="completed">completed</option>
                  </select>
                </div>

                {editError && <div className="alert alert-error">{editError}</div>}

                <div className="flex justify-between">
                  <button className="btn btn-ghost" type="button" onClick={closeEditModal}>Cancel</button>
                  <button className="btn btn-primary" type="button" disabled={editLoading} onClick={submitEdit}>
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteModal.open && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">Delete Event?</div>
              <button className="modal-close" type="button" onClick={() => setDeleteModal({ open: false, event: null })}>✕</button>
            </div>

            <p>
              Are you sure you want to delete '{deleteModal.event?.title}'? All registrations will be
              removed. This cannot be undone.
            </p>

            <div className="flex justify-between" style={{ marginTop: 'var(--sp-6)' }}>
              <button className="btn btn-ghost" type="button" onClick={() => setDeleteModal({ open: false, event: null })}>
                Cancel
              </button>
              <button className="btn btn-danger" type="button" onClick={confirmDelete}>
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
