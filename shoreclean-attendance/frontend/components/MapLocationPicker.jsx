import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const DEFAULT_CENTER = [20.5937, 78.9629];

function MapRecenter({ center }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.setView(center, Math.max(map.getZoom(), 10), { animate: true });
  }, [center, map]);

  return null;
}

function PickerEvents({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapLocationPicker({ latitude, longitude, onChange, height = 320 }) {
  const selected = useMemo(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return [latitude, longitude];
  }, [latitude, longitude]);

  const [locating, setLocating] = useState(false);

  const handlePick = (lat, lng) => {
    onChange({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
  };

  const useCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePick(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="text-sm text-muted">Click on the map to set an exact event pin.</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={useCurrentLocation} disabled={locating}>
          {locating ? 'Locating...' : 'Use Current Location'}
        </button>
      </div>

      <div style={{ border: '1.5px solid var(--color-border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <MapContainer
          center={selected || DEFAULT_CENTER}
          zoom={selected ? 13 : 5}
          scrollWheelZoom
          style={{ height, width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PickerEvents onPick={handlePick} />
          <MapRecenter center={selected} />

          {selected && (
            <>
              <Circle center={selected} radius={120} pathOptions={{ color: '#2176ae', fillColor: '#87d8f7', fillOpacity: 0.2 }} />
              <CircleMarker center={selected} radius={8} pathOptions={{ color: '#0f3460', fillColor: '#2e9fd6', fillOpacity: 1, weight: 2 }} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
