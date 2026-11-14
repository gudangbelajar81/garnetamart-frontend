import { useState, useEffect } from 'react';

function DigitalInvoiceModal({ orderId, onClose }) {
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/invoice`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setInvoiceData(result.data);
        } else {
          setError(result.message || 'Gagal memuat invoice');
        }
      })
      .catch(err => {
        console.error(err);
        setError('Terjadi kesalahan jaringan saat memuat invoice');
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  const formatRp = (num) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWA = () => {
    if (!invoiceData) return;
    const { order, invoice_number, items, store } = invoiceData;
    const phone = order.customer_phone || "";
    const waNum = phone.startsWith('0') ? '62' + phone.substring(1) : phone;

    let itemListText = (items || []).map((it, idx) => `${idx + 1}. ${it.product_name} (${it.quantity}x) = ${formatRp(it.price * it.quantity)}`).join('\n');

    const msg = `🧾 *INVOICE RESMI ${store.name.toUpperCase()}*\n` +
      `No. Invoice: *${invoice_number}*\n` +
      `Tanggal: ${new Date(order.order_date).toLocaleString('id-ID')}\n` +
      `Status Bayar: *${order.payment_status === 'paid' ? 'LUNAS ✅' : 'BELUM LUNAS ⏳'}*\n` +
      `Metode: ${order.payment_method?.toUpperCase()}\n\n` +
      `*Penerima:* ${order.customer_name}\n` +
      `*Alamat:* ${order.customer_address}\n\n` +
      `*Rincian Barang:*\n${itemListText}\n\n` +
      (order.discount_amount > 0 ? `Diskon Promo: -${formatRp(order.discount_amount)}\n` : '') +
      (order.points_used > 0 ? `Potongan Poin: -${formatRp(order.points_used)}\n` : '') +
      `Ongkir (${order.transport_type || 'motor'}): ${formatRp(order.shipping_fee || 0)}\n` +
      `*TOTAL TAGIHAN: ${formatRp(order.total_amount)}*\n\n` +
      `Terima kasih telah berbelanja sembako di ${store.name}! 🙏`;

    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!orderId) return null;

  return (
    <div className="invoice-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div className="invoice-container" style={{
        background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '780px',
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header Action Bar (Tidak Dicetak) */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
          borderRadius: '20px 20px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🧾</span>
            <strong style={{ fontSize: '15px', color: '#1E293B' }}>Kuitansi & Digital Invoice Resmi</strong>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleShareWA}
              disabled={loading || !!error}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', background: '#25D366', color: 'white',
                border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              💬 Bagikan WA
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', background: '#2563EB', color: 'white',
                border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🖨️ Cetak / Simpan PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 14px', background: '#E2E8F0', color: '#475569',
                border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              ✕ Tutup
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '32px', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              <p style={{ fontWeight: 'bold' }}>Menyiapkan dokumen invoice resmi...</p>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#DC2626' }}>
              <p style={{ fontWeight: 'bold' }}>⚠️ {error}</p>
              <button onClick={onClose} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', cursor: 'pointer' }}>Kembali</button>
            </div>
          )}

          {!loading && !error && invoiceData && (
            <div id="invoice-printable-area" style={{ color: '#1E293B', fontFamily: "system-ui, -apple-system, sans-serif" }}>
              {/* Kop Surat Resmi */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '20px', marginBottom: '24px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px' }}>
                      🌾
                    </div>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0F172A' }}>
                        {invoiceData.store.name}
                      </h1>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                        Pusat Grosir & Sembako Murah Yogyakarta
                      </p>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                    <div>📍 {invoiceData.store.address}</div>
                    <div>📞 WA / CS: {invoiceData.store.phone} | 🌐 {invoiceData.store.website}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', position: 'relative' }}>
                  <div style={{ background: '#F1F5F9', padding: '6px 12px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold', fontSize: '13px', color: '#0F172A', marginBottom: '6px' }}>
                    INVOICE RESMI
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#2563EB', fontFamily: 'monospace' }}>
                    {invoiceData.invoice_number}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    Tanggal: {new Date(invoiceData.order.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>

                  {/* Stampel Watermark Lunas / Unpaid */}
                  {invoiceData.order.payment_status === 'paid' ? (
                    <div style={{
                      position: 'absolute', right: '10px', top: '70px',
                      border: '3px solid #16A34A', color: '#16A34A',
                      padding: '4px 16px', borderRadius: '8px',
                      fontWeight: '900', fontSize: '18px', letterSpacing: '2px',
                      transform: 'rotate(-10deg)', opacity: 0.85,
                      textTransform: 'uppercase', pointerEvents: 'none'
                    }}>
                      ✓ LUNAS
                    </div>
                  ) : (
                    <div style={{
                      position: 'absolute', right: '10px', top: '70px',
                      border: '3px dashed #D97706', color: '#D97706',
                      padding: '4px 14px', borderRadius: '8px',
                      fontWeight: '800', fontSize: '14px', letterSpacing: '1px',
                      transform: 'rotate(-10deg)', opacity: 0.85,
                      textTransform: 'uppercase', pointerEvents: 'none'
                    }}>
                      {invoiceData.order.payment_method === 'cod' ? '💵 COD' : '⏳ MENUNGGU BAYAR'}
                    </div>
                  )}
                </div>
              </div>

              {/* Data Pelanggan & Pengiriman */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: '#F8FAFC', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #E2E8F0' }}>
                <div>
                  <small style={{ color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px' }}>Ditujukan Kepada:</small>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', marginTop: '4px' }}>{invoiceData.order.customer_name}</div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>📱 {invoiceData.order.customer_phone}</div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                    🏠 {invoiceData.order.customer_address}
                  </div>
                </div>
                <div>
                  <small style={{ color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px' }}>Rincian Transaksi:</small>
                  <div style={{ fontSize: '13px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Metode Bayar:</span>
                    <strong style={{ textTransform: 'uppercase' }}>
                      {invoiceData.order.payment_method === 'midtrans' ? '⚡ Midtrans Snap' : invoiceData.order.payment_method === 'qris_manual' ? '📱 QRIS Manual' : '💵 Tunai (COD)'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Status Pesanan:</span>
                    <strong>{invoiceData.order.status || 'Baru'}</strong>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Armada Pengiriman:</span>
                    <strong>{invoiceData.order.transport_type === 'pickup' ? '🛻 Mobil Pick-up' : '🛵 Motor / Obrok'}</strong>
                  </div>
                </div>
              </div>

              {/* Tabel Rincian Barang */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white', fontSize: '12px' }}>
                    <th style={{ padding: '10px 14px', borderRadius: '8px 0 0 0' }}>NO</th>
                    <th style={{ padding: '10px 14px' }}>NAMA BARANG</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>JUMLAH</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>HARGA SATUAN</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', borderRadius: '0 8px 0 0' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoiceData.items || []).map((it, idx) => (
                    <tr key={it.id || idx} style={{ borderBottom: '1px solid #E2E8F0', fontSize: '13px' }}>
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '600' }}>
                        {it.product_name}
                        {it.variant_name && <span style={{ fontSize: '11px', color: '#2563EB', marginLeft: '6px' }}>({it.variant_name})</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{it.quantity}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#64748B' }}>{formatRp(it.price)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 'bold' }}>{formatRp(it.price * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Rangkuman Finansial & Kalkulasi */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '2px solid #E2E8F0', paddingTop: '16px' }}>
                <div style={{ maxWidth: '340px' }}>
                  <div style={{ background: '#EFF6FF', padding: '12px 16px', borderRadius: '10px', border: '1px solid #BFDBFE', fontSize: '12px', color: '#1E40AF', lineHeight: '1.5' }}>
                    <strong>⚖️ Keterangan Legalitas:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      Invoice elektronik ini diterbitkan secara otomatis oleh sistem GarnetaMart dan sah sebagai bukti transaksi jual-beli menurut UU ITE No. 11/2008 serta UU Perlindungan Data Pribadi No. 27/2022.
                    </p>
                  </div>
                </div>

                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Subtotal Produk:</span>
                    <span>{formatRp((invoiceData.items || []).reduce((acc, it) => acc + (it.price * it.quantity), 0))}</span>
                  </div>

                  {invoiceData.order.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}>
                      <span>Diskon Voucher Promo:</span>
                      <strong>-{formatRp(invoiceData.order.discount_amount)}</strong>
                    </div>
                  )}

                  {invoiceData.order.points_used > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706' }}>
                      <span>Potongan Poin Loyalitas:</span>
                      <strong>-{formatRp(invoiceData.order.points_used)}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Ongkos Kirim ({invoiceData.order.transport_type || 'motor'}):</span>
                    <span>{formatRp(invoiceData.order.shipping_fee || 0)}</span>
                  </div>

                  <div style={{ borderTop: '2px solid #0F172A', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    <span>TOTAL BAYAR:</span>
                    <span style={{ color: '#2563EB' }}>{formatRp(invoiceData.order.total_amount)}</span>
                  </div>

                  {invoiceData.order.points_earned > 0 && (
                    <div style={{ fontSize: '11px', color: '#16A34A', textAlign: 'right', marginTop: '2px' }}>
                      🎁 Mendapatkan +{invoiceData.order.points_earned} Poin Loyalitas
                    </div>
                  )}
                </div>
              </div>

              {/* Ucapan Terima Kasih */}
              <div style={{ textAlign: 'center', marginTop: '36px', paddingTop: '16px', borderTop: '1px dashed #CBD5E1', fontSize: '12px', color: '#64748B' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>Terima Kasih Atas Kepercayaan Anda Belanja di GarnetaMart 🙏</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>Barang yang sudah dibeli dapat ditukar jika rusak/cacat dalam 1x24 jam dengan menyertakan bukti invoice ini.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Stylesheet khusus A4 */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .no-print {
              display: none !important;
            }
            .invoice-modal-overlay {
              position: static !important;
              background: none !important;
              padding: 0 !important;
            }
            .invoice-container {
              box-shadow: none !important;
              max-width: 100% !important;
              max-height: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
            }
            #invoice-printable-area, #invoice-printable-area * {
              visibility: visible;
            }
            #invoice-printable-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
            }
          }
        `}
      </style>
    </div>
  );
}

export default DigitalInvoiceModal;
