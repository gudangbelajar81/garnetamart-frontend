import { useState, useEffect } from 'react';

// Helper format Rupiah, konsisten dengan Storefront/OrderHistory
function formatRp(num) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);
}

// Modal Detail Produk + Galeri Foto dengan Zoom (Fase 2 #4)
// Menampilkan foto utama (image_url) + semua foto tambahan (gallery dari product_images),
// thumbnail strip untuk ganti foto aktif, dan klik foto besar untuk mode zoom penuh.
function ProductGalleryModal({ productId, onClose, onAddToCart }) {
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/products/${productId}/detail`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setProduct(result.data);
          if (result.data.variants && result.data.variants.length > 0) {
            setSelectedVariant(result.data.variants[0]);
          }
        } else {
          setError(result.message || 'Gagal memuat detail produk.');
        }
      })
      .catch(() => setError('Gagal terhubung ke server.'))
      .finally(() => setIsLoading(false));
  }, [productId]);

  // Gabungkan foto utama + galeri jadi satu array buat ditampilkan berurutan.
  // Foto utama (image_url) selalu jadi foto pertama kalau dia bukan emoji fallback.
  const allPhotos = [];
  if (product) {
    if (product.image_url && product.image_url.startsWith('/uploads/')) {
      allPhotos.push(product.image_url);
    }
    if (product.gallery && product.gallery.length > 0) {
      product.gallery.forEach(g => allPhotos.push(g.image_url));
    }
  }

  const apiUrl = import.meta.env.VITE_API_URL;

  // Fase 2 #6: OG Meta per Produk. Link yang dibagikan arahkan ke endpoint backend /produk/:id
  // (bukan langsung ke SPA), supaya crawler bot WhatsApp/Facebook bisa baca OG meta tag dinamis
  // sesuai produk saat link di-preview, sebelum manusia yang klik diarahkan balik ke SPA.
  async function handleShare() {
    const shareUrl = `${apiUrl}/produk/${productId}`;
    const shareText = product ? `${product.name} - cek di GarnetaMart!` : 'Cek produk ini di GarnetaMart!';
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl });
      } catch {
        // User batal share, tidak perlu lakukan apa-apa.
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link produk disalin ke clipboard!');
      } catch {
        alert(`Bagikan link ini: ${shareUrl}`);
      }
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--card)', borderRadius: '20px', width: '100%', maxWidth: '480px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--dark)', fontSize: '16px' }}>🖼️ Detail Produk</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={handleShare} title="Bagikan produk ini" style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}>🔗</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✖</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Memuat detail produk...</p>
          )}

          {!isLoading && error && (
            <p style={{ textAlign: 'center', color: '#B91C1C', padding: '40px 0' }}>⚠️ {error}</p>
          )}

          {!isLoading && !error && product && (
            <div style={{ padding: '16px' }}>

              {/* Foto besar utama, klik untuk zoom penuh */}
              <div
                onClick={() => allPhotos.length > 0 && setIsZoomed(true)}
                style={{
                  width: '100%', aspectRatio: '1 / 1', background: 'var(--light)', borderRadius: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  cursor: allPhotos.length > 0 ? 'zoom-in' : 'default', marginBottom: '10px',
                }}
              >
                {allPhotos.length > 0 ? (
                  <img src={`${apiUrl}${allPhotos[activeIndex]}`} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '64px' }}>{product.image_url || '📦'}</span>
                )}
              </div>

              {/* Thumbnail strip, hanya tampil kalau ada lebih dari 1 foto */}
              {allPhotos.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
                  {allPhotos.map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveIndex(idx)}
                      style={{
                        flexShrink: 0, width: '56px', height: '56px', borderRadius: '10px', overflow: 'hidden',
                        border: idx === activeIndex ? '2px solid var(--primary)' : '1px solid var(--border)',
                        cursor: 'pointer', opacity: idx === activeIndex ? 1 : 0.7,
                      }}
                    >
                      <img src={`${apiUrl}${url}`} alt={`${product.name} ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Info produk */}
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '18px' }}>{product.name}</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--light)', padding: '2px 10px', borderRadius: '99px' }}>
                {product.category || 'Umum'}
              </span>

              {product.avg_rating && (
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>⭐ {product.avg_rating}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({product.review_count} ulasan)</span>
                </div>
              )}

              <div style={{ marginTop: '14px', fontSize: '22px', fontWeight: 'bold', color: 'var(--primary)' }}>
                {formatRp(selectedVariant ? selectedVariant.price : product.price)}
              </div>

              {product.variants && product.variants.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {product.variants.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      disabled={v.stock <= 0}
                      style={{
                        fontSize: '13px', fontWeight: '600', padding: '6px 14px', borderRadius: '99px',
                        border: selectedVariant && selectedVariant.id === v.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: selectedVariant && selectedVariant.id === v.id ? 'var(--primary)' : 'var(--light)',
                        color: selectedVariant && selectedVariant.id === v.id ? '#fff' : (v.stock <= 0 ? 'var(--text-muted)' : 'var(--text-main)'),
                        cursor: v.stock <= 0 ? 'not-allowed' : 'pointer',
                        opacity: v.stock <= 0 ? 0.5 : 1,
                      }}
                    >
                      {v.variant_name}{v.stock <= 0 ? ' (Habis)' : ''}
                    </button>
                  ))}
                </div>
              )}

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Sisa Stok: {selectedVariant ? selectedVariant.stock : product.stock}
              </p>

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '16px' }}
                disabled={selectedVariant ? selectedVariant.stock <= 0 : product.stock <= 0}
                onClick={() => {
                  const productToAdd = selectedVariant
                    ? { ...product, price: selectedVariant.price, stock: selectedVariant.stock, variant_id: selectedVariant.id, variant_name: selectedVariant.variant_name }
                    : product;
                  onAddToCart(productToAdd);
                  onClose();
                }}
              >
                <span>🛒</span> Tambahkan ke Keranjang
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mode Zoom Penuh: tampil full-screen, klik lagi untuk tutup */}
      {isZoomed && allPhotos.length > 0 && (
        <div
          onClick={() => setIsZoomed(false)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '20px' }}
        >
          <img
            src={`${apiUrl}${allPhotos[activeIndex]}`}
            alt={product?.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '24px', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer' }}
          >
            ✖
          </button>
        </div>
      )}
    </div>
  );
}

export default ProductGalleryModal;
