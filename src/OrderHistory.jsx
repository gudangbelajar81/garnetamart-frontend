import { useState, useEffect } from 'react';

// Helper format Rupiah, konsisten dengan yang dipakai di Storefront/Dashboard
function formatRp(num) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);
}

// Badge warna status, konsisten dengan tampilan Dashboard admin
function StatusBadge({ status }) {
  const styles = {
    'Baru': { bg: '#FEF08A', text: '#854D0E' },
    'Menunggu Konfirmasi': { bg: '#FEF08A', text: '#854D0E' },
    'Diproses': { bg: '#BFDBFE', text: '#1E40AF' },
    'Dikirim': { bg: '#BFDBFE', text: '#1E40AF' },
    'Selesai': { bg: '#BBF7D0', text: '#166534' },
  };
  const s = styles[status] || { bg: '#E5E7EB', text: '#374151' };
  return (
    <span style={{ background: s.bg, color: s.text, padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 'bold' }}>
      {status}
    </span>
  );
}

function OrderHistory({ customer, onClose }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!customer || !customer.id || !customer.phone) {
      setError('Sesi member tidak valid. Silakan login ulang.');
      setIsLoading(false);
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL}/api/customers/${customer.id}/orders?phone=${encodeURIComponent(customer.phone)}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setOrders(result.data);
        } else {
          setError(result.message || 'Gagal mengambil riwayat pesanan.');
        }
      })
      .catch(() => setError('Gagal terhubung ke server.'))
      .finally(() => setIsLoading(false));
  }, [customer]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--card)', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--dark)', fontSize: '18px' }}>📦 Pesanan Saya</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✖</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
          {isLoading && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Memuat riwayat pesanan...</p>
          )}

          {!isLoading && error && (
            <p style={{ textAlign: 'center', color: '#B91C1C', padding: '40px 0' }}>⚠️ {error}</p>
          )}

          {!isLoading && !error && orders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🛒</div>
              <p>Belum ada pesanan. Yuk mulai belanja!</p>
            </div>
          )}

          {!isLoading && !error && orders.map(order => {
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: '14px', marginBottom: '12px', overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  style={{ padding: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--light)' }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-main)' }}>Pesanan #{order.id}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(order.order_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={order.status} />
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--primary)', marginTop: '4px' }}>
                      {formatRp(order.total_amount)}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '14px', borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>
                      📍 {order.customer_address}
                    </p>
                    {order.items && order.items.length > 0 ? (
                      <table style={{ width: '100%', fontSize: '13px' }}>
                        <tbody>
                          {order.items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '4px 0', color: 'var(--text-main)' }}>{item.product_name}</td>
                              <td style={{ padding: '4px 0', textAlign: 'center', color: 'var(--text-muted)' }}>x{item.quantity}</td>
                              <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--text-main)' }}>{formatRp(item.price * item.quantity)}</td>
                            </tr>
                          ))}
                          {order.shipping_fee > 0 && (
                            <tr>
                              <td colSpan={2} style={{ padding: '4px 0', color: 'var(--text-muted)' }}>Ongkos Kirim</td>
                              <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--text-muted)' }}>{formatRp(order.shipping_fee)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Rincian item tidak tersedia untuk pesanan ini.</p>
                    )}
                    {order.proof_of_delivery && (
                      <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>📸 Bukti Pengiriman:</p>
                        <img
                          src={`${import.meta.env.VITE_API_URL}${order.proof_of_delivery}`}
                          alt="Bukti pengiriman"
                          style={{ width: '100%', maxWidth: '200px', borderRadius: '8px', border: '1px solid var(--border)' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OrderHistory;
