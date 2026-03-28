import { Circle, CircleMarker, MapContainer, TileLayer } from 'react-leaflet';

export default function EventLocationMap({ latitude, longitude, height = 260 }) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const center = [latitude, longitude];

  return (
    <div style={{ border: '1.5px solid var(--color-border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        dragging
        style={{ height, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle center={center} radius={120} pathOptions={{ color: '#2176ae', fillColor: '#87d8f7', fillOpacity: 0.2 }} />
        <CircleMarker center={center} radius={8} pathOptions={{ color: '#0f3460', fillColor: '#2e9fd6', fillOpacity: 1, weight: 2 }} />
      </MapContainer>
    </div>
  );
}
