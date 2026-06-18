import { useState, useEffect } from 'react';

const SHIPPING_COST = 10000;

// 🎟️ DAFTAR KODE VOUCHER (Bisa diganti/ditambah oleh pemilik toko kapan saja)
const DAFTAR_PROMO = {
  // 'SULTAN10': { tipe: 'persen', nilai: 0.1, min_belanja: 0, pesan: 'Sukses! Diskon 10%' },
  // 'SUPER50': { tipe: 'nominal', nilai: 50000, min_belanja: 200000, pesan: 'Sukses! Potongan Rp50.000' },
  // 'GRATISONGKIR': { tipe: 'ongkir', nilai: 0, min_belanja: 50000, pesan: 'Sukses! Bebas Ongkir' }
  // 'MERDEKA20': { tipe: 'nominal', nilai: 200000, min_belanja: 0, pesan: 'Selamat! Diskon Rp20.000' }

};

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', address: '', phone: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('garneta_darkmode') === 'true');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');

  const categories = ['Semua', 'Sembako', 'Minuman', 'Cemilan', 'Kebutuhan Rumah', 'Lainnya', 'Umum'];

  // SINKRONISASI TEMA GELAP (DARK MODE)
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('garneta_darkmode', isDarkMode);
  }, [isDarkMode]);

  // MENGAMBIL DATA DARI BACKEND (Gudang XAMPP)
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/products`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setProducts(result.data);
        }
      })
      .catch(err => console.error("Gagal nyambung ke Backend:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const formatRp = (num) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev[product.id];
      if (existing) {
        return { ...prev, [product.id]: { ...existing, qty: existing.qty + 1 } };
      }
      return { ...prev, [product.id]: { item: product, qty: 1 } };
    });
  };

  const cartItems = Object.values(cart);
  const totalItems = cartItems.reduce((sum, c) => sum + c.qty, 0);
  const subtotal = cartItems.reduce((sum, c) => sum + (c.item.price * c.qty), 0);

  // LOGIKA DISKON MARKETING DINAMIS
  let discountAmount = 0;
  let shippingDiscount = 0;

  if (appliedPromo && DAFTAR_PROMO[appliedPromo]) {
    const promo = DAFTAR_PROMO[appliedPromo];
    if (subtotal >= promo.min_belanja) {
      if (promo.tipe === 'persen') discountAmount = subtotal * promo.nilai;
      if (promo.tipe === 'nominal') discountAmount = promo.nilai;
      if (promo.tipe === 'ongkir') shippingDiscount = SHIPPING_COST;
    }
  }

  const finalShipping = SHIPPING_COST - shippingDiscount;
  const grandTotal = subtotal - discountAmount + finalShipping;

  // LOGIKA PENCARIAN & FILTER KATEGORI
  const filteredProducts = products.filter(product => {
    const matchCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
    const matchSearch = (product.name || "").toLowerCase().includes((searchTerm || "").toLowerCase());
    return matchCategory && matchSearch;
  });

  // KONSTANTA NOMOR WA ADMIN
  const ADMIN_WA_NUMBER = "6285123871118";

  // MENGIRIM PESANAN KE BACKEND
  const handleCheckout = async () => {
    if (!customerInfo.name || !customerInfo.address || !customerInfo.phone) {
      alert("Harap isi Nama, Alamat, dan No HP!");
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerInfo.name,
          customer_address: customerInfo.address,
          customer_phone: customerInfo.phone,
          total_amount: grandTotal,
          cart_items: cartItems
        })
      });

      const result = await response.json();

      if (result.success) {
        // RAKIT PESAN WHATSAPP
        let waText = `Halo GarnetaMart! 👋\nSaya ingin memproses pesanan saya (ID: #${result.order_id}):\n\n📦 DAFTAR BELANJA:\n`;
        cartItems.forEach(c => {
          waText += `- ${c.qty}x ${c.item.name} (${formatRp(c.item.price)})\n`;
        });
        waText += `\nSubtotal: ${formatRp(subtotal)}`;
        if (discountAmount > 0) waText += `\nDiskon (${appliedPromo}): -${formatRp(discountAmount)}`;
        waText += `\nOngkir: ${formatRp(finalShipping)}${shippingDiscount > 0 ? ` (Diskon ${appliedPromo})` : ''}`;
        waText += `\n💰 TOTAL BAYAR: ${formatRp(grandTotal)}\n\n`;
        waText += `📍 DATA PENGIRIMAN:\nNama: ${customerInfo.name}\nNo WA: ${customerInfo.phone}\nAlamat: ${customerInfo.address}\n\nTolong segera diproses ya! Terima kasih!`;

        const encodedText = encodeURIComponent(waText);
        const waUrl = `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodedText}`;

        alert("🎉 Pesanan tersimpan! Anda akan diarahkan ke WhatsApp untuk konfirmasi.");
        window.open(waUrl, '_blank'); // Buka WA di tab baru

        setCart({});
        setCustomerInfo({ name: '', address: '', phone: '' });
        setAppliedPromo('');
        setPromoInput('');
        setIsModalOpen(false);
      } else {
        alert("Gagal: " + result.message);
      }
    } catch (error) {
      alert("Server Backend sedang mati! Nyalakan dulu server.js nya.");
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="brand">Garneta<span>Mart</span></div>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: '20px', cursor: 'pointer', padding: '8px 12px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}
        >
          {isDarkMode ? '☀️ Mode Terang' : '🌙 Mode Gelap'}
        </button>
      </nav>

      <header className="hero">
        <h1>Grosir Cepat, Tiba Sekejap.</h1>
        <p>Solusi belanja grosir untuk Cafe, Rumah Makan, dan Ibu Rumah Tangga. Pilih barang Anda, kami antar hari ini juga.</p>
      </header>

      <main className="container">
        {/* BAR PENCARIAN & KATEGORI */}
        <div style={{ marginBottom: '30px', background: 'var(--card)', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="🔍 Cari nama barang di sini (Misal: Roti)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid var(--primary)', fontSize: '16px', marginBottom: '16px', outline: 'none', background: 'transparent', color: 'var(--text-main)' }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '99px',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  background: selectedCategory === cat ? 'var(--primary)' : 'transparent',
                  color: selectedCategory === cat ? 'white' : 'var(--text-muted)',
                  border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border)',
                  transition: '0.2s'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <h2 className="section-title">
          {searchTerm ? `Hasil Pencarian: "${searchTerm}"` : `Katalog ${selectedCategory}`}
          {isLoading && " (Sedang memuat...)"}
        </h2>

        {filteredProducts.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <h3>Barang tidak ditemukan 😔</h3>
            <p>Coba gunakan kata kunci lain atau pilih kategori "Semua".</p>
          </div>
        )}

        <div className="product-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <div>
                {product.image_url && product.image_url.startsWith('/uploads/') ? (
                  <div className="product-image-container" style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                    <img src={`${import.meta.env.VITE_API_URL}${product.image_url}`} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div className="product-icon">{product.image_url || '📦'}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 className="product-name" style={{ margin: 0 }}>{product.name}</h3>
                  <span style={{ fontSize: '10px', background: '#F3F4F6', padding: '4px 6px', borderRadius: '4px', color: '#4B5563', fontWeight: 'bold' }}>{product.category || 'Umum'}</span>
                </div>
                {product.stock < 20 && (
                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#F59E0B', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      👑 Terlaris <span style={{ letterSpacing: '2px' }}>⭐⭐⭐⭐⭐</span> (100+ terjual)
                    </span>
                  </div>
                )}
                <p className="product-desc" style={{ marginTop: '8px' }}>Sisa Stok: {product.stock}</p>
              </div>
              <div style={{ marginTop: '20px' }}>
                <div className="product-price">{formatRp(product.price)}</div>
                <button className="btn btn-primary" onClick={() => addToCart(product)}>
                  <span>🛒</span> Tambahkan
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <div className="floating-cart" onClick={() => setIsModalOpen(true)}>
        🛒 Keranjang <span className="cart-badge">{totalItems}</span>
      </div>

      {/* Modal Checkout */}
      <div className={`modal-overlay ${isModalOpen ? 'active' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h2>Pesanan Anda</h2>
            <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
          </div>

          {cartItems.length === 0 ? (
            <div className="empty-state">
              <h3>Keranjang Kosong</h3>
              <p>Silakan pilih barang terlebih dahulu.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                {cartItems.map(c => (
                  <div key={c.item.id} className="cart-item">
                    <div className="cart-item-info">
                      <h4>{c.item.name}</h4>
                      <p>{c.qty} x {formatRp(c.item.price)}</p>
                    </div>
                    <div className="cart-item-total">
                      {formatRp(c.item.price * c.qty)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Total Barang</span>
                  <span>{formatRp(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="summary-row" style={{ color: 'var(--primary)' }}>
                    <span>Diskon ({appliedPromo})</span>
                    <span>-{formatRp(discountAmount)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span>Ongkos Kirim (Flat)</span>
                  <span style={{ textDecoration: shippingDiscount > 0 ? 'line-through' : 'none' }}>{formatRp(SHIPPING_COST)}</span>
                </div>
                {shippingDiscount > 0 && (
                  <div className="summary-row" style={{ color: 'var(--primary)' }}>
                    <span>Diskon Ongkir</span>
                    <span>-{formatRp(shippingDiscount)}</span>
                  </div>
                )}
                <div className="summary-total">
                  <span>Total Bayar</span>
                  <span>{formatRp(grandTotal)}</span>
                </div>
              </div>

              {/* Promo Input */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Kode Voucher (Contoh: SUPER50)"
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', textTransform: 'uppercase' }}
                  value={promoInput}
                  onChange={e => setPromoInput(e.target.value)}
                />
                <button onClick={() => {
                  const upperCode = promoInput.toUpperCase();
                  if (DAFTAR_PROMO[upperCode]) {
                    const promo = DAFTAR_PROMO[upperCode];
                    if (subtotal >= promo.min_belanja) {
                      setAppliedPromo(upperCode);
                      alert(promo.pesan);
                    } else {
                      setAppliedPromo('');
                      alert(`Gagal: Minimal belanja untuk kode ini adalah ${formatRp(promo.min_belanja)}`);
                    }
                  } else {
                    setAppliedPromo('');
                    alert('Kode Voucher tidak valid!');
                  }
                }} style={{ padding: '0 16px', background: 'var(--dark)', color: 'var(--light)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Gunakan
                </button>
              </div>

              {/* Formulir Pengiriman */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                <input
                  type="text"
                  placeholder="Nama Penerima"
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)' }}
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Alamat Lengkap"
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)' }}
                  value={customerInfo.address}
                  onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="No WhatsApp"
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)' }}
                  value={customerInfo.phone}
                  onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                />
              </div>

              <button className="btn btn-primary" onClick={handleCheckout} style={{ marginTop: '24px' }}>
                Kirim Pesanan Sekarang
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
