import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CourierDashboard() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadingOrderId, setUploadingOrderId] = useState(null);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/couriers/${courierId}/orders`);
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

  const handleCompleteOrder = async (orderId) => {
    if(!window.confirm("Yakin pesanan ini sudah sampai ke tangan pembeli?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/complete`, {
        method: 'POST',
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
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button onClick={() => window.open(`https://wa.me/${order.customer_phone.startsWith('0') ? '62'+order.customer_phone.substring(1) : order.customer_phone}`, '_blank')} style={{ flex: 1, padding: '10px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  💬 Chat WA
                </button>
                <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`, '_blank')} style={{ flex: 1, padding: '10px', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  🗺️ Buka Peta
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
