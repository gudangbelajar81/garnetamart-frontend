import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom Marker Icons menggunakan HTML divIcon (zero dependency, high-res & responsive)
const courierIcon = L.divIcon({
  className: 'custom-courier-marker',
  html: `<div style="background:#2563EB; color:white; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 12px rgba(37,99,235,0.45); border:3px solid white; cursor:pointer; transform: translateY(-4px);">🛵</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -22]
});

const destinationIcon = L.divIcon({
  className: 'custom-dest-marker',
  html: `<div style="background:#DC2626; color:white; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 12px rgba(220,38,38,0.45); border:3px solid white; cursor:pointer; transform: translateY(-4px);">📍</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -22]
});

// Helper component untuk menyesuaikan view & zoom peta otomatis mencakup kurir dan tujuan
function MapBoundsAdjuster({ courierCoords, destCoords }) {
  const map = useMap();
  const hasAdjustedRef = useRef(false);

  useEffect(() => {
    if (courierCoords?.lat && destCoords?.lat) {
      const bounds = L.latLngBounds([
        [courierCoords.lat, courierCoords.lng],
        [destCoords.lat, destCoords.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      hasAdjustedRef.current = true;
    } else if (courierCoords?.lat && !hasAdjustedRef.current) {
      map.setView([courierCoords.lat, courierCoords.lng], 15);
      hasAdjustedRef.current = true;
    } else if (destCoords?.lat && !hasAdjustedRef.current) {
      map.setView([destCoords.lat, destCoords.lng], 15);
      hasAdjustedRef.current = true;
    }
  }, [courierCoords?.lat, courierCoords?.lng, destCoords?.lat, destCoords?.lng, map]);

  return null;
}

export default function LiveTrackingModal({ orderId, onClose }) {
  const [trackingData, setTrackingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchTracking = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/tracking`);
      const data = await res.json();
      if (data.success) {
        setTrackingData(data.tracking);
        setLastUpdated(new Date().toLocaleTimeString('id-ID'));
        setError('');
      } else {
        setError(data.message || 'Gagal memuat status tracking');
      }
    } catch (err) {
      setError('Koneksi terputus saat mengambil tracking kurir');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    fetchTracking();

    // Auto-polling posisi kurir setiap 8 detik agar update live
    const interval = setInterval(fetchTracking, 8000);
    return () => clearInterval(interval);
  }, [orderId]);

  const defaultCenter = [-7.8309995, 110.3894513]; // Titik default Yogyakarta
  const courierLoc = trackingData?.courier?.lat && trackingData?.courier?.lng
    ? { lat: Number(trackingData.courier.lat), lng: Number(trackingData.courier.lng) }
    : null;
  const destLoc = trackingData?.destination?.lat && trackingData?.destination?.lng
    ? { lat: Number(trackingData.destination.lat), lng: Number(trackingData.destination.lng) }
    : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#FFFFFF',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '94vh',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* HEADER MODAL */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F9FAFB'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🗺️</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                Lacak Kurir Live — Order #{orderId}
              </h3>
            </div>
            {lastUpdated && (
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
                Diperbarui live pukul {lastUpdated} (Auto-sync 8s)
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F3F4F6',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#4B5563',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            ✖
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading && !trackingData ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
              <p>Menghubungkan ke sistem GPS kurir...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '16px', background: '#FEE2E2', color: '#DC2626', borderRadius: '12px', textAlign: 'center' }}>
              {error}
            </div>
          ) : (
            <>
              {/* ETA & STATUS CARD (Fase 3 #4) */}
              <div style={{
                background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
                color: 'white',
                borderRadius: '16px',
                padding: '18px 20px',
                boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '3px 10px',
                      borderRadius: '99px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      letterSpacing: '0.5px'
                    }}>
                      {trackingData.status || 'Sedang Diantar'}
                    </span>
                    {trackingData.courier && (
                      <span style={{ fontSize: '13px', opacity: 0.9 }}>
                        Kurir: <b>{trackingData.courier.name}</b>
                      </span>
                    )}
                  </div>
                  <h2 style={{ margin: '4px 0', fontSize: '24px', fontWeight: '800' }}>
                    {trackingData.eta_text || 'Dalam Pengantaran'}
                  </h2>
                  <p style={{ margin: 0, fontSize: '12px', opacity: 0.85 }}>
                    {trackingData.distance_km !== null
                      ? `Jarak ke lokasi: ${trackingData.distance_km} km`
                      : 'Menghitung jarak dan rute...'}
                  </p>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  minWidth: '90px'
                }}>
                  <div style={{ fontSize: '11px', opacity: 0.9 }}>ESTIMASI TIBA</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', marginTop: '2px' }}>
                    {trackingData.eta_minutes !== null ? `~${trackingData.eta_minutes} m` : '-'}
                  </div>
                </div>
              </div>

              {/* PETA LIVE TRACKING LEAFLET (Fase 3 #3) */}
              <div style={{
                height: '320px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid #E5E7EB',
                position: 'relative'
              }}>
                <MapContainer
                  center={courierLoc || destLoc || defaultCenter}
                  zoom={14}
                  style={{ height: '100%', width: '100%', zIndex: 0 }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />

                  {/* Marker Kurir */}
                  {courierLoc && (
                    <Marker position={[courierLoc.lat, courierLoc.lng]} icon={courierIcon}>
                      <Popup>
                        <b>🛵 {trackingData.courier?.name || 'Kurir'}</b>
                        <br />
                        Sedang dalam perjalanan
                        {trackingData.courier?.last_update && (
                          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                            Update GPS: {new Date(trackingData.courier.last_update).toLocaleTimeString('id-ID')}
                          </div>
                        )}
                      </Popup>
                    </Marker>
                  )}

                  {/* Marker Tujuan Pelanggan */}
                  {destLoc && (
                    <Marker position={[destLoc.lat, destLoc.lng]} icon={destinationIcon}>
                      <Popup>
                        <b>📍 Lokasi Penerima</b>
                        <br />
                        {trackingData.customer_name}
                        <br />
                        <span style={{ fontSize: '11px', color: '#4B5563' }}>{trackingData.customer_address}</span>
                      </Popup>
                    </Marker>
                  )}

                  {/* Garis rute kurir -> tujuan */}
                  {courierLoc && destLoc && (
                    <Polyline
                      positions={[
                        [courierLoc.lat, courierLoc.lng],
                        [destLoc.lat, destLoc.lng]
                      ]}
                      color="#2563EB"
                      dashArray="6, 8"
                      weight={4}
                    />
                  )}

                  <MapBoundsAdjuster courierCoords={courierLoc} destCoords={destLoc} />
                </MapContainer>

                {!courierLoc && (
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    right: '12px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#4B5563',
                    zIndex: 1000,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>ℹ️</span>
                    <span>Kurir belum mengirim sinyal GPS aktif. Lokasi akan muncul otomatis begitu kurir bergerak.</span>
                  </div>
                )}
              </div>

              {/* DETAIL ALAMAT PENERIMA */}
              <div style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '14px',
                padding: '14px 16px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Alamat Pengantaran
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                  {trackingData.customer_name}
                </div>
                <div style={{ fontSize: '13px', color: '#4B5563', marginTop: '2px', lineHeight: '1.4' }}>
                  {trackingData.customer_address}
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F9FAFB'
        }}>
          <button
            onClick={fetchTracking}
            style={{
              padding: '8px 16px',
              background: '#EFF6FF',
              color: '#2563EB',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔄 Segarkan Peta
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
