import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [printOrder, setPrintOrder] = useState(null);
  
  // State untuk Tambah Kurir Baru
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPin, setNewCourierPin] = useState('');
  
  // Modal State untuk Produk
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '', category: 'Umum', old_image_url: '' });
  const [imageFile, setImageFile] = useState(null);

  // Referensi untuk mendeteksi pesanan baru tanpa re-render
  const prevOrderCount = useRef(-1);

  const navigate = useNavigate();
  const userName = localStorage.getItem('garneta_user');
  const userRole = localStorage.getItem('garneta_role') || 'Admin';

  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchCouriers();

    // Radar pemantau 10 detik
    const interval = setInterval(() => {
      fetchOrders();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchOrders = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/orders`)
      .then(res => res.json())
      .then(result => { 
        if (result.success) {
          setOrders(result.data); 
          
          // Logika Alarm (Hanya bunyi jika pesanan bertambah dan bukan saat pertama kali muat)
          if (prevOrderCount.current !== -1 && result.data.length > prevOrderCount.current) {
            playNotificationSound();
          }
          prevOrderCount.current = result.data.length;
        } 
      })
      .catch(err => console.error(err));
  };

  const fetchProducts = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/products`)
      .then(res => res.json())
      .then(result => { if (result.success) setProducts(result.data); })
      .catch(err => console.error(err));
  };

  const fetchCouriers = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/couriers`)
      .then(res => res.json())
      .then(result => { if(result.success) setCouriers(result.data); })
      .catch(err => console.error(err));
  };

  const handleAddCourier = async (e) => {
    e.preventDefault();
    if(!newCourierName || !newCourierPin) return alert("Nama dan PIN wajib diisi");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/couriers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCourierName, pin: newCourierPin })
      });
      const result = await res.json();
      if(result.success) {
        setNewCourierName('');
        setNewCourierPin('');
        fetchCouriers();
        alert("Kurir berhasil didaftarkan!");
      } else {
        alert(result.message);
      }
    } catch(err) { alert("Server error"); }
  };

  const handleAssignCourier = async (orderId, courierId) => {
    if (!courierId) return alert("Silakan pilih nama kurir terlebih dahulu dari menu dropdown.");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier_id: courierId })
      });
      const result = await res.json();
      if (result.success) fetchOrders();
      else alert(result.message);
    } catch(err) { alert("Gagal menugaskan kurir."); }
  };

  const handleLogout = () => {
    localStorage.removeItem('garneta_token');
    localStorage.removeItem('garneta_user');
    localStorage.removeItem('garneta_role');
    navigate('/login');
  };

  // MESIN SINTESIS AUDIO (Tanpa file mp3)
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Beep 1
      const osc1 = audioCtx.createOscillator();
      const gainNode1 = audioCtx.createGain();
      osc1.connect(gainNode1);
      gainNode1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(800, audioCtx.currentTime); // Nada 800Hz
      gainNode1.gain.setValueAtTime(0.1, audioCtx.currentTime); // Volume 10%
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.1); // Durasi 0.1 detik
      
      // Beep 2 (Lebih tinggi)
      const osc2 = audioCtx.createOscillator();
      const gainNode2 = audioCtx.createGain();
      osc2.connect(gainNode2);
      gainNode2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2); // Nada 1200Hz
      gainNode2.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.2); // Volume 10%
      osc2.start(audioCtx.currentTime + 0.2);
      osc2.stop(audioCtx.currentTime + 0.3); // Durasi 0.1 detik
      
    } catch(e) {
      console.log("AudioContext tidak didukung atau diblokir browser");
    }
  };

  const handleUpdateOrderStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const result = await res.json();
      if (result.success) fetchOrders();
    } catch (err) {
      alert("Gagal merubah status pesanan");
    }
  };

  const handlePrint = (order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
      setPrintOrder(null);
    }, 500); // Tunggu sebentar agar render selesai
  };

  // FUNGSI EKSPOR CSV
  const exportToCSV = () => {
    const headers = ["ID Pesanan", "Waktu", "Nama Pelanggan", "No WA", "Alamat", "Status", "Total Bayar"];
    const rows = orders.map(o => [
      o.id,
      new Date(o.order_date).toLocaleString('id-ID').replace(/,/g, ''), // hindari koma dalam tanggal
      `"${o.customer_name}"`, // bungkus dengan kutip agar aman dari koma di nama
      `"${o.customer_phone}"`,
      `"${o.customer_address}"`,
      o.status || 'Baru',
      o.total_amount
    ]);
    
    // Gabungkan Header dan Baris
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\\n" 
      + rows.map(e => e.join(",")).join("\\n");
      
    // Paksa Unduh
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Penjualan_GarnetaMart.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', price: '', stock: '', category: 'Umum', old_image_url: '' });
    setImageFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingId(prod.id);
    setFormData({ name: prod.name, price: prod.price, stock: prod.stock, category: prod.category || 'Umum', old_image_url: prod.image_url });
    setImageFile(null); // Reset file yang mau diupload
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus produk ini?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/products/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) fetchProducts();
    } catch (err) {
      alert("Gagal menghapus produk");
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const url = editingId ? `${import.meta.env.VITE_API_URL}/api/products/${editingId}` : `${import.meta.env.VITE_API_URL}/api/products`;
    const method = editingId ? 'PUT' : 'POST';

    // Gunakan FormData karena kita mengirim file biner
    const fd = new FormData();
    fd.append('name', formData.name);
    fd.append('price', formData.price);
    fd.append('stock', formData.stock);
    fd.append('category', formData.category);
    if (editingId) fd.append('old_image_url', formData.old_image_url);
    if (imageFile) fd.append('image', imageFile);

    try {
      const res = await fetch(url, {
        method,
        body: fd // Tidak perlu Content-Type, browser akan mengaturnya otomatis ke multipart/form-data
      });
      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        fetchProducts(); // Refresh data
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("Gagal menyimpan data produk!");
    }
  };

  const getStatusBadge = (status) => {
    const s = status || 'Baru';
    if (s === 'Baru' || s === 'Menunggu Konfirmasi') return <span style={{ padding: '4px 10px', background: '#FEF08A', color: '#854D0E', borderRadius: '99px', fontSize: '13px', fontWeight: 'bold' }}>{s}</span>;
    if (s === 'Dikirim') return <span style={{ padding: '4px 10px', background: '#BFDBFE', color: '#1E40AF', borderRadius: '99px', fontSize: '13px', fontWeight: 'bold' }}>Dikirim</span>;
    if (s === 'Selesai') return <span style={{ padding: '4px 10px', background: '#BBF7D0', color: '#166534', borderRadius: '99px', fontSize: '13px', fontWeight: 'bold' }}>Selesai</span>;
    return <span>{s}</span>;
  };

  const renderProductImage = (url) => {
    if (!url) return <div style={{ fontSize: '24px' }}>📦</div>;
    if (url.startsWith('/uploads/')) {
      return <img src={`${import.meta.env.VITE_API_URL}${url}`} alt="Produk" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ddd' }} />;
    }
    return <div style={{ fontSize: '24px' }}>{url}</div>; // Untuk kasus emoji lama
  };

  const formatRp = (num) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);

  // LOGIKA PENGOLAHAN DATA GRAFIK OMZET
  const processChartData = () => {
    const dataMap = {};
    orders.forEach(order => {
      // Kita hitung semua pesanan (bisa juga di-filter yang selesai saja: if(order.status==='Selesai'))
      const date = new Date(order.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      if (!dataMap[date]) {
        dataMap[date] = { date: date, omzet: 0 };
      }
      dataMap[date].omzet += order.total_amount;
    });
    return Object.values(dataMap);
  };

  return (
      <div style={{ padding: '40px', background: 'var(--light)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '32px', color: 'var(--dark)' }}>Ruang Kerja Admin</h1>
            <p style={{ color: 'var(--text-muted)' }}>Selamat bertugas, {userName} <span style={{ padding: '2px 8px', background: userRole === 'Manajer' ? '#FEF08A' : '#BFDBFE', color: userRole === 'Manajer' ? '#854D0E' : '#1E40AF', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>{userRole}</span></p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {userRole === 'Manajer' && (
              <button onClick={exportToCSV} style={{ padding: '10px 20px', background: '#10B981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⬇️ Unduh Laporan (CSV)
              </button>
            )}
            <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
              Logout
            </button>
          </div>
        </div>

      {/* Navigasi Tab */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <button 
          onClick={() => setActiveTab('orders')}
          style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'orders' ? 'var(--primary)' : 'white', color: activeTab === 'orders' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
        >
          Pesanan Masuk
        </button>
        {userRole !== 'Kasir' && (
          <>
            <button 
              onClick={() => setActiveTab('products')}
              style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'products' ? 'var(--primary)' : 'white', color: activeTab === 'products' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              Manajemen Katalog
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'analytics' ? 'var(--primary)' : 'white', color: activeTab === 'analytics' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              📊 Analitik Bisnis
            </button>
            <button 
              onClick={() => setActiveTab('couriers')}
              style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'couriers' ? 'var(--primary)' : 'white', color: activeTab === 'couriers' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              🛵 Manajemen Kurir
            </button>
          </>
        )}
      </div>

      {/* TAMPILAN TAB PESANAN */}
      {activeTab === 'orders' && (
        <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginBottom: '20px' }}>Daftar Pesanan Terkini</h2>
          {orders.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Belum ada pesanan.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '16px' }}>ID Pesanan</th>
                  <th style={{ padding: '16px' }}>Waktu</th>
                  <th style={{ padding: '16px' }}>Nama Pelanggan</th>
                  <th style={{ padding: '16px' }}>Status</th>
                  <th style={{ padding: '16px' }}>Total Bayar</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Aksi Pengiriman</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>#{order.id}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(order.order_date).toLocaleString('id-ID')}</td>
                    <td style={{ padding: '16px' }}>
                      {order.customer_name}<br/>
                      <small style={{ color: 'var(--text-muted)' }}>{order.customer_phone}</small>
                    </td>
                    <td style={{ padding: '16px' }}>{getStatusBadge(order.status)}</td>
                    <td style={{ padding: '16px', color: 'var(--primary)', fontWeight: 'bold' }}>{formatRp(order.total_amount)}</td>
                    <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {(order.status === 'Baru' || order.status === 'Menunggu Konfirmasi' || !order.status) && (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <select 
                            id={`courier-select-${order.id}`}
                            style={{ padding: '6px', borderRadius: '8px', border: '1px solid var(--border)' }}
                          >
                            <option value="">-- Pilih Kurir --</option>
                            {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <button onClick={() => {
                            const cid = document.getElementById(`courier-select-${order.id}`).value;
                            handleAssignCourier(order.id, cid);
                          }} style={{ padding: '6px 12px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                            🛵 Tugaskan
                          </button>
                        </div>
                      )}
                      {order.status === 'Dikirim' && (
                        <button onClick={() => handleUpdateOrderStatus(order.id, 'Selesai')} style={{ padding: '6px 12px', background: '#22C55E', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                          ✅ Tandai Selesai
                        </button>
                      )}
                      <button onClick={() => {
                        const phone = order.customer_phone || "";
                        const waNum = phone.startsWith('0') ? '62' + phone.substring(1) : phone;
                        const msg = `Halo Kak ${order.customer_name}, pesanan Sembako Anda di GarnetaMart (Order #${order.id}) telah kami terima. Total tagihan: ${formatRp(order.total_amount)}. Apakah alamat pengirimannya sudah sesuai?`;
                        window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
                      }} style={{ padding: '6px 12px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        💬 Chat WA
                      </button>
                      <button onClick={() => handlePrint(order)} style={{ padding: '6px 12px', background: '#4B5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        🖨️ Cetak
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAMPILAN TAB PRODUK */}
      {activeTab === 'products' && (
        <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Katalog Produk</h2>
            <button onClick={openAddModal} className="btn btn-primary" style={{ width: 'auto' }}>
              + Tambah Barang Baru
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '16px' }}>Gambar</th>
                <th style={{ padding: '16px' }}>Nama Barang</th>
                <th style={{ padding: '16px' }}>Kategori</th>
                <th style={{ padding: '16px' }}>Harga</th>
                <th style={{ padding: '16px' }}>Stok</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map(prod => (
                <tr key={prod.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px' }}>{renderProductImage(prod.image_url)}</td>
                  <td style={{ padding: '16px', fontWeight: 'bold' }}>{prod.name}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ padding: '4px 8px', background: '#F3F4F6', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#4B5563' }}>
                      {prod.category || 'Umum'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--primary)' }}>{formatRp(prod.price)}</td>
                  <td style={{ padding: '16px' }}>{prod.stock}</td>
                  <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => openEditModal(prod)} style={{ padding: '6px 12px', background: '#EAB308', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                    <button onClick={() => handleDelete(prod.id)} style={{ padding: '6px 12px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAMPILAN TAB ANALITIK BISNIS */}
      {activeTab === 'analytics' && (
        <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginBottom: '20px' }}>Grafik Omzet Pendapatan 📈</h2>
          {orders.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Belum ada data untuk ditampilkan.</p> : (
            <div style={{ width: '100%', height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 14 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 14 }} tickFormatter={(value) => `Rp${value/1000}k`} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} formatter={(value) => formatRp(value)} labelStyle={{ fontWeight: 'bold', color: '#111827' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                  <Bar dataKey="omzet" fill="#3B82F6" radius={[8, 8, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* TAMPILAN TAB MANAJEMEN KURIR */}
      {activeTab === 'couriers' && (
        <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginBottom: '20px' }}>Daftar Kurir & Pendaftaran</h2>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <form onSubmit={handleAddCourier} style={{ background: '#F9FAFB', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>➕ Daftarkan Kurir Baru</h3>
                <input required type="text" placeholder="Nama Kurir (Misal: Budi)" value={newCourierName} onChange={e => setNewCourierName(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
                <input required type="text" placeholder="Buat PIN Rahasia (Misal: 123456)" value={newCourierPin} onChange={e => setNewCourierPin(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
                <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>Daftarkan Kurir</button>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>*Kurir dapat login melalui halaman <b>/kurir</b> menggunakan PIN rahasia ini.</p>
              </form>
            </div>
            <div style={{ flex: 2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '16px' }}>ID</th>
                    <th style={{ padding: '16px' }}>Nama Kurir</th>
                    <th style={{ padding: '16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.length === 0 ? (
                    <tr><td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada kurir terdaftar.</td></tr>
                  ) : (
                    couriers.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold' }}>#{c.id}</td>
                        <td style={{ padding: '16px' }}>{c.name}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ padding: '4px 10px', background: c.is_active ? '#BBF7D0' : '#FECACA', color: c.is_active ? '#166534' : '#991B1B', borderRadius: '99px', fontSize: '12px', fontWeight: 'bold' }}>
                            {c.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Produk */}
      {isModalOpen && (
        <div className="modal-overlay active" style={{ zIndex: 1000 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? "Edit Barang" : "Tambah Barang Baru"}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Nama Barang</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Harga (Rp)</label>
                <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Jumlah Stok</label>
                <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Kategori Produk</label>
                <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', background: 'white' }}>
                  <option value="Umum">Umum</option>
                  <option value="Sembako">Sembako</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Cemilan">Cemilan</option>
                  <option value="Kebutuhan Rumah">Kebutuhan Rumah</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                  File Gambar {editingId && "(Kosongkan jika tidak ingin mengubah)"}
                </label>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg, image/webp" 
                  onChange={e => setImageFile(e.target.files[0])} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', background: '#f9f9f9' }} 
                  required={!editingId} // Wajib isi gambar jika produk baru
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }}>
                Simpan Barang
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lembar Cetak Resi (Tersembunyi secara default) */}
      {printOrder && (
        <div id="print-section" style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'white', padding: '20px', zIndex: 9999, fontFamily: 'monospace', color: 'black' }}>
          <div style={{ border: '2px solid black', padding: '20px', borderRadius: '8px', maxWidth: '400px', margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', borderBottom: '2px dashed black', paddingBottom: '10px' }}>GARNETAMART</h2>
            <h3 style={{ textAlign: 'center', margin: '0 0 20px 0' }}>LABEL PENGIRIMAN</h3>
            
            <p style={{ margin: '5px 0' }}><strong>ID Pesanan:</strong> #{printOrder.id}</p>
            <p style={{ margin: '5px 0' }}><strong>Tanggal:</strong> {new Date(printOrder.order_date).toLocaleString('id-ID')}</p>
            
            <div style={{ marginTop: '20px', borderTop: '1px solid black', borderBottom: '1px solid black', padding: '10px 0' }}>
              <p style={{ margin: '5px 0', fontSize: '12px' }}><strong>TUJUAN:</strong></p>
              <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold' }}>{printOrder.customer_name}</p>
              <p style={{ margin: '5px 0', fontSize: '16px' }}>WA: {printOrder.customer_phone}</p>
              <p style={{ margin: '5px 0' }}>{printOrder.customer_address}</p>
            </div>
            
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <p style={{ margin: '5px 0' }}><strong>Total Tagihan:</strong></p>
              <h2 style={{ margin: '5px 0', fontSize: '24px' }}>{formatRp(printOrder.total_amount)}</h2>
              <p style={{ margin: '5px 0', fontSize: '12px', fontWeight: 'bold' }}>({printOrder.status || 'Baru'})</p>
            </div>
            
            <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#555' }}>
              <p>Terima kasih telah berbelanja di GarnetaMart.</p>
              <p>Harap periksa kelengkapan paket sebelum kurir pergi.</p>
            </div>
          </div>
        </div>
      )}

      {/* Style khusus untuk cetak */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #print-section, #print-section * {
              visibility: visible;
            }
            #print-section {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `}
      </style>
    </div>
  );
}

export default Dashboard;
