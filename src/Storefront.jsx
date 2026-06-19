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

  // State untuk Fitur Member
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loggedInCustomer, setLoggedInCustomer] = useState(null);

  // State untuk Peta & Ongkir
  const [deliveryCoords, setDeliveryCoords] = useState(STORE_COORDS);
  const [distanceKm, setDistanceKm] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [transportType, setTransportType] = useState('motor'); // 'motor' atau 'pickup'

  const smartCategories = [
    { name: 'Semua', icon: '🛒' },
    { name: 'Sembako', icon: '🌾' },
    { name: 'Minuman', icon: '🧃' },
    { name: 'Cemilan', icon: '🥨' },
    { name: 'Kebutuhan Rumah', icon: '🧼' },
    { name: 'Lainnya', icon: '📦' },
    { name: 'Umum', icon: '🛍️' }
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
  const filteredProducts = products.filter(product => {
    const matchCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
    const matchSearch = (product.name || "").toLowerCase().includes((searchTerm || "").toLowerCase());
    return matchCategory && matchSearch;
  });

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
        // RAKIT PESAN WHATSAPP
        const transportLabel = transportType === 'motor' ? '🛵 Motor / Obrok (Kapasitas Sedang)' : '🛻 Mobil Pick-up (Partai Besar)';
        
        let waText = `Halo GarnetaMart! 👋\nSaya ingin memproses pesanan saya (ID: #${result.order_id}):\n\n📦 DAFTAR BELANJA:\n`;
        cartItems.forEach(c => {
          waText += `- ${c.qty}x ${c.item.name} (${formatRp(c.item.price)})\n`;
        });
        waText += `\nSubtotal: ${formatRp(subtotal)}`;
        if (discountAmount > 0) waText += `\nDiskon (${appliedPromo}): -${formatRp(discountAmount)}`;
        waText += `\nOngkir (${distanceKm.toFixed(1)} Km): ${formatRp(finalShipping)}${shippingDiscount > 0 ? ` (Diskon ${appliedPromo})` : ''}`;
        waText += `\n💰 TOTAL BAYAR: ${formatRp(grandTotal)}\n\n`;
        waText += `📍 DATA PENGIRIMAN:\nNama: ${customerInfo.name}\nNo WA: ${customerInfo.phone}\nAlamat: ${customerInfo.address}\nArmada: ${transportLabel}\nKoordinat GPS: https://www.google.com/maps/search/?api=1&query=${deliveryCoords.lat},${deliveryCoords.lng}\n\nTolong segera diproses ya! Terima kasih!`;

        const encodedText = encodeURIComponent(waText);
        const waUrl = `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodedText}`;

        alert("🎉 Pesanan tersimpan! Anda akan diarahkan ke WhatsApp untuk konfirmasi.");
        window.open(waUrl, '_blank'); // Buka WA di tab baru

        setCart({});
        setCustomerInfo({ name: '', address: '', phone: '' });
        setAppliedPromo('');
        setPromoInput('');
        setDistanceKm(0);
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: '20px', cursor: 'pointer', padding: '8px 12px', borderRadius: '99px', display: 'flex', alignItems: 'center', color: 'var(--text-main)' }}
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
          {/* ETALASE KATEGORI PINTAR */}
          <div className="smart-categories" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
            {smartCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '90px',
                  padding: '12px 8px',
                  borderRadius: '20px',
                  border: selectedCategory === cat.name ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: selectedCategory === cat.name ? 'var(--card)' : 'transparent',
                  cursor: 'pointer',
                  transition: '0.2s',
                  boxShadow: selectedCategory === cat.name ? '0 8px 16px rgba(16,185,129,0.15)' : 'none',
                  transform: selectedCategory === cat.name ? 'translateY(-2px)' : 'none'
                }}
              >
                <div style={{ background: selectedCategory === cat.name ? '#D1FAE5' : 'var(--card)', padding: '12px', borderRadius: '50%', marginBottom: '8px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px' }}>
                  <span style={{ fontSize: '24px' }}>{cat.icon}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: selectedCategory === cat.name ? 'var(--primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
                  <div className="product-image-container" style={{ width: '100%', aspectRatio: '1 / 1', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={`${import.meta.env.VITE_API_URL}${product.image_url}`} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
                onClick={handleCheckout} 
                style={{ marginTop: '24px', opacity: distanceKm === 0 ? 0.5 : 1, cursor: distanceKm === 0 ? 'not-allowed' : 'pointer' }}
              >
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
