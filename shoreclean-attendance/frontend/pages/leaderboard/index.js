import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import { NavSpacer } from '../../components/Navbar';
import { profileAPI } from '../../lib/api';

const tierFromPoints = (points) => {
  if (points >= 1200) return 'Gold';
  if (points >= 600) return 'Silver';
  return 'Bronze';
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('shoreclean_token');
    const user = JSON.parse(localStorage.getItem('shoreclean_user') || 'null');
    if (!token) {
      router.push('/login');
      return;
    }

    setCurrentUserId(String(user?.id || ''));

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await profileAPI.leaderboard();
        setRows(Array.isArray(res.data?.leaderboard) ? res.data.leaderboard : []);
        setMyRank(res.data?.my_rank || null);
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not load leaderboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const topThree = useMemo(() => rows.slice(0, 3), [rows]);

  return (
    <>
      <NavSpacer />
      <section className="page-header">
        <div className="container">
          <h1>Global Green Leaderboard</h1>
          <p>Ranking users by dynamic green points from time, waste impact, and cleanup participation.</p>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
              {topThree.map((row) => (
                <div
                  key={row.user_id}
                  className="card"
                  style={{
                    border: String(row.user_id) === currentUserId ? '2px solid var(--ocean-500)' : '1px solid var(--color-border)',
                  }}
                >
                  <div className="text-xs text-muted">Rank #{row.rank}</div>
                  <div className="font-display" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{row.name || 'Unknown'}</div>
                  <div className="text-sm text-muted">{row.role}</div>
                  <div style={{ marginTop: 'var(--sp-3)' }}>
                    <div className="font-display" style={{ fontSize: 30, fontWeight: 700 }}>{Number(row.green_points || 0).toLocaleString('en-IN')}</div>
                    <div className="text-xs text-muted">Green Points</div>
                  </div>
                  <div style={{ marginTop: 'var(--sp-3)' }} className="text-sm">
                    Tier: <strong>{tierFromPoints(Number(row.green_points || 0))}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
              <div className="font-bold" style={{ fontSize: 18, marginBottom: 'var(--sp-2)' }}>
                Your Position
              </div>
              <div className="text-sm text-muted" style={{ marginBottom: 'var(--sp-2)' }}>
                {myRank ? `You are currently ranked #${myRank}.` : 'No rank available yet.'}
              </div>
            </div>

            <div className="card">
              <div className="font-bold" style={{ fontSize: 18, marginBottom: 'var(--sp-3)' }}>
                Full Leaderboard
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table-clean" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Green Points</th>
                      <th>Total Hours</th>
                      <th>Waste (kg)</th>
                      <th>Completed Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isMe = String(row.user_id) === currentUserId;
                      return (
                        <tr
                          key={row.user_id}
                          style={{
                            background: isMe ? 'var(--ocean-100)' : 'transparent',
                            fontWeight: isMe ? 600 : 400,
                          }}
                        >
                          <td>#{row.rank}</td>
                          <td>{row.name || 'Unknown'}</td>
                          <td>{row.role}</td>
                          <td>{Number(row.green_points || 0).toLocaleString('en-IN')}</td>
                          <td>{Number(row.total_hours || 0).toFixed(1)}</td>
                          <td>{Number(row.total_waste_kg || 0).toFixed(1)}</td>
                          <td>{row.completed_events || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
