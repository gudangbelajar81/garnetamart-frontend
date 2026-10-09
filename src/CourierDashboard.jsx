import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { printReceiptBluetooth, isBluetoothSupported } from './utils/bluetoothPrinter';

function CourierDashboard() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadingOrderId, setUploadingOrderId] = useState(null);
  const [waModalOrder, setWaModalOrder] = useState(null);
  const [customWaText, setCustomWaText] = useState('');
  const [gpsActive, setGpsActive] = useState(true);
  const [gpsStatus, setGpsStatus] = useState({ lat: null, lng: null, lastUpdated: null, error: null, isSending: false });
  const [printingOrderId, setPrintingOrderId] = useState(null);
  const navigate = useNavigate();
  
  const courierId = localStorage.getItem('courier_id');
  const courierName = localStorage.getItem('courier_name');

  useEffect(() => {
    if (!courierId) {
      navigate('/kurir');
      return;
    }
    fetchOrders();
    const interval = setInterval(() => fetchOrders(), 10000); // Polling 10 detik
    return () => clearInterval(interval);
  }, [courierId, navigate]);

  const fetchOrders = async () => {
    try {
      const courierToken = localStorage.getItem('courier_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/couriers/${courierId}/orders`, {
        headers: { 'Authorization': `Bearer ${courierToken}` }
      });
      // Sesi kurir kedaluwarsa/invalid -> bersihkan token lalu balik ke halaman login kurir.
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('courier_token');
        alert('Sesi login sudah berakhir. Silakan login kembali.');
        window.location.href = '/kurir';
        return;
      }
      const result = await res.json();
      if (result.success) {
        setOrders(result.data);
      }
    } catch (err) {
      console.error("Gagal mengambil data tugas");
    } finally {
      setIsLoading(false);
    }
  };

  // Fase 3 #3: Reporter Lokasi GPS Kurir Real-Time
  const reportLocation = (coords) => {
    if (!coords || !courierId) return;
    const courierToken = localStorage.getItem('courier_token');
    if (!courierToken) return;

    setGpsStatus(prev => ({ ...prev, isSending: true }));
    fetch(`${import.meta.env.VITE_API_URL}/api/couriers/${courierId}/location`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${courierToken}`
      },
      body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGpsStatus({
            lat: coords.latitude.toFixed(6),
            lng: coords.longitude.toFixed(6),
            lastUpdated: new Date().toLocaleTimeString('id-ID'),
            error: null,
            isSending: false
          });
        } else {
          setGpsStatus(prev => ({ ...prev, isSending: false, error: data.message }));
        }
      })
      .catch(err => {
        setGpsStatus(prev => ({ ...prev, isSending: false, error: err.message }));
      });
  };

  const triggerGpsSync = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus(prev => ({ ...prev, error: "Browser tidak mendukung GPS Geolocation" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => reportLocation(pos.coords),
      (err) => setGpsStatus(prev => ({ ...prev, error: `Sinyal GPS lemah/ditolak: ${err.message}` })),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  // Sinkronisasi GPS otomatis tiap 15 detik jika GPS aktif dan kurir sedang login
  useEffect(() => {
    if (!gpsActive || !courierId || typeof navigator === 'undefined' || !navigator.geolocation) return;

    triggerGpsSync();
    const gpsInterval = setInterval(() => {
      triggerGpsSync();
    }, 15000);

    return () => clearInterval(gpsInterval);
  }, [gpsActive, courierId]);

  // Fase 3 #5: Cetak Struk Bluetooth POS Thermal
  const handlePrintReceipt = async (order) => {
    setPrintingOrderId(order.id);
    try {
      const res = await printReceiptBluetooth(order);
      if (res.success) {
        alert(`✅ Struk Order #${order.id} berhasil dicetak!`);
      } else {
        alert(`⚠️ Gagal mencetak struk: ${res.error || 'Periksa koneksi printer Bluetooth'}`);
      }
    } catch (err) {
      alert(`⚠️ Error cetak: ${err.message}`);
    } finally {
      setPrintingOrderId(null);
    }
  };

  // Fase 3 #2: Template WA Cerdas Kurir -> Pembeli
  const sendWaMessage = (order, templateType, customMsg = '') => {
    if (!order || !order.customer_phone) return;
    const rawPhone = String(order.customer_phone).replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? '62' + rawPhone.substring(1) : rawPhone;
    const senderName = courierName || 'Kurir';

    let msg = '';
    if (templateType === 'otw') {
      msg = `Halo Kak *${order.customer_name}*, saya *${senderName}* dari *GarnetaMart* 🚚\n\nSaat ini saya sedang dalam perjalanan menuju alamat Kakak untuk mengantar pesanan (Order *#${order.id}*).\n📍 *Alamat:* ${order.customer_address}\n💵 *Total Tagihan:* ${formatRp(order.total_amount)}\n\nMohon nomor HP tetap aktif ya Kak. Sampai jumpa sebentar lagi! 🙏`;
    } else if (templateType === 'arrived') {
      msg = `Halo Kak *${order.customer_name}*, saya *${senderName}* dari *GarnetaMart* 🚚\n\nSaya sudah tiba di lokasi / depan rumah untuk mengantar pesanan Order *#${order.id}*.\nMohon bantuannya untuk keluar atau membukakan pagar ya Kak. Terima kasih! 🏡`;
    } else if (templateType === 'cod') {
      msg = `Halo Kak *${order.customer_name}*, saya *${senderName}* dari *GarnetaMart* 🚚\n\nMengingatkan untuk pesanan Order *#${order.id}*, total tagihannya adalah *${formatRp(order.total_amount)}*.\nMohon disiapkan uang pas jika memungkinkan ya Kak. Terima kasih! 💵`;
    } else if (templateType === 'custom') {
      msg = customMsg.trim() ? `Halo Kak *${order.customer_name}* (Order *#${order.id}*),\n\n${customMsg.trim()}\n\n— *${senderName}* (GarnetaMart)` : '';
    }

    const url = msg 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/${cleanPhone}`;
    window.open(url, '_blank');
    setWaModalOrder(null);
    setCustomWaText('');
  };

  const handleCompleteOrder = async (orderId) => {
    if(!window.confirm("Yakin pesanan ini sudah sampai ke tangan pembeli?")) return;
    try {
      const courierToken = localStorage.getItem('courier_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${courierToken}`
        },
        body: JSON.stringify({ status: 'Selesai' })
      });
      const result = await res.json();
      if(result.success) {
        fetchOrders();
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("Gagal mengupdate status");
    }
  };

  const handleUploadProofAndComplete = async (e, orderId) => {
    const file = e.target.files[0];
    if (!file) return;

    if(!window.confirm("Kirim foto bukti ini dan selesaikan pesanan?")) return;
    
    setIsUploadingProof(true);
    setUploadingOrderId(orderId);
    const fd = new FormData();
    fd.append('proof_image', file);
    
    try {
      const courierToken = localStorage.getItem('courier_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${courierToken}` },
        body: fd
      });
      const result = await res.json();
      if(result.success) {
        fetchOrders();
      } else {
        alert("Gagal: " + result.message);
      }
    } catch (err) {
      alert("Error saat mengunggah foto bukti.");
    } finally {
      setIsUploadingProof(false);
      setUploadingOrderId(null);
      e.target.value = ''; // Reset input
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('courier_id');
    localStorage.removeItem('courier_name');
    localStorage.removeItem('courier_token');
    navigate('/kurir');
  };

  const formatRp = (num) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);

  // Hitung total saldo dari orderan yang berstatus 'Selesai' hari ini
  // Untuk simpelnya, kita hitung semua yang selesai di daftar (biasanya admin akan reset atau filter per hari di backend, tapi ini MVP)
  const completedOrders = orders.filter(o => o.status === 'Selesai');
  const activeOrders = orders.filter(o => o.status === 'Sedang Diantar');
  const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.shipping_fee || 0), 0);

  return (
    <div style={{ padding: '20px', background: '#F3F4F6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Halo, {courierName} 👋</h2>
          <p style={{ margin: 0, color: '#6B7280', fontSize: '12px' }}>Hati-hati di jalan!</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Keluar</button>
      </div>

      {/* Fase 3 #3: Live GPS Tracking Kurir Bar */}
      <div style={{ background: 'white', padding: '14px 18px', borderRadius: '16px', marginBottom: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: gpsActive ? (gpsStatus.lat ? '#10B981' : '#F59E0B') : '#9CA3AF', boxShadow: gpsActive && gpsStatus.lat ? '0 0 8px #10B981' : 'none' }}></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111827' }}>
                {gpsActive ? (gpsStatus.lat ? '📍 GPS Live Aktif' : '📍 Mencari Sinyal GPS...') : '📍 GPS Dimatikan'}
              </span>
              {gpsStatus.isSending && <span style={{ fontSize: '11px', color: '#3B82F6' }}>Mengirim...</span>}
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#6B7280' }}>
              {gpsStatus.error
                ? `⚠️ ${gpsStatus.error}`
                : gpsStatus.lat
                ? `Posisi: ${gpsStatus.lat}, ${gpsStatus.lng} • Update: ${gpsStatus.lastUpdated}`
                : 'Lokasi Anda disiarkan ke pelanggan & toko'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={triggerGpsSync}
            title="Kirim posisi GPS sekarang"
            style={{ padding: '6px 12px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔄 Sinkron GPS
          </button>
          <button
            onClick={() => setGpsActive(!gpsActive)}
            style={{ padding: '6px 12px', background: gpsActive ? '#FEE2E2' : '#DCFCE7', color: gpsActive ? '#DC2626' : '#16A34A', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {gpsActive ? 'Matikan' : 'Aktifkan'}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>Pendapatan Ongkir (Selesai)</p>
          <h1 style={{ margin: 0, color: '#10B981', fontSize: '32px' }}>{formatRp(totalEarnings)}</h1>
        </div>
        <div style={{ fontSize: '40px' }}>💰</div>
      </div>

      <h3 style={{ marginBottom: '16px' }}>Tugas Mengantar 🚚 ({activeOrders.length})</h3>
      
      {isLoading ? <p>Memuat tugas...</p> : activeOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '16px' }}>
          <span style={{ fontSize: '40px' }}>☕</span>
          <p style={{ color: '#6B7280', marginTop: '10px' }}>Belum ada tugas baru. Silakan istirahat.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeOrders.map(order => (
            <div key={order.id} style={{ background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3B82F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold', color: '#3B82F6' }}>Order #{order.id}</span>
                <span style={{ background: '#FEF3C7', color: '#92400E', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                  {order.transport_type === 'pickup' ? '🛻 Pick-up' : '🛵 Motor'}
                </span>
              </div>
              
              <h3 style={{ margin: '0 0 4px 0' }}>{order.customer_name}</h3>
              <p style={{ margin: '0 0 12px 0', color: '#4B5563', fontSize: '14px', lineHeight: '1.4' }}>📍 {order.customer_address}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <button onClick={() => { setWaModalOrder(order); setCustomWaText(''); }} style={{ padding: '10px 6px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  💬 Chat WA
                </button>
                <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`, '_blank')} style={{ padding: '10px 6px', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  🗺️ Peta
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(order)}
                  disabled={printingOrderId === order.id}
                  style={{ padding: '10px 6px', background: printingOrderId === order.id ? '#9CA3AF' : '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  {printingOrderId === order.id ? '⏳ Cetak...' : '🖨️ Struk'}
                </button>
              </div>

              <div style={{ borderTop: '1px dashed #D1D5DB', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>Tagihan ke Pembeli</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{formatRp(order.total_amount)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>Upah Kurir</p>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#10B981' }}>{formatRp(order.shipping_fee || 0)}</p>
                </div>
              </div>

              <label style={{ display: 'block', width: '100%', padding: '16px', marginTop: '16px', background: isUploadingProof && uploadingOrderId === order.id ? '#9CA3AF' : '#3B82F6', color: 'white', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box' }}>
                {isUploadingProof && uploadingOrderId === order.id ? '⏳ Mengunggah Foto...' : '📸 Foto Bukti & Selesai'}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={(e) => handleUploadProofAndComplete(e, order.id)} 
                  style={{ display: 'none' }} 
                  disabled={isUploadingProof}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Fase 3 #2: Modal Template WhatsApp Kurir -> Pembeli */}
      {waModalOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>💬 Pilih Pesan WhatsApp</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
                  Ke: <b>{waModalOrder.customer_name}</b> (Order #{waModalOrder.id})
                </p>
              </div>
              <button onClick={() => setWaModalOrder(null)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✖</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => sendWaMessage(waModalOrder, 'otw')}
                style={{ textAlign: 'left', padding: '12px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div style={{ fontWeight: 'bold', color: '#166534', fontSize: '14px', marginBottom: '4px' }}>🛵 1. Sedang Menuju Lokasi (OTW)</div>
                <div style={{ fontSize: '12px', color: '#15803D' }}>Beri tahu pembeli bahwa paket sedang dalam perjalanan & minta nomor HP tetap aktif.</div>
              </button>

              <button
                type="button"
                onClick={() => sendWaMessage(waModalOrder, 'arrived')}
                style={{ textAlign: 'left', padding: '12px', background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div style={{ fontWeight: 'bold', color: '#1E40AF', fontSize: '14px', marginBottom: '4px' }}>🏡 2. Sudah Sampai di Depan Rumah</div>
                <div style={{ fontSize: '12px', color: '#1D4ED8' }}>Beri tahu bahwa Anda sudah di depan pagar/rumah & mohon bantuan dibukakan.</div>
              </button>

              <button
                type="button"
                onClick={() => sendWaMessage(waModalOrder, 'cod')}
                style={{ textAlign: 'left', padding: '12px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div style={{ fontWeight: 'bold', color: '#92400E', fontSize: '14px', marginBottom: '4px' }}>💵 3. Pengingat Tagihan ({formatRp(waModalOrder.total_amount)})</div>
                <div style={{ fontSize: '12px', color: '#B45309' }}>Ingatkan jumlah uang pas yang perlu disiapkan untuk pembayaran COD.</div>
              </button>
            </div>

            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>
                Atau Ketik Pesan Kustom:
              </label>
              <textarea
                value={customWaText}
                onChange={(e) => setCustomWaText(e.target.value)}
                placeholder="Contoh: Maaf Kak, patokan rumah dekat pohon mangga sebelah mana ya?"
                rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => sendWaMessage(waModalOrder, 'custom', customWaText)}
                  disabled={!customWaText.trim()}
                  style={{ flex: 2, padding: '10px', background: customWaText.trim() ? '#25D366' : '#9CA3AF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: customWaText.trim() ? 'pointer' : 'not-allowed' }}
                >
                  🚀 Kirim Pesan Kustom
                </button>
                <button
                  type="button"
                  onClick={() => sendWaMessage(waModalOrder, 'blank')}
                  style={{ flex: 1, padding: '10px', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  Chat Kosong
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Selesai */}
      {completedOrders.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ marginBottom: '16px', color: '#6B7280', fontSize: '14px' }}>Riwayat Selesai ({completedOrders.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {completedOrders.map(order => (
              <div key={order.id} style={{ background: '#F9FAFB', padding: '12px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E5E7EB' }}>
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>#{order.id} - {order.customer_name}</span>
                </div>
                <span style={{ fontWeight: 'bold', color: '#10B981', fontSize: '14px' }}>+{formatRp(order.shipping_fee || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CourierDashboard;
