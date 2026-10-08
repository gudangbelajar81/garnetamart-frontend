import { useState, useEffect } from 'react';

// Komponen admin untuk kelola varian produk (Fase 2 #5), misal "5kg" / "10kg" dengan harga & stok masing-masing.
// Hanya aktif saat produk sudah ada ID-nya (mode edit), karena CRUD varian butuh productId.
function ProductVariantManager({ productId, authHeader }) {
  const [variants, setVariants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Form tambah varian baru
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('');

  // State untuk edit inline varian yang sudah ada
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL;

  function fetchVariants() {
    setIsLoading(true);
    fetch(`${apiUrl}/api/products/${productId}/variants`)
      .then(res => res.json())
      .then(result => {
        if (result.success) setVariants(result.data || []);
      })
      .catch(() => setError('Gagal memuat varian.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (productId) fetchVariants();
  }, [productId]);

  async function handleAddVariant(e) {
    e.preventDefault();
    if (!newName.trim() || newPrice === '' || newStock === '') {
      alert('Nama varian, harga, dan stok wajib diisi.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ variant_name: newName.trim(), price: Number(newPrice), stock: Number(newStock) })
      });
      const result = await res.json();
      if (result.success) {
        setNewName(''); setNewPrice(''); setNewStock('');
        fetchVariants();
      } else {
        setError(result.message || 'Gagal menambah varian.');
      }
    } catch {
      setError('Gagal menambah varian.');
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(v) {
    setEditingVariantId(v.id);
    setEditName(v.variant_name);
    setEditPrice(String(v.price));
    setEditStock(String(v.stock));
  }

  function cancelEdit() {
    setEditingVariantId(null);
  }

  async function handleSaveEdit(variantId) {
    if (!editName.trim() || editPrice === '' || editStock === '') {
      alert('Nama varian, harga, dan stok wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/variants/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ variant_name: editName.trim(), price: Number(editPrice), stock: Number(editStock) })
      });
      const result = await res.json();
      if (result.success) {
        setEditingVariantId(null);
        fetchVariants();
      } else {
        alert(result.message || 'Gagal memperbarui varian.');
      }
    } catch {
      alert('Gagal memperbarui varian.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(variantId) {
    if (!window.confirm('Hapus varian ini? Tindakan tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch(`${apiUrl}/api/variants/${variantId}`, {
        method: 'DELETE',
        headers: { ...authHeader }
      });
      const result = await res.json();
      if (result.success) {
        setVariants(prev => prev.filter(v => v.id !== variantId));
      } else {
        alert(result.message || 'Gagal menghapus varian.');
      }
    } catch {
      alert('Gagal menghapus varian.');
    }
  }

  return (
    <div style={{ marginTop: '16px', padding: '12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
      <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', margin: '0 0 8px 0' }}>
        🧩 Varian Produk (opsional) <span style={{ fontWeight: 'normal', color: '#6B7280' }}>— contoh: 1kg / 5kg / 10kg, masing-masing harga &amp; stok sendiri</span>
      </p>

      {error && <p style={{ fontSize: '12px', color: '#EF4444', margin: '0 0 8px 0' }}>{error}</p>}
      {isLoading && <p style={{ fontSize: '12px', color: '#6B7280' }}>Memuat varian...</p>}

      {!isLoading && variants.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {variants.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '6px 8px' }}>
              {editingVariantId === v.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nama varian" style={{ flex: 1, fontSize: '12px', padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                  <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" placeholder="Harga" style={{ width: '90px', fontSize: '12px', padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                  <input value={editStock} onChange={e => setEditStock(e.target.value)} type="number" placeholder="Stok" style={{ width: '70px', fontSize: '12px', padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                  <button type="button" disabled={isSaving} onClick={() => handleSaveEdit(v.id)} style={{ fontSize: '12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>Simpan</button>
                  <button type="button" onClick={cancelEdit} style={{ fontSize: '12px', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>Batal</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{v.variant_name}</span>
                  <span style={{ fontSize: '12px', color: '#374151' }}>Rp {Number(v.price).toLocaleString('id-ID')}</span>
                  <span style={{ fontSize: '12px', color: v.stock > 0 ? '#6B7280' : '#EF4444' }}>Stok: {v.stock}</span>
                  <button type="button" onClick={() => startEdit(v)} style={{ fontSize: '12px', background: '#EFF6FF', color: '#1D4ED8', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>Edit</button>
                  <button type="button" onClick={() => handleDelete(v.id)} style={{ fontSize: '12px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>Hapus</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddVariant} style={{ display: 'flex', gap: '6px' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nama varian (cth: 5kg)" style={{ flex: 1, fontSize: '12px', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
        <input value={newPrice} onChange={e => setNewPrice(e.target.value)} type="number" placeholder="Harga" style={{ width: '90px', fontSize: '12px', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
        <input value={newStock} onChange={e => setNewStock(e.target.value)} type="number" placeholder="Stok" style={{ width: '70px', fontSize: '12px', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
        <button type="submit" disabled={isSaving} style={{ fontSize: '12px', fontWeight: 'bold', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 14px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}>
          {isSaving ? '...' : '+ Tambah'}
        </button>
      </form>
    </div>
  );
}

export default ProductVariantManager;
