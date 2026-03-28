import { useEffect, useMemo, useState } from 'react';
import { NavSpacer } from '../../components/Navbar';
import EventCard from '../../components/EventCard';
import { eventsAPI } from '../../lib/api';

const LOCATION_FILTERS = ['All', 'This Weekend', 'This Month', 'Mumbai', 'Goa', 'Chennai', 'Pune'];

const parseEventDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && value.includes('T')) return new Date(value);
  return new Date(`${value}T00:00:00`);
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    let active = true;
    const fetchEvents = async () => {
      try {
        const res = await eventsAPI.getAll();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const upcoming = (res.data || []).filter((e) => {
          const dt = parseEventDate(e.event_date);
          if (!dt || Number.isNaN(dt.getTime())) return false;
          dt.setHours(0, 0, 0, 0);
          return dt >= today;
        });
        if (active) setEvents(upcoming);
      } catch { if (active) setEvents([]); }
      finally { if (active) setLoading(false); }
    };
    fetchEvents();
    return () => { active = false; };
  }, []);

  const filteredEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isThisWeekend = (d) => {
      const dt = parseEventDate(d);
      if (!dt || Number.isNaN(dt.getTime())) return false;
      dt.setHours(0, 0, 0, 0);
      const diffToSat = (6 - today.getDay() + 7) % 7;
      const sat = new Date(today); sat.setDate(today.getDate() + diffToSat);
      const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
      return dt >= sat && dt <= sun;
    };
    const isThisMonth = (d) => {
      const dt = parseEventDate(d);
      if (!dt || Number.isNaN(dt.getTime())) return false;
      return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
    };

    let result = events.filter((e) => {
      const dt = parseEventDate(e.event_date);
      if (!dt || Number.isNaN(dt.getTime())) return false;
      dt.setHours(0, 0, 0, 0);
      return dt >= today;
    });

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.beach_name.toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'This Weekend') result = result.filter((e) => isThisWeekend(e.event_date));
    else if (filter === 'This Month') result = result.filter((e) => isThisMonth(e.event_date));
    else if (!['All'].includes(filter)) {
      const q = filter.toLowerCase();
      result = result.filter((e) =>
        (e.beach_name || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, search, filter]);

  return (
    <>
      <NavSpacer />

      {/* ═══ COMPACT HERO ═══ */}
      <section style={{ background: 'var(--ocean-800)', minHeight: 320, display: 'flex', alignItems: 'flex-end', color: 'white', position: 'relative', padding: '0 0 var(--sp-10)' }}>
        <div className="container" style={{ width: '100%' }}>
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 'var(--sp-2)' }}>ShoreClean / Events</div>
          <h1 data-aos="fade-up" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Upcoming Cleanups
          </h1>
          <p data-aos="fade-up" data-aos-delay="100" style={{ fontSize: 17, opacity: 0.8, marginTop: 'var(--sp-2)', maxWidth: 500 }}>
            Find a beach drive near you. Every weekend, something changes.
          </p>

          {/* Overlapping search bar */}
          <div style={{ position: 'relative', maxWidth: 600, marginTop: 'var(--sp-6)', marginBottom: '-28px' }}>
            <span style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none', zIndex: 1 }}>🔍</span>
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by beach name, city, or NGO…"
              style={{ borderRadius: 'var(--r-full)', paddingLeft: 52, paddingTop: 16, paddingBottom: 16, fontSize: 16, boxShadow: 'var(--shadow-lg)', border: 'none', position: 'relative', zIndex: 1 }}
            />
          </div>
        </div>
      </section>

      {/* ═══ FILTER STRIP ═══ */}
      <div className="container" style={{ marginTop: 'var(--sp-10)', paddingTop: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 'var(--sp-2)' }}>
          {LOCATION_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 20px', borderRadius: 'var(--r-full)', border: '1.5px solid',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'var(--t)', whiteSpace: 'nowrap',
                borderColor: filter === f ? 'var(--ocean-600)' : 'var(--color-border)',
                background: filter === f ? 'var(--ocean-600)' : 'white',
                color: filter === f ? 'white' : 'var(--color-text)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ EVENTS GRID ═══ */}
      <div className="container" style={{ marginTop: 'var(--sp-6)', paddingBottom: 'var(--sp-16)' }}>
        <p className="text-sm text-muted" style={{ marginBottom: 'var(--sp-4)' }}>
          Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </p>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--sp-6)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 160, width: '100%' }} />
                <div style={{ padding: 'var(--sp-5)' }}>
                  <div className="skeleton" style={{ height: 14, width: '40%' }} />
                  <div className="skeleton" style={{ height: 22, width: '85%', marginTop: 12 }} />
                  <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 12 }} />
                </div>
                <div style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
                  <div className="skeleton" style={{ height: 36, width: '100%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-16) var(--sp-6)' }}>
            <div style={{ width: 120, height: 80, margin: '0 auto var(--sp-6)', background: 'linear-gradient(135deg, var(--ocean-200), var(--ocean-400))', borderRadius: '50% 50% 0 0', clipPath: 'ellipse(60px 40px at 50% 100%)' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
              No cleanups found for this filter
            </h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--sp-4)' }}>
              Try a different filter or check back soon for new events.
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => { setFilter('All'); setSearch(''); }}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--sp-6)' }}>
            {filteredEvents.map((event, index) => (
              <div key={event.id} data-aos="fade-up" data-aos-delay={Math.min(index * 100, 400)}>
                <EventCard event={event} index={index} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
