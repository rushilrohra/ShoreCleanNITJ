import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import { NavSpacer } from '../../components/Navbar';
import { profileAPI } from '../../lib/api';

const fmtDate = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtRole = (role) => {
  if (!role) return 'User';
  if (role === 'ngo' || role === 'organizer') return 'Organizer';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('shoreclean_token');
    if (!token) {
      router.push('/login');
      return;
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await profileAPI.me();
        setData(res.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not load profile data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const stats = data?.stats;
  const user = data?.user;
  const recentActivity = useMemo(() => data?.recent_activity || [], [data]);

  return (
    <>
      <NavSpacer />
      <section className="page-header">
        <div className="container">
          <h1>My Profile</h1>
          <p>Your personal details, activity, and dynamic green points.</p>
        </div>
      </section>

      <div className="container page-section">
        {loading ? (
          <div className="card text-center p-20">
            <span className="spinner spinner-lg" />
          </div>
        ) : error ? (
          <div className="card-flat bg-red-50 text-red-600 border-red-200">{error}</div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,2fr)',
                gap: 'var(--sp-6)',
                marginBottom: 'var(--sp-6)',
              }}
            >
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--ocean-500), var(--green-500))',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 24,
                    }}
                  >
                    {(user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>
                      {user?.name}
                    </div>
                    <div className="text-muted">{fmtRole(user?.role)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--sp-5)', display: 'grid', gap: 'var(--sp-2)' }}>
                  <div className="text-sm"><strong>Email:</strong> {user?.email || '-'}</div>
                  <div className="text-sm"><strong>Phone:</strong> {user?.phone || '-'}</div>
                  <div className="text-sm"><strong>Joined:</strong> {fmtDate(user?.created_at)}</div>
                </div>
              </div>

              <div className="card">
                <div className="font-bold" style={{ fontSize: 18, marginBottom: 'var(--sp-3)' }}>
                  🌱 Green Points
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
                    gap: 'var(--sp-3)',
                  }}
                >
                  <div className="card-flat">
                    <div className="text-xs text-muted">Total Points</div>
                    <div className="font-display" style={{ fontSize: 30, fontWeight: 700 }}>
                      {Number(stats?.green_points || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="card-flat">
                    <div className="text-xs text-muted">Global Rank</div>
                    <div className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                      #{Number(stats?.rank || 0)}
                    </div>
                  </div>
                  <div className="card-flat">
                    <div className="text-xs text-muted">Total Hours</div>
                    <div className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                      {Number(stats?.total_hours || 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="card-flat">
                    <div className="text-xs text-muted">Waste Collected (kg)</div>
                    <div className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                      {Number(stats?.total_waste_kg || 0).toFixed(1)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--sp-4)' }}>
                  <div className="text-sm font-bold" style={{ marginBottom: 'var(--sp-2)' }}>
                    Dynamic Formula Breakdown
                  </div>
                  <div className="text-sm text-muted" style={{ marginBottom: 'var(--sp-2)' }}>
                    Points are calculated from time worked, waste collected, completed events, consistency, and efficiency.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 'var(--sp-2)' }}>
                    <div className="card-flat">Time Points: <strong>{stats?.points_breakdown?.time_points || 0}</strong></div>
                    <div className="card-flat">Waste Points: <strong>{stats?.points_breakdown?.waste_points || 0}</strong></div>
                    <div className="card-flat">Event Points: <strong>{stats?.points_breakdown?.event_points || 0}</strong></div>
                    <div className="card-flat">Consistency Bonus: <strong>{stats?.points_breakdown?.consistency_bonus || 0}</strong></div>
                    <div className="card-flat">Efficiency Bonus: <strong>{stats?.points_breakdown?.efficiency_bonus || 0}</strong></div>
                    <div className="card-flat">Log Bonus: <strong>{stats?.points_breakdown?.log_bonus || 0}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
              <div className="font-bold" style={{ fontSize: 18, marginBottom: 'var(--sp-3)' }}>
                Impact Snapshot
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'var(--sp-3)' }}>
                <div className="card-flat">
                  <div className="text-xs text-muted">Completed Events</div>
                  <div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>{stats?.completed_events || 0}</div>
                </div>
                <div className="card-flat">
                  <div className="text-xs text-muted">Total Check-ins</div>
                  <div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>{stats?.checkins || 0}</div>
                </div>
                <div className="card-flat">
                  <div className="text-xs text-muted">Waste Logs</div>
                  <div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>{stats?.waste_entries || 0}</div>
                </div>
                <div className="card-flat">
                  <div className="text-xs text-muted">Current Tier</div>
                  <div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>
                    {Number(stats?.green_points || 0) >= 1200 ? 'Gold' : Number(stats?.green_points || 0) >= 600 ? 'Silver' : 'Bronze'}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="font-bold" style={{ fontSize: 18, marginBottom: 'var(--sp-3)' }}>
                Entry / Exit Activity
              </div>

              {recentActivity.length === 0 ? (
                <div className="text-sm text-muted">No activity found yet.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-clean" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Status</th>
                        <th>Entry Time</th>
                        <th>Exit Time</th>
                        <th>Duration (mins)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{row.event_title}</div>
                            <div className="text-xs text-muted">{row.location_name || '-'}</div>
                          </td>
                          <td>{row.status}</td>
                          <td>{fmtDate(row.entry_time)}</td>
                          <td>{fmtDate(row.exit_time)}</td>
                          <td>{row.duration_mins || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
