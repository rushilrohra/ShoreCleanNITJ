import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { NavSpacer } from '../../components/Navbar';
import VolunteerScanner from '../../components/VolunteerScanner';
import { eventsAPI, scanAPI } from '../../lib/api';

const statusOrder = {
  ACTIVE: 0,
  DONE: 1,
  PENDING: 2,
  ABSENT: 3,
};

const formatDate = (d) =>
  (typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(`${d}T00:00:00`)).toLocaleDateString(
    'en-IN',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }
  );

const formatTime = (t) => {
  const [h = '0', m = '0'] = String(t || '').split(':');
  const date = new Date();
  date.setHours(+h, +m);
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDateTime = (dt) =>
  dt
    ? new Date(dt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default function VolunteerScannerPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [attendance, setAttendance] = useState({ data: null, loading: false });
  const [scanLog, setScanLog] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const newActiveRef = useRef(new Set());
  const prevActiveRef = useRef(new Set());

  const fetchEvents = async (role) => {
    try {
      if (role === 'admin') {
        const res = await eventsAPI.getAll();
        setEvents(res.data || []);
        return;
      }

      const mine = await eventsAPI.getMyEvents();
      const myRows = mine.data || [];
      if (Array.isArray(myRows) && myRows.length > 0) {
        setEvents(myRows);
        return;
      }

      // Fallback for shared operations: if organizer has no owned events,
      // still allow scanning from the global event list.
      const all = await eventsAPI.getAll();
      setEvents(all.data || []);
    } catch {
      setEvents([]);
    }
  };

  const fetchAttendance = async () => {
    if (!selectedEventId) return;

    setAttendance((a) => ({ ...a, loading: !a.data }));

    try {
      const res = await scanAPI.getEventStatus(selectedEventId);
      const raw = res.data;
      const payload = Array.isArray(raw)
        ? {
            summary: {
              total: raw.length,
              pending: raw.filter((r) => r.status === 'PENDING').length,
              active: raw.filter((r) => r.status === 'ACTIVE').length,
              done: raw.filter((r) => r.status === 'DONE').length,
              absent: raw.filter((r) => r.status === 'ABSENT').length,
            },
            registrations: raw.map((r) => ({
              ...r,
              volunteer_name: r.volunteer_name || r.name || 'Unknown',
            })),
          }
        : raw || { summary: {}, registrations: [] };
      const rows = payload.registrations || [];

      const nextActive = new Set(
        rows.filter((r) => r.status === 'ACTIVE').map((r) => String(r.id))
      );
      const becameActive = new Set();
      nextActive.forEach((id) => {
        if (!prevActiveRef.current.has(id)) {
          becameActive.add(id);
        }
      });

      newActiveRef.current = becameActive;
      prevActiveRef.current = nextActive;

      setAttendance({ data: payload, loading: false });
      setLastRefreshed(Date.now());
      setSecondsAgo(0);
    } catch {
      setAttendance((a) => ({ ...a, loading: false }));
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
      router.push('/');
      return;
    }

    setCurrentUser(user);
    fetchEvents(user?.role);

    const { event: eventParam } = router.query;
    if (eventParam) {
      setSelectedEventId(String(eventParam));
    }
  }, [router, router.query]);

  useEffect(() => {
    if (!selectedEventId) return;
    fetchAttendance();
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;
    const interval = setInterval(fetchAttendance, 10000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  useEffect(() => {
    if (!lastRefreshed) return;
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshed) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastRefreshed]);

  const selectedEvent = useMemo(
    () => events.find((e) => String(e.id) === String(selectedEventId)),
    [events, selectedEventId]
  );

  const sortedRows = useMemo(() => {
    const rows = attendance?.data?.registrations || [];
    return [...rows].sort((a, b) => {
      const aRank = statusOrder[a.status] ?? 99;
      const bRank = statusOrder[b.status] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      return String(a.volunteer_name || '').localeCompare(String(b.volunteer_name || ''));
    });
  }, [attendance]);

  const statusBadgeClass = (status) => {
    if (status === 'ACTIVE') return 'badge badge-active';
    if (status === 'DONE') return 'badge badge-green';
    if (status === 'PENDING') return 'badge badge-blue';
    return 'badge badge-red';
  };

  return (
    <>
      <NavSpacer />

      <section className="page-header">
        <div className="container">
          <h1>Event Scanner</h1>
          <p>Check-in and check-out volunteers on event day</p>
        </div>
      </section>

      <div className="container page-section">
        <div
          className="scanner-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)',
            gap: 'var(--sp-6)',
          }}
        >
          <div>
            <div className="card">
              <label className="form-label">Select Event</label>
              <select
                className="form-input"
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setAttendance({ data: null, loading: false });
                  prevActiveRef.current = new Set();
                  newActiveRef.current = new Set();
                }}
              >
                <option value="">— Select an event —</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {formatDate(e.event_date)}
                  </option>
                ))}
              </select>

              {selectedEventId && selectedEvent ? (
                <div
                  style={{
                    marginTop: 'var(--sp-4)',
                    padding: 'var(--sp-4)',
                    background: 'var(--ocean-100)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div className="font-bold">{selectedEvent.title}</div>
                  <div className="text-sm text-muted">🏖️ {selectedEvent.beach_name}</div>
                  <div className="text-sm text-muted">
                    🕘 {formatTime(selectedEvent.start_time)} – {formatTime(selectedEvent.end_time)}
                  </div>
                  <div
                    className="text-sm"
                    style={{
                      marginTop: 'var(--sp-2)',
                      color: 'var(--ocean-700)',
                      fontWeight: 600,
                    }}
                  >
                    {selectedEvent.registered_count || 0} volunteers registered
                  </div>
                </div>
              ) : (
                <p className="text-muted" style={{ marginTop: 'var(--sp-4)' }}>
                  Select an event above to begin scanning
                </p>
              )}
            </div>

            {selectedEventId && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <VolunteerScanner
                  key={selectedEventId}
                  eventId={selectedEventId}
                  onScanResult={(result) => {
                    setScanLog((prev) => [{ ...result, timestamp: new Date() }, ...prev].slice(0, 20));
                    if (result.success) {
                      if (result.event_id && String(result.event_id) !== String(selectedEventId)) {
                        setSelectedEventId(String(result.event_id));
                      } else {
                        fetchAttendance();
                      }
                    }
                  }}
                />
              </div>
            )}

            <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--sp-3)',
                }}
              >
                <div className="font-bold" style={{ fontSize: 15 }}>
                  Recent Scans
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setScanLog([])}>
                  Clear
                </button>
              </div>

              {scanLog.length === 0 ? (
                <p className="text-sm text-muted">No scans yet this session.</p>
              ) : (
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {scanLog.map((entry, idx) => (
                    <div
                      key={`${entry.timestamp?.getTime?.() || Date.now()}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--sp-2)',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          marginTop: 6,
                          background: entry.success ? 'var(--green-500)' : 'var(--coral-500)',
                          flex: '0 0 8px',
                        }}
                      />
                      <div>
                        <div className="text-sm font-bold">
                          {entry.volunteer_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted">{entry.message}</div>
                      </div>
                      <div className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                        {entry.timestamp.toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--sp-4)',
                }}
              >
                <div className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>
                  Live Attendance
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <span className="text-xs text-muted">Updated {secondsAgo}s ago</span>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    type="button"
                    onClick={fetchAttendance}
                    title="Refresh"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {!selectedEventId ? (
                <div className="empty-state card-flat" style={{ padding: 'var(--sp-8)' }}>
                  <div className="empty-icon">📋</div>
                  <h3>Select an event to view attendance</h3>
                </div>
              ) : attendance.loading ? (
                <div className="text-center" style={{ padding: 'var(--sp-12) 0' }}>
                  <span className="spinner spinner-lg" />
                </div>
              ) : attendance.data ? (
                <>
                  <div className="grid-4 stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{attendance.data.summary?.total || 0}</div>
                      <div className="stat-label">Total</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{attendance.data.summary?.active || 0}</div>
                      <div className="stat-label">🟢 Active</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{attendance.data.summary?.done || 0}</div>
                      <div className="stat-label">✅ Done</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{attendance.data.summary?.pending || 0}</div>
                      <div className="stat-label">⏳ Pending</div>
                    </div>
                  </div>

                  <div className="table-wrapper" style={{ marginTop: 'var(--sp-4)' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Volunteer</th>
                          <th>Status</th>
                          <th>Entry</th>
                          <th>Exit</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRows.length === 0 ? (
                          <tr>
                            <td colSpan="5">No registrations found for this event.</td>
                          </tr>
                        ) : (
                          sortedRows.map((r) => (
                            <tr
                              key={r.id}
                              className={newActiveRef.current.has(String(r.id)) ? 'row-new' : ''}
                            >
                              <td>{r.volunteer_name || 'Unknown'}</td>
                              <td>
                                <span className={statusBadgeClass(r.status)}>{r.status}</span>
                              </td>
                              <td>{formatDateTime(r.entry_time)}</td>
                              <td>{formatDateTime(r.exit_time)}</td>
                              <td>{r.duration_mins ? `${r.duration_mins} min` : '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="empty-state card-flat" style={{ padding: 'var(--sp-8)' }}>
                  <div className="empty-icon">📋</div>
                  <h3>No attendance data yet</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .scanner-grid {
          grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
        }

        @media (max-width: 768px) {
          .scanner-grid {
            grid-template-columns: 1fr !important;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @keyframes row-highlight {
          from {
            background: var(--green-100);
          }
          to {
            background: transparent;
          }
        }

        .row-new {
          animation: row-highlight 2s ease forwards;
        }
      `}</style>
    </>
  );
}
