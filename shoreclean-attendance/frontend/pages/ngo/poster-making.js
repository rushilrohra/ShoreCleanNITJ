import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { NavSpacer } from '../../components/Navbar';
import { announcementsAPI, eventsAPI } from '../../lib/api';

export default function PosterMakingPage() {
  const router = useRouter();
  const { eventId } = router.query;
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const toast = (type, message) => {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  };

  useEffect(() => {
    if (!eventId) return;
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const res = await eventsAPI.getById(eventId);
      setEvent(res.data);
      if (res.data.poster_url) {
        setResult({
          poster_url: res.data.poster_url,
          captions: res.data.social_caption
        });
      }
    } catch (err) {
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenLoading(true);
    setError('');
    try {
      const res = await announcementsAPI.generatePoster(eventId);
      setResult({
        poster_url: res.data.poster_url,
        captions: res.data.captions
      });
      toast('success', 'AI assets generated successfully!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate assets';
      setError(msg);
      toast('error', msg);
    } finally {
      setGenLoading(false);
    }
  };

  const handleBroadcast = async () => {
    try {
      await announcementsAPI.sendEmail(eventId);
      toast('success', 'Announcements sent to all volunteers!');
    } catch (err) {
      toast('error', 'Failed to send broadcast');
    }
  };

  if (loading) return <div className="text-center p-20"><span className="spinner spinner-lg"></span></div>;

  return (
    <>
      <NavSpacer />
      <div className="container py-10">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="btn btn-ghost btn-sm">← Back</button>
          <h1 className="text-display" style={{ fontSize: 32 }}>AI Poster Generator</h1>
        </div>

        {!event ? (
          <div className="card text-center p-20">
            <h3>Event not found</h3>
            <p>Please go back to the dashboard and try again.</p>
          </div>
        ) : (
          <div className="grid-2 gap-8">
            <div className="card">
              <h3 className="mb-4">Event Details</h3>
              <div className="flex-col gap-2">
                <div className="text-sm"><strong>Title:</strong> {event.title}</div>
                <div className="text-sm"><strong>Beach:</strong> {event.beach_name}</div>
                <div className="text-sm"><strong>Date:</strong> {new Date(event.event_date).toLocaleDateString()}</div>
                <div className="text-sm"><strong>Location:</strong> {event.location}</div>
              </div>

              <div className="mt-8">
                <button 
                  className="btn btn-primary btn-full"
                  onClick={handleGenerate}
                  disabled={genLoading}
                >
                  {genLoading ? '🤖 Generating AI Assets...' : result ? '✨ Regenerate AI Assets' : '🤖 Generate AI Poster & Captions'}
                </button>
                <p className="text-xs text-muted mt-2 text-center">
                  This uses Stability AI for images and Google Gemini for social captions.
                </p>
              </div>

              {error && (
                <div className="card-flat mt-4 bg-red-50 text-red-600 border-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="mb-4">Generated Assets</h3>
              {!result ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div className="text-4xl mb-2">🎨</div>
                  <p className="text-muted">No assets generated yet.</p>
                </div>
              ) : (
                <div className="flex-col gap-6">
                  <div>
                    <div className="text-xs font-bold text-muted mb-2 uppercase tracking-wide">AI POSTER</div>
                    <img 
                      src={result.poster_url} 
                      alt="Generated Poster" 
                      className="w-full rounded-lg shadow-sm border"
                      style={{ maxHeight: 300, objectFit: 'cover' }}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-muted mb-3 uppercase tracking-wider">📢 AI Social Content</div>
                    <div className="grid-1 gap-4">
                      {(() => {
                        try {
                          const caps = typeof result.captions === 'string' ? JSON.parse(result.captions) : result.captions;
                          return Object.entries(caps).map(([platform, text]) => (
                            <div key={platform} className="card-flat" style={{ background: 'var(--gray-50)', padding: 'var(--sp-4)', borderRadius: 'var(--r-md)', border: '1px solid var(--gray-200)' }}>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--ocean-700)' }}>{platform}</span>
                                <button 
                                  className="btn btn-ghost btn-xs" 
                                  title={`Copy ${platform} caption`}
                                  onClick={() => {
                                    navigator.clipboard.writeText(text);
                                    toast('success', `${platform} caption copied!`);
                                  }}
                                >
                                  📋 Copy
                                </button>
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {text}
                              </div>
                            </div>
                          ));
                        } catch (e) {
                          return (
                            <div className="card-flat" style={{ background: 'var(--gray-50)' }}>
                              {typeof result.captions === 'string' ? result.captions : JSON.stringify(result.captions)}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  <button 
                    className="btn btn-sand btn-full"
                    onClick={handleBroadcast}
                  >
                    📢 Broadcast to Volunteers
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
