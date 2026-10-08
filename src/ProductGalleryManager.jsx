import { useState, useEffect } from 'react';

// Komponen admin untuk kelola galeri foto tambahan produk (Fase 2 #4).
// Hanya aktif saat produk sudah ada ID-nya (mode edit), karena upload butuh productId.
function ProductGalleryManager({ productId, authHeader }) {
  const [gallery, setGallery] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL;

  function fetchGallery() {
    setIsLoading(true);
    fetch(`${apiUrl}/api/products/${productId}/detail`)
      .then(res => res.json())
      .then(result => {
        if (result.success) setGallery(result.data.gallery || []);
      })
      .catch(() => setError('Gagal memuat galeri.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (productId) fetchGallery();
  }, [productId]);

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (gallery.length + files.length > 5) {
      alert(`Maksimal 5 foto galeri per produk. Saat ini sudah ada ${gallery.length} foto.`);
      e.target.value = '';
      return;
    }
    setIsUploading(true);
    setError('');
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('images', f));
      const res = await fetch(`${apiUrl}/api/products/${productId}/images`, {
        method: 'POST',
        headers: authHeader(),
        body: fd,
      });
      const result = await res.json();
      if (result.success) {
        fetchGallery();
      } else {
        setError(result.message || 'Gagal mengunggah foto.');
      }
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(imageId) {
    if (!confirm('Hapus foto ini dari galeri?')) return;
    try {
      const res = await fetch(`${apiUrl}/api/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      const result = await res.json();
      if (result.success) {
        setGallery(prev => prev.filter(g => g.id !== imageId));
      } else {
        alert(result.message || 'Gagal menghapus foto.');
      }
    } catch {
      alert('Gagal terhubung ke server.');
    }
  }

  return (
    <div style={{ background: '#F9FAFB', borderRadius: '10px', padding: '12px', border: '1px solid #E5E7EB' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
        🖼️ Galeri Foto Tambahan (maks. 5 foto)
      </label>

      {isLoading && <p style={{ fontSize: '12px', color: '#6B7280' }}>Memuat galeri...</p>}
      {error && <p style={{ fontSize: '12px', color: '#B91C1C' }}>⚠️ {error}</p>}

      {!isLoading && gallery.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {gallery.map(img => (
            <div key={img.id} style={{ position: 'relative', width: '64px', height: '64px' }}>
              <img
                src={`${apiUrl}${img.image_url}`}
                alt="Galeri produk"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #D1D5DB' }}
              />
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', lineHeight: 1 }}
              >
                ✖
              </button>
            </div>
          ))}
        </div>
      )}

      {gallery.length < 5 && (
        <label style={{ display: 'inline-block', fontSize: '12px', fontWeight: 'bold', color: '#1D4ED8', background: '#EFF6FF', border: '1px dashed #60A5FA', borderRadius: '8px', padding: '8px 14px', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.6 : 1 }}>
          {isUploading ? 'Mengunggah...' : `+ Tambah Foto (sisa ${5 - gallery.length})`}
          <input
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            multiple
            onChange={handleUpload}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
        </label>
      )}
    </div>
  );
}

export default ProductGalleryManager;
