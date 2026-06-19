import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import CustomerAuth from './CustomerAuth';

// Fix Leaflet Default Icon in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// PENGATURAN TOKO
const STORE_COORDS = { lat: -7.8309995, lng: 110.3894513 }; // Giwangan, Yogyakarta

// 🎟️ DAFTAR KODE VOUCHER (Bisa diganti/ditambah oleh pemilik toko kapan saja)
const DAFTAR_PROMO = {
  // 'SULTAN10': { tipe: 'persen', nilai: 0.1, min_belanja: 0, pesan: 'Sukses! Diskon 10%' },
  // 'SUPER50': { tipe: 'nominal', nilai: 50000, min_belanja: 200000, pesan: 'Sukses! Potongan Rp50.000' },
  // 'GRATISONGKIR': { tipe: 'ongkir', nilai: 0, min_belanja: 50000, pesan: 'Sukses! Bebas Ongkir' }
};

// KOMPONEN PETA UNTUK MENDETEKSI KLIK (Dipindah ke luar App untuk mencegah infinite render)
function LocationMarker({ position, setPosition, onPositionChange }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onPositionChange(e.latlng);
    },
  });
  return <Marker position={position}></Marker>;
}

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [activeBanners, setActiveBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Status User
  const [loggedInCustomer, setLoggedInCustomer] = useState(null);

  // State untuk Peta & Ongkir
  const [deliveryCoords, setDeliveryCoords] = useState(STORE_COORDS);
  const [distanceKm, setDistanceKm] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [transportType, setTransportType] = useState('motor'); // 'motor' atau 'pickup'
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' atau 'qris'
  const [showQrisModal, setShowQrisModal] = useState(false);

  const smartCategories = [
    { name: 'Semua', icon: '🏪' },
    { name: 'Grosir / Partai Besar', icon: '📦' },
    { name: 'Sedang Laris', icon: '🔥' },
    { name: 'Sembako', icon: '🍚' },
    { name: 'Sayur & Buah', icon: '🥬' },
    { name: 'Snack & Minum', icon: '🥤' },
    { name: 'Bumbu Dapur', icon: '🧂' },
    { name: 'Kebersihan', icon: '🧼' },
    { name: 'Lainnya', icon: '🛒' }
  ];

  const ratePerKm = transportType === 'motor' ? 2500 : 5000;

  // SINKRONISASI TEMA GELAP (DARK MODE)
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('garneta_darkmode', isDarkMode);
  }, [isDarkMode]);

  // CAROUSEL TIMER
  useEffect(() => {
    if (showPromoPopup && activeBanners.length > 1) {
      const timer = setInterval(() => {
        setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length);
      }, 3000); // Ganti gambar tiap 3 detik
      return () => clearInterval(timer);
    }
  }, [showPromoPopup, activeBanners.length]);

  // CEK LOGIN MEMBER SAAT PERTAMA KALI MUAT
  useEffect(() => {
    const savedCustomer = localStorage.getItem('garneta_customer');
    if (savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer);
        setLoggedInCustomer(parsed);
        setCustomerInfo({ name: parsed.name, address: parsed.address, phone: parsed.phone });
      } catch (e) {}
    }
  }, []);

  // MENGAMBIL DATA DARI BACKEND
  useEffect(() => {
    // Fetch Products
    fetch(`${import.meta.env.VITE_API_URL}/api/products`)
      .then(res => res.json())
      .then(result => {
        if (result.success) setProducts(result.data);
      })
      .catch(err => console.error("Gagal nyambung ke Backend:", err))
      .finally(() => setIsLoading(false));

    // Fetch Banners
    fetch(`${import.meta.env.VITE_API_URL}/api/banners`)
      .then(res => res.json())
      .then(result => {
        if(result.success && result.data) {
          const actives = result.data.filter(b => b.is_active);
          setActiveBanners(actives);
          if (actives.length > 0) {
            setShowPromoPopup(true);
          }
        }
      })
      .catch(err => console.error(err));
  }, []);

  // Update ongkir otomatis jika jarak atau jenis armada berubah
  useEffect(() => {
    if (distanceKm > 0) {
      setShippingCost(Math.ceil(distanceKm) * ratePerKm);
    }
  }, [distanceKm, transportType, ratePerKm]);

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
      if (promo.tipe === 'ongkir') shippingDiscount = shippingCost;
    }
  }

  const finalShipping = shippingCost - shippingDiscount;
  const grandTotal = subtotal - discountAmount + finalShipping;

  // LOGIKA PENCARIAN & FILTER KATEGORI
  let filteredProducts = products.filter(product => {
    if (selectedCategory === 'Sedang Laris') return true; // Tampilkan semua dulu, nanti diurutkan
    const matchCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
    const matchSearch = (product.name || "").toLowerCase().includes((searchTerm || "").toLowerCase());
    return matchCategory && matchSearch;
  });

  // LOGIKA KHUSUS KATEGORI TERLARIS
  if (selectedCategory === 'Sedang Laris') {
    filteredProducts = filteredProducts
      .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))
      .slice(0, 5); // Ambil Top 5 paling banyak dibeli
  }

  // KONSTANTA NOMOR WA ADMIN
  const ADMIN_WA_NUMBER = "6285123871118";

  // FUNGSI MENGHITUNG JARAK VIA OSRM API (GRATIS)
  const calculateDistance = async (targetCoords) => {
    setIsCalculatingDistance(true);
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${STORE_COORDS.lng},${STORE_COORDS.lat};${targetCoords.lng},${targetCoords.lat}?overview=false`;
      const res = await fetch(osrmUrl);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const distanceMeters = data.routes[0].distance;
        let km = distanceMeters / 1000;
        if (km < 1) km = 1; // Minimal 1 Km
        setDistanceKm(km);
      }
    } catch (err) {
      console.error("OSRM Error:", err);
      alert("Gagal menghitung jarak otomatis. Pastikan internet lancar.");
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // MENGIRIM PESANAN KE BACKEND
  const handleCheckout = async () => {
    if (!customerInfo.name || !customerInfo.address || !customerInfo.phone) {
      alert("Harap isi Nama, Alamat, dan No HP!");
      return;
    }

    if (distanceKm === 0) {
      alert("Harap tentukan lokasi pengiriman di Peta untuk menghitung ongkir!");
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
          shipping_fee: finalShipping,
          transport_type: transportType,
          customer_id: loggedInCustomer ? loggedInCustomer.id : null,
          cart_items: cartItems
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setCart({});
        setShowQrisModal(false);
        const waNum = ADMIN_WA_NUMBER;
        
        let paymentText = paymentMethod === 'qris' 
          ? `Metode Pembayaran: *QRIS*\n_Saya akan melampirkan bukti transfer di pesan ini._` 
          : `Metode Pembayaran: *Bayar Tunai (COD)*`;

        let text = `Halo GarnetaMart! Saya mau pesan barang ini:\n\n`;
        cartItems.forEach(c => {
          text += `- ${c.item.name} (${c.qty}x) = Rp${(c.item.price * c.qty)}\n`;
        });
        text += `\nSubtotal: Rp${subtotal}`;
        if (discountAmount > 0) text += `\nDiskon Promo: -Rp${discountAmount}`;
        text += `\nOngkir (${distanceKm.toFixed(1)}Km): Rp${finalShipping}`;
        text += `\n*TOTAL: Rp${grandTotal}*\n`;
        text += `\nDikirim ke: ${customerInfo.name} - ${customerInfo.address}\n`;
        text += `\n${paymentText}`;

        const url = `https://wa.me/${waNum}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        alert("Pesanan berhasil dibuat! Silakan lanjut di WhatsApp.");
      } else {
        alert("Gagal membuat pesanan: " + result.message);
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan.");
    }
  };

  return (
    <>
      <nav className="navbar" style={{ gap: '16px', flexWrap: 'wrap' }}>
        <div className="brand" style={{ fontSize: '24px' }}>Garneta<span>Mart</span></div>
        
        {/* KOLOM PENCARIAN DI NAVBAR */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            placeholder="🔍 Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 16px', borderRadius: '99px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', background: 'var(--light)', color: 'var(--text-main)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: '18px', cursor: 'pointer', padding: '8px 12px', borderRadius: '99px', display: 'flex', alignItems: 'center', color: 'var(--text-main)' }}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          {loggedInCustomer ? (
            <button
              onClick={() => {
                if(window.confirm("Yakin ingin Keluar (Logout)?")) {
                  localStorage.removeItem('garneta_customer');
                  setLoggedInCustomer(null);
                  setCustomerInfo({ name: '', address: '', phone: '' });
                }
              }}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', padding: '8px 16px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              👤 {loggedInCustomer.name.split(' ')[0]}
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              style={{ background: 'var(--card)', color: 'var(--primary)', border: '1px solid var(--primary)', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', padding: '8px 16px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Masuk
            </button>
          )}
        </div>
      </nav>

      {/* PROMO POPUP MODAL (CAROUSEL) */}
      {showPromoPopup && activeBanners.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'fadeInUp 0.3s ease-out' }}>
            <button 
              onClick={() => setShowPromoPopup(false)}
              style={{ position: 'absolute', top: '-40px', right: '0', background: 'transparent', border: 'none', color: 'white', fontSize: '32px', cursor: 'pointer', zIndex: 10 }}
            >
              &times;
            </button>
            <div style={{ overflow: 'hidden', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', position: 'relative' }}>
              <div style={{ display: 'flex', transition: 'transform 0.5s ease-in-out', transform: `translateX(-${currentBannerIndex * 100}%)` }}>
                {activeBanners.map((b, idx) => (
                  <img 
                    key={b.id || idx}
                    src={b.image_url.startsWith('http') ? b.image_url : `${import.meta.env.VITE_API_URL}${b.image_url}`} 
                    alt={`Promo ${idx + 1}`} 
                    style={{ width: '100%', flexShrink: 0, objectFit: 'cover', display: 'block' }} 
                  />
                ))}
              </div>
              
              {/* Indikator Titik (Dots) */}
              {activeBanners.length > 1 && (
                <div style={{ position: 'absolute', bottom: '12px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                  {activeBanners.map((_, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        width: idx === currentBannerIndex ? '20px' : '8px', 
                        height: '8px', 
                        borderRadius: '99px', 
                        background: idx === currentBannerIndex ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
                        transition: 'all 0.3s'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="container" style={{ padding: '0 16px', paddingTop: '20px' }}>
        {/* ETALASE KATEGORI PINTAR */}
        <div style={{ marginBottom: '20px', background: 'var(--card)', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div className="shopee-categories">
            {smartCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className="category-btn"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: selectedCategory === cat.name ? 1 : 0.7,
                }}
              >
                <div style={{ background: selectedCategory === cat.name ? '#D1FAE5' : 'var(--light)', border: selectedCategory === cat.name ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', marginBottom: '6px', transition: '0.2s' }}>
                  <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                </div>
                <span style={{ fontSize: '10px', color: selectedCategory === cat.name ? 'var(--primary)' : 'var(--text-main)', textAlign: 'center', lineHeight: '1.2' }}>
                  {cat.name}
                </span>
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
                  <div className="product-image-container" style={{ width: '100%', aspectRatio: '1 / 1', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <img 
                      src={`${import.meta.env.VITE_API_URL}${product.image_url}`} 
                      alt={product.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="product-icon-fallback" style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '60px', background: '#F3F4F6', color: '#9CA3AF' }}>📦</div>
                  </div>
                ) : (
                  <div className="product-icon">{product.image_url || '📦'}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 className="product-name" style={{ margin: 0 }}>{product.name}</h3>
                  <span style={{ fontSize: '10px', background: '#F3F4F6', padding: '4px 6px', borderRadius: '4px', color: '#4B5563', fontWeight: 'bold' }}>{product.category || 'Umum'}</span>
                </div>
                {product.sales_count > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#F59E0B', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      👑 Terlaris <span style={{ letterSpacing: '2px' }}>⭐⭐⭐⭐⭐</span> ({product.sales_count} terjual)
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

      {/* POP-UP MODAL QRIS */}
      {showQrisModal && (
        <div className="modal-overlay active" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '10px', color: '#1D4ED8' }}>Pembayaran QRIS</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Silakan scan atau simpan gambar QRIS di bawah ini untuk melakukan pembayaran sebesar <strong>{formatRp(grandTotal)}</strong>
            </p>
            
            <div style={{ border: '4px solid #1D4ED8', borderRadius: '12px', padding: '10px', background: 'white', display: 'inline-block' }}>
              <img 
                src={`${import.meta.env.VITE_API_URL}/uploads/qris.jpg`} 
                alt="QRIS GarnetaMart" 
                style={{ width: '250px', height: '250px', objectFit: 'contain' }} 
                onError={(e) => { e.target.src = 'https://via.placeholder.com/250x250?text=QRIS+Belum+Diatur' }}
              />
            </div>

            <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', padding: '12px', borderRadius: '8px', marginTop: '20px' }}>
              <strong style={{ color: '#B91C1C', display: 'block', marginBottom: '4px' }}>⚠️ PERINGATAN KEAMANAN</strong>
              <span style={{ color: '#991B1B', fontSize: '12px' }}>
                Pastikan nama penerima di aplikasi M-Banking Anda adalah <strong>TOKO GARNETA</strong>. Jika namanya berbeda, JANGAN LAKUKAN TRANSFER!
              </span>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => handleCheckout(true)} 
              style={{ width: '100%', padding: '16px', fontSize: '16px', marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              📸 Saya Sudah Transfer (Lanjut ke WA)
            </button>
            <button 
              onClick={() => setShowQrisModal(false)} 
              style={{ width: '100%', padding: '12px', fontSize: '14px', marginTop: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Kembali
            </button>
          </div>
        </div>
      )}

      {/* POPUP PROMO BANNERS */}
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

              {/* Formulir Pengiriman dengan Peta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Nama Penerima"
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: loggedInCustomer ? '#E5E7EB' : 'transparent', color: 'var(--text-main)' }}
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  disabled={!!loggedInCustomer}
                />
                <input
                  type="text"
                  placeholder="Alamat Lengkap (Jl, RT/RW, Patokan)"
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: loggedInCustomer ? '#E5E7EB' : 'transparent', color: 'var(--text-main)' }}
                  value={customerInfo.address}
                  onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  disabled={!!loggedInCustomer}
                />
                <input
                  type="text"
                  placeholder="No WhatsApp"
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: loggedInCustomer ? '#E5E7EB' : 'transparent', color: 'var(--text-main)' }}
                  value={customerInfo.phone}
                  onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  disabled={!!loggedInCustomer}
                />
                {loggedInCustomer && <p style={{ fontSize: '12px', color: 'var(--secondary)', margin: '0' }}>✅ Menggunakan data member (Otomatis)</p>}
              </div>

              {/* Opsi Kendaraan */}
              <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'var(--card)' }}>
                <h4 style={{ marginBottom: '12px' }}>🚚 Pilih Armada Pengiriman</h4>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <label style={{ flex: 1, padding: '12px', border: transportType === 'motor' ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: transportType === 'motor' ? 'var(--light)' : 'transparent', color: transportType === 'motor' ? 'var(--primary)' : 'var(--text-main)', transition: 'all 0.2s' }}>
                    <input type="radio" name="transport" value="motor" checked={transportType === 'motor'} onChange={() => setTransportType('motor')} style={{ display: 'none' }} />
                    <span style={{ fontSize: '24px' }}>🛵</span>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Motor / Obrok</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kapasitas Sedang</div>
                    </div>
                  </label>
                  <label style={{ flex: 1, padding: '12px', border: transportType === 'pickup' ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: transportType === 'pickup' ? 'var(--light)' : 'transparent', color: transportType === 'pickup' ? 'var(--primary)' : 'var(--text-main)', transition: 'all 0.2s' }}>
                    <input type="radio" name="transport" value="pickup" checked={transportType === 'pickup'} onChange={() => setTransportType('pickup')} style={{ display: 'none' }} />
                    <span style={{ fontSize: '24px' }}>🛻</span>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Mobil Pick-up</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Partai Besar</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Opsi Metode Pembayaran */}
              <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', border: '1px solid #10B981', background: 'var(--card)' }}>
                <h4 style={{ marginBottom: '12px' }}>💳 Metode Pembayaran</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ padding: '12px', border: paymentMethod === 'cod' ? '2px solid #10B981' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: paymentMethod === 'cod' ? '#ECFDF5' : 'transparent', transition: 'all 0.2s' }}>
                    <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} style={{ width: '18px', height: '18px', accentColor: '#10B981' }} />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#047857' }}>💵 Bayar Tunai (COD)</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bayar langsung ke kurir saat barang sampai</div>
                    </div>
                  </label>
                  <label style={{ padding: '12px', border: paymentMethod === 'qris' ? '2px solid #3B82F6' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: paymentMethod === 'qris' ? '#EFF6FF' : 'transparent', transition: 'all 0.2s' }}>
                    <input type="radio" name="payment" value="qris" checked={paymentMethod === 'qris'} onChange={() => setPaymentMethod('qris')} style={{ width: '18px', height: '18px', accentColor: '#3B82F6' }} />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#1D4ED8' }}>📱 Transfer QRIS (Bebas Biaya)</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gopay, OVO, ShopeePay, M-Banking</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Peta Lokasi */}
              <div style={{ marginTop: '20px', marginBottom: '10px', background: 'var(--card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: '8px' }}>📍 Tandai Titik Peta Pengiriman</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Klik peta untuk menandai rumah Anda. Mesin akan menghitung jarak otomatis (Tarif saat ini: Rp {formatRp(ratePerKm)}/Km).
                </p>
                <div style={{ height: '220px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--primary)', zIndex: 0, position: 'relative' }}>
                  <MapContainer center={STORE_COORDS} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                    <LocationMarker position={deliveryCoords} setPosition={setDeliveryCoords} onPositionChange={calculateDistance} />
                  </MapContainer>
                </div>
                {distanceKm > 0 ? (
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FEF3C7', padding: '12px', borderRadius: '8px', color: '#92400E' }}>
                    <div style={{ fontWeight: 'bold' }}>Jarak: {distanceKm.toFixed(1)} Km</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Ongkir: {formatRp(shippingCost)}</div>
                  </div>
                ) : (
                  <div style={{ marginTop: '12px', textAlign: 'center', color: '#EF4444', fontWeight: 'bold', fontSize: '14px' }}>
                    Mohon klik peta di atas untuk memunculkan tarif ongkir!
                  </div>
                )}
                {isCalculatingDistance && <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '4px' }}>⏳ Menghitung rute...</div>}
              </div>

              {/* Peringatan Ongkir untuk Motor */}
              {transportType === 'motor' && (
                <div style={{ marginBottom: '20px', padding: '12px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <div>
                    <strong>Catatan Penting:</strong> Pilihan armada di atas adalah estimasi. Jika armada yang Anda pilih tidak muat untuk membawa barang belanjaan Anda, ongkos kirim akan <strong>disesuaikan kembali</strong> oleh Admin kami melalui WhatsApp.
                  </div>
                </div>
              )}

              {transportType === 'pickup' && (
                <div style={{ marginBottom: '20px', padding: '12px', borderRadius: '8px', background: '#FEF3C7', color: '#92400E', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px' }}>💪</span>
                  <div>
                    <strong>Info Bongkar Muatan:</strong> Untuk pengiriman via Pick-up dengan volume/jumlah sangat banyak, pembeli diharapkan <strong>turut serta membongkar muatan sendiri</strong>. Jika tidak memungkinkan, silakan bernegosiasi biaya jasa bongkar secara langsung dengan supir/kurir di lokasi.
                  </div>
                </div>
              )}

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
                  <span>Ongkos Kirim ({distanceKm.toFixed(1)} Km)</span>
                  <span style={{ textDecoration: shippingDiscount > 0 ? 'line-through' : 'none' }}>{formatRp(shippingCost)}</span>
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

              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (paymentMethod === 'qris') {
                    if (!customerInfo.name || !customerInfo.address || !customerInfo.phone) {
                      alert("Harap isi Nama, Alamat, dan No HP!");
                      return;
                    }
                    if (distanceKm === 0) {
                      alert("Harap tentukan lokasi pengiriman di Peta!");
                      return;
                    }
                    setShowQrisModal(true);
                  } else {
                    handleCheckout();
                  }
                }}
                style={{ marginTop: '24px', opacity: distanceKm === 0 ? 0.5 : 1, cursor: distanceKm === 0 ? 'not-allowed' : 'pointer' }}
              >
                {paymentMethod === 'qris' ? '📱 Lanjut ke Pembayaran QRIS' : 'Kirim Pesanan Sekarang'}
              </button>
            </>
          )}
        </div>
      </div>

      {isAuthModalOpen && (
        <CustomerAuth 
          onClose={() => setIsAuthModalOpen(false)} 
          onLoginSuccess={(customer) => {
            setLoggedInCustomer(customer);
            setCustomerInfo({ name: customer.name, address: customer.address, phone: customer.phone });
            setIsAuthModalOpen(false);
          }}
        />
      )}
    </>
  );
}

export default App;
