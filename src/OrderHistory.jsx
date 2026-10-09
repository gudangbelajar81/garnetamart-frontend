import { useState, useEffect } from 'react';
import LiveTrackingModal from './LiveTrackingModal';

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
  const [trackingOrderId, setTrackingOrderId] = useState(null);

  // State untuk fitur beri-ulasan (review) per item pesanan yang statusnya 'Selesai'
  const [reviewOpenKey, setReviewOpenKey] = useState(null); // key = `${orderId}-${productId}`
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsgMap, setReviewMsgMap] = useState({}); // key -> { type: 'success'|'error', text }

  function toggleReviewForm(key) {
    if (reviewOpenKey === key) {
      setReviewOpenKey(null);
    } else {
      setReviewOpenKey(key);
      setReviewRating(5);
      setReviewComment('');
    }
  }

  async function submitReview(order, item) {
    const key = `${order.id}-${item.product_id}`;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: item.product_id,
          customer_id: customer.id,
          order_id: order.id,
          phone: customer.phone,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setReviewMsgMap(prev => ({ ...prev, [key]: { type: 'success', text: '✅ Ulasan terkirim, terima kasih!' } }));
        setReviewOpenKey(null);
      } else if (res.status === 409) {
        setReviewMsgMap(prev => ({ ...prev, [key]: { type: 'success', text: 'Anda sudah memberi ulasan untuk produk ini.' } }));
        setReviewOpenKey(null);
      } else {
        setReviewMsgMap(prev => ({ ...prev, [key]: { type: 'error', text: result.message || 'Gagal mengirim ulasan.' } }));
      }
    } catch {
      setReviewMsgMap(prev => ({ ...prev, [key]: { type: 'error', text: 'Gagal terhubung ke server.' } }));
    } finally {
      setReviewSubmitting(false);
    }
  }

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
                    {order.status === 'Selesai' && order.items && order.items.length > 0 && (
                      <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                        {order.items.map((item, idx) => {
                          const key = `${order.id}-${item.product_id}`;
                          const msg = reviewMsgMap[key];
                          const isOpen = reviewOpenKey === key;
                          return (
                            <div key={idx} style={{ marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>{item.product_name}</span>
                                {!msg && (
                                  <button
                                    onClick={() => toggleReviewForm(key)}
                                    style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
                                  >
                                    {isOpen ? 'Batal' : '⭐ Beri Ulasan'}
                                  </button>
                                )}
                              </div>

                              {msg && (
                                <p style={{ fontSize: '11px', color: msg.type === 'success' ? '#166534' : '#B91C1C', margin: '4px 0 0 0' }}>
                                  {msg.text}
                                </p>
                              )}

                              {isOpen && !msg && (
                                <div style={{ background: 'var(--light)', borderRadius: '10px', padding: '10px', marginTop: '6px' }}>
                                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                      <span
                                        key={star}
                                        onClick={() => setReviewRating(star)}
                                        style={{ fontSize: '20px', cursor: 'pointer', color: star <= reviewRating ? '#FACC15' : '#D1D5DB' }}
                                      >
                                        ★
                                      </span>
                                    ))}
                                  </div>
                                  <textarea
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    placeholder="Ceritakan pengalaman Anda dengan produk ini (opsional)..."
                                    style={{ width: '100%', minHeight: '50px', borderRadius: '8px', border: '1px solid var(--border)', padding: '8px', fontSize: '12px', boxSizing: 'border-box', resize: 'vertical' }}
                                  />
                                  <button
                                    onClick={() => submitReview(order, item)}
                                    disabled={reviewSubmitting}
                                    style={{ marginTop: '8px', width: '100%', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 'bold', cursor: reviewSubmitting ? 'not-allowed' : 'pointer', opacity: reviewSubmitting ? 0.6 : 1 }}
                                  >
                                    {reviewSubmitting ? 'Mengirim...' : 'Kirim Ulasan'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
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

                    {/* Fase 3 #3 & #4: Tombol Lacak Kurir Live & ETA */}
                    {(order.status === 'Sedang Diantar' || order.status === 'Dikirim' || order.courier_id) && (
                      <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingOrderId(order.id);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 10px rgba(37,99,235,0.25)'
                          }}
                        >
                          <span style={{ fontSize: '16px' }}>🗺️</span>
                          <span>Lacak Kurir Live & Estimasi Tiba (ETA)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fase 3 #3 & #4: Modal Live Tracking Kurir */}
      {trackingOrderId && (
        <LiveTrackingModal
          orderId={trackingOrderId}
          onClose={() => setTrackingOrderId(null)}
        />
      )}
    </div>
  );
}

export default OrderHistory;
