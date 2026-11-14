import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import ProductGalleryManager from './ProductGalleryManager';
import ProductVariantManager from './ProductVariantManager';
import LiveTrackingModal from './LiveTrackingModal';
import { printReceiptBluetooth } from './utils/bluetoothPrinter';
import DigitalInvoiceModal from './DigitalInvoiceModal';

// Helper: bentuk header Authorization dari token admin yang tersimpan di localStorage.
// Dipakai di semua fetch() yang menghantam endpoint terproteksi verifyAdminToken/verifyStaffToken.
function authHeader() {
  const token = localStorage.getItem('garneta_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Dipanggil saat backend membalas 401 (token tidak ada/kedaluwarsa) atau 403 (bukan token admin).
// Bersihkan sesi lokal lalu lempar balik ke halaman login supaya admin tidak bingung lihat error mentah.
function forceLogoutIfUnauthorized(status) {
  if (status === 401 || status === 403) {
    localStorage.removeItem('garneta_token');
    localStorage.removeItem('garneta_user');
    localStorage.removeItem('garneta_role');
    alert('Sesi login sudah berakhir. Silakan login kembali.');
    window.location.href = '/login';
    return true;
  }
  return false;
}

function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [printOrder, setPrintOrder] = useState(null);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [printingOrderId, setPrintingOrderId] = useState(null);
  const [invoiceModalOrderId, setInvoiceModalOrderId] = useState(null);
  
  // State untuk Tambah Kurir Baru
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPin, setNewCourierPin] = useState('');
  
  // Modal State untuk Produk
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '', category: 'Umum', old_image_url: '' });
  const [imageFile, setImageFile] = useState(null);

  // State untuk Pengaturan Toko (Banner)
  const [banners, setBanners] = useState([]);
  const [bannerFile, setBannerFile] = useState(null);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // State untuk Notifikasi Suara
  const [alarmType, setAlarmType] = useState(localStorage.getItem('garneta_alarm_type') || 'default');
  const [alarmTtsText, setAlarmTtsText] = useState(localStorage.getItem('garneta_alarm_tts') || 'Ada pesanan bos');
  const [alarmAudioFile, setAlarmAudioFile] = useState(null);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false); // Fase 3 #1: alarm looping sampai admin acknowledge
  const alarmLoopRef = useRef(null);
  const originalTitleRef = useRef(document.title);
  const [isUploadingAlarm, setIsUploadingAlarm] = useState(false);

  // State untuk PIN QRIS (Fitur Ketukan Rahasia)
  const QRIS_PIN = '111016'; // ← PIN RAHASIA ANDA (6 DIGIT)
  const [qrisPinVerified, setQrisPinVerified] = useState(false);
  const [qrisPinInput, setQrisPinInput] = useState('');
  const [qrisPinError, setQrisPinError] = useState(false);
  const [showQrisSection, setShowQrisSection] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const secretTapTimer = useRef(null);

  // Fase 4: State Pengaturan Pembayaran & Midtrans
  const [paymentSettings, setPaymentSettings] = useState({
    midtrans_enabled: 0,
    midtrans_client_key: '',
    midtrans_merchant_id: '',
    midtrans_server_key: '',
    midtrans_is_production: 0,
    qris_manual_enabled: 1,
    loyalty_point_rate: 100
  });
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [showServerKey, setShowServerKey] = useState(false);

  // Fase 4: State Voucher & Promo
  const [promos, setPromos] = useState([]);
  const [newPromo, setNewPromo] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    min_order: 0,
    max_discount: '',
    usage_limit: 100
  });
  const [isSubmittingPromo, setIsSubmittingPromo] = useState(false);

  // Fase 4: State Advanced Analytics
  const [advancedAnalytics, setAdvancedAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const handleSecretTap = () => {
    const newCount = secretTapCount + 1;
    setSecretTapCount(newCount);
    clearTimeout(secretTapTimer.current);
    if (newCount >= 5) {
      setShowQrisSection(true);
      setSecretTapCount(0);
    } else {
      secretTapTimer.current = setTimeout(() => setSecretTapCount(0), 1500);
    }
  };

  // Referensi untuk mendeteksi pesanan baru tanpa re-render
  const prevOrderCount = useRef(-1);

  const navigate = useNavigate();
  const userName = localStorage.getItem('garneta_user');
  const userRole = localStorage.getItem('garneta_role') || 'Admin';

  // Auto-hide panel QRIS rahasia setelah 30 detik tanpa aktivitas
  useEffect(() => {
    let timeout;
    if (showQrisSection) {
      timeout = setTimeout(() => {
        setShowQrisSection(false);
        setQrisPinVerified(false);
        setQrisPinInput('');
      }, 30000); // 30 detik
    }
    return () => clearTimeout(timeout);
  }, [showQrisSection, qrisPinInput]);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchCouriers();
    fetchBanners();
    fetchPaymentSettings();
    fetchPromos();
    fetchAdvancedAnalytics();

    // Radar pemantau 10 detik
    const interval = setInterval(() => {
      fetchOrders();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Fase 3 #1: judul tab browser berkedip "🔔 PESANAN BARU!" selagi alarm masih berbunyi,
  // supaya ketahuan dari tab manapun admin lagi buka (tanpa harus lihat tab Dashboard).
  useEffect(() => {
    if (!isAlarmRinging) return;
    let flashOn = true;
    const flashInterval = setInterval(() => {
      document.title = flashOn ? '🔔 PESANAN BARU!' : originalTitleRef.current;
      flashOn = !flashOn;
    }, 1000);
    return () => {
      clearInterval(flashInterval);
      document.title = originalTitleRef.current;
    };
  }, [isAlarmRinging]);

  const fetchBanners = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/banners`)
      .then(res => res.json())
      .then(result => {
        if(result.success) setBanners(result.data);
      })
      .catch(err => console.error(err));
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (!bannerFile) return;
    if (banners.length >= 10) return alert("Maksimal 10 banner. Harap hapus banner lama terlebih dahulu.");

    setIsSavingBanner(true);
    const formData = new FormData();
    formData.append('image', bannerFile);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/banners`, {
        method: 'POST',
        headers: authHeader(),
        body: formData
      });
      const result = await res.json();
      if(result.success) {
        alert("Banner berhasil diunggah!");
        setBannerFile(null);
        fetchBanners();
      } else {
        alert("Gagal: " + result.message);
      }
    } catch(err) {
      alert("Terjadi kesalahan koneksi saat mengunggah banner.");
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt) return alert("Deskripsi (Prompt) AI harus diisi!");
    if (banners.length >= 10) return alert("Maksimal 10 banner. Harap hapus banner lama terlebih dahulu.");

    setIsGeneratingAi(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/banners/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const result = await res.json();
      if(result.success) {
        alert("Banner AI berhasil dibuat dan ditambahkan!");
        setAiPrompt('');
        fetchBanners();
      } else {
        alert("Gagal membuat banner AI: " + result.message);
      }
    } catch (err) {
      alert("Terjadi kesalahan saat memanggil AI.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleToggleBanner = async (id, currentStatus) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchBanners();
    } catch (err) {
      alert("Gagal mengubah status banner.");
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm("Yakin ingin menghapus banner ini?")) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/banners/${id}`, { method: 'DELETE', headers: authHeader() });
      fetchBanners();
    } catch (err) {
      alert("Gagal menghapus banner.");
    }
  };

  const fetchOrders = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/orders`, { headers: authHeader() })
      .then(res => {
        if (forceLogoutIfUnauthorized(res.status)) return Promise.reject('unauthorized');
        return res.json();
      })
      .then(result => { 
        if (result.success) {
          setOrders(result.data); 
          
          // Logika Alarm (Hanya bunyi jika pesanan bertambah dan bukan saat pertama kali muat)
          if (prevOrderCount.current !== -1 && result.data.length > prevOrderCount.current) {
            startAlarmLoop();
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
    fetch(`${import.meta.env.VITE_API_URL}/api/couriers`, { headers: authHeader() })
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
        headers: { 'Content-Type': 'application/json', ...authHeader() },
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
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ courier_id: courierId })
      });
      const result = await res.json();
      if (result.success) fetchOrders();
      else alert(result.message);
    } catch(err) { alert("Gagal menugaskan kurir."); }
  };

  // Fase 3 #6: Auto-Assign Kurir Otomatis (Least-Loaded / Nearest)
  const handleAutoAssignCourier = async (orderId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/auto-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() }
      });
      const result = await res.json();
      if (result.success) {
        alert(`✅ ${result.message}`);
        fetchOrders();
      } else {
        alert(`⚠️ ${result.message || 'Gagal auto-assign kurir'}`);
      }
    } catch(err) {
      alert("Gagal melakukan auto-assign kurir.");
    }
  };

  // Fase 3 #5: Cetak Struk Bluetooth POS Thermal dari Admin
  const handlePrintReceiptAdmin = async (order) => {
    setPrintingOrderId(order.id);
    try {
      const res = await printReceiptBluetooth(order, order.items || []);
      if (res.success) {
        alert(`✅ Struk Order #${order.id} berhasil dicetak ke Printer Bluetooth!`);
      } else {
        alert(`⚠️ Gagal mencetak: ${res.error || 'Periksa koneksi printer Bluetooth'}`);
      }
    } catch(err) {
      alert(`⚠️ Error cetak: ${err.message}`);
    } finally {
      setPrintingOrderId(null);
    }
  };

  // Fase 4: Handlers Pengaturan Pembayaran & Midtrans
  const fetchPaymentSettings = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/settings/payment`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setPaymentSettings(result.data);
        }
      })
      .catch(err => console.error('Error fetching payment settings:', err));
  };

  const handleSavePaymentSettings = async (e) => {
    e.preventDefault();
    setIsSavingPayment(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/settings/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(paymentSettings)
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Pengaturan pembayaran & Midtrans berhasil disimpan!");
        fetchPaymentSettings();
      } else {
        alert("Gagal: " + (data.message || 'Error'));
      }
    } catch (err) {
      alert("Terjadi kesalahan saat menyimpan pengaturan pembayaran.");
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Fase 4: Handlers Voucher & Promo
  const fetchPromos = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/promo`, { headers: authHeader() })
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setPromos(result.data);
        }
      })
      .catch(err => console.error('Error fetching promos:', err));
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    if (!newPromo.code || !newPromo.discount_value) {
      return alert("Kode voucher dan nilai diskon wajib diisi!");
    }
    setIsSubmittingPromo(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(newPromo)
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Voucher promo baru berhasil dibuat!");
        setNewPromo({
          code: '',
          discount_type: 'percent',
          discount_value: '',
          min_order: 0,
          max_discount: '',
          usage_limit: 100
        });
        fetchPromos();
      } else {
        alert("Gagal: " + (data.message || 'Error'));
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi saat membuat promo.");
    } finally {
      setIsSubmittingPromo(false);
    }
  };

  const handleTogglePromo = async (id, currentStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/promo/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
      });
      const data = await res.json();
      if (data.success) {
        fetchPromos();
      } else {
        alert("Gagal: " + (data.message || 'Error'));
      }
    } catch (err) {
      alert("Gagal mengubah status promo.");
    }
  };

  const handleDeletePromo = async (id) => {
    if (!window.confirm("Yakin ingin menghapus voucher ini?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/promo/${id}`, {
        method: 'DELETE',
        headers: authHeader()
      });
      const data = await res.json();
      if (data.success) {
        fetchPromos();
      } else {
        alert("Gagal: " + (data.message || 'Error'));
      }
    } catch (err) {
      alert("Gagal menghapus promo.");
    }
  };

  // Fase 4: Handlers Advanced Analytics
  const fetchAdvancedAnalytics = () => {
    setIsLoadingAnalytics(true);
    fetch(`${import.meta.env.VITE_API_URL}/api/analytics/advanced`, { headers: authHeader() })
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setAdvancedAnalytics(result.data);
        }
      })
      .catch(err => console.error('Error fetching advanced analytics:', err))
      .finally(() => setIsLoadingAnalytics(false));
  };

  const handleLogout = () => {
    localStorage.removeItem('garneta_token');
    localStorage.removeItem('garneta_user');
    localStorage.removeItem('garneta_role');
    navigate('/login');
  };

  // MESIN SINTESIS AUDIO (Notifikasi Fleksibel)
  // Fase 3 #1: Alarm multi-suara yang REPEAT terus-menerus tiap 5 detik sampai admin
  // klik "Sudah Dengar, Berhenti" — supaya pesanan tidak terlewat kalau admin lagi di ruangan lain.
  const startAlarmLoop = () => {
    if (alarmLoopRef.current) return; // Sudah berbunyi, jangan tumpuk interval baru
    setIsAlarmRinging(true);
    playNotificationSound();
    alarmLoopRef.current = setInterval(() => {
      playNotificationSound();
    }, 5000);
  };

  const stopAlarmLoop = () => {
    if (alarmLoopRef.current) {
      clearInterval(alarmLoopRef.current);
      alarmLoopRef.current = null;
    }
    setIsAlarmRinging(false);
    document.title = originalTitleRef.current;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const playNotificationSound = () => {
    const type = localStorage.getItem('garneta_alarm_type') || 'default';
    
    if (type === 'tts') {
      const text = localStorage.getItem('garneta_alarm_tts') || 'Ada pesanan bos';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID'; // Bahasa Indonesia
      window.speechSynthesis.speak(utterance);
      return;
    } else if (type === 'audio') {
      const audioUrl = `${import.meta.env.VITE_API_URL}/uploads/alarm.mp3`;
      const audio = new Audio(audioUrl);
      audio.play().catch(e => {
        console.log("Custom audio diblokir atau tidak ada, menggunakan suara default", e);
        playDefaultSound();
      });
      return;
    }
    
    playDefaultSound();
  };

  const playDefaultSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const playTone = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle'; 
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      // Nada Ting-Tong
      playTone(659.25, now, 0.5); // Mi
      playTone(523.25, now + 0.3, 0.8); // Do
      
    } catch(e) {
      console.log("AudioContext tidak didukung atau diblokir browser");
    }
  };

  const handleUpdateOrderStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/products/${id}`, { method: 'DELETE', headers: authHeader() });
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
        headers: authHeader(),
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

  // HANDLERS UNTUK ALARM NOTIFIKASI
  const handleUploadAlarmAudio = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingAlarm(true);
    const fd = new FormData();
    fd.append('audio', file);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/upload-alarm`, {
        method: 'POST',
        headers: authHeader(),
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        setAlarmAudioFile(data.audio_url);
        setAlarmType('audio');
        localStorage.setItem('garneta_alarm_type', 'audio');
        alert("Suara custom berhasil diunggah dan diaktifkan!");
        setTimeout(() => playNotificationSound(), 500); // Test play
      } else {
        alert("Gagal: " + data.message);
      }
    } catch(err) {
      alert("Error upload file audio.");
    } finally {
      setIsUploadingAlarm(false);
    }
  };

  const handleSaveTts = (e) => {
    const val = e.target.value;
    setAlarmTtsText(val);
    localStorage.setItem('garneta_alarm_tts', val);
  };
  
  const handleTypeChange = (e) => {
    const val = e.target.value;
    setAlarmType(val);
    localStorage.setItem('garneta_alarm_type', val);
    if (val !== 'default') {
      setTimeout(() => playNotificationSound(), 100);
    }
  };

  // LOGIKA PENGOLAHAN DATA GRAFIK OMZET
  const handleUploadQris = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/upload-qris`, {
        method: 'POST',
        headers: authHeader(),
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert('Gambar QRIS berhasil diperbarui!');
        window.location.reload();
      } else {
        alert('Gagal mengupload QRIS');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan saat upload QRIS');
    }
  };

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
    <>
      {/* Fase 3 #1: Banner alarm pesanan baru - tetap tampil & berkedip selama belum di-acknowledge admin */}
      {isAlarmRinging && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 999, background: '#DC2626', color: '#fff',
          padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)', animation: 'pulse 1s infinite'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '15px' }}>🔔 Ada Pesanan Baru Masuk! Segera cek daftar pesanan di bawah.</span>
          <button
            onClick={stopAlarmLoop}
            style={{ background: '#fff', color: '#DC2626', border: 'none', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
          >
            Sudah Dengar, Berhenti
          </button>
        </div>
      )}
      <div style={{ padding: '40px', background: 'var(--light)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '32px', color: 'var(--dark)' }}>Ruang Kerja Admin</h1>
            <p style={{ color: 'var(--text-muted)' }}>Selamat bertugas, {userName} <span style={{ padding: '2px 8px', background: userRole === 'Manajer' ? '#FEF08A' : '#BFDBFE', color: userRole === 'Manajer' ? '#854D0E' : '#1E40AF', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>{userRole}</span></p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => { playNotificationSound(); alert("Notifikasi Suara Aktif! Biarkan halaman ini tetap terbuka agar sistem berbunyi saat ada pesanan masuk."); }} 
              style={{ padding: '10px 16px', background: '#FEF3C7', border: '1px solid #F59E0B', color: '#D97706', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Klik untuk menguji suara alarm"
            >
              🔔 Tes Alarm
            </button>
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
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('orders')}
          style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'orders' ? 'var(--primary)' : 'white', color: activeTab === 'orders' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
        >
          📦 Pesanan Masuk
        </button>
        {userRole !== 'Kasir' && (
          <>
            <button 
              onClick={() => setActiveTab('products')}
              style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'products' ? 'var(--primary)' : 'white', color: activeTab === 'products' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              🛒 Katalog Produk
            </button>
            <button 
              onClick={() => { setActiveTab('analytics'); fetchAdvancedAnalytics(); }}
              style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'analytics' ? 'var(--primary)' : 'white', color: activeTab === 'analytics' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              📊 Analitik & Jam Sibuk
            </button>
            <button 
              onClick={() => { setActiveTab('payment'); fetchPaymentSettings(); }}
              style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'payment' ? 'var(--primary)' : 'white', color: activeTab === 'payment' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              💳 Pembayaran & Midtrans
            </button>
            <button 
              onClick={() => { setActiveTab('promos'); fetchPromos(); }}
              style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'promos' ? 'var(--primary)' : 'white', color: activeTab === 'promos' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              🏷️ Voucher Promo
            </button>
            <button 
              onClick={() => setActiveTab('couriers')}
              style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'couriers' ? 'var(--primary)' : 'white', color: activeTab === 'couriers' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              🛵 Manajemen Kurir
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'settings' ? 'var(--primary)' : 'white', color: activeTab === 'settings' ? 'white' : 'var(--dark)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
            >
              ⚙️ Pengaturan Toko
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
                    <td style={{ padding: '16px' }}>
                      <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{formatRp(order.total_amount)}</div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: order.payment_method === 'midtrans' ? '#DBEAFE' : order.payment_method === 'qris_manual' ? '#DCFCE7' : '#FEF3C7', color: order.payment_method === 'midtrans' ? '#1E40AF' : order.payment_method === 'qris_manual' ? '#166534' : '#92400E', fontWeight: 'bold' }}>
                          {order.payment_method === 'midtrans' ? '💳 Midtrans' : order.payment_method === 'qris_manual' ? '📱 QRIS' : '💵 COD'}
                        </span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: order.payment_status === 'paid' ? '#DCFCE7' : order.payment_status === 'pending' ? '#FEF3C7' : '#F3F4F6', color: order.payment_status === 'paid' ? '#166534' : order.payment_status === 'pending' ? '#92400E' : '#6B7280', fontWeight: 'bold' }}>
                          {order.payment_status === 'paid' ? 'Lunas' : order.payment_status === 'pending' ? 'Pending' : 'Unpaid'}
                        </span>
                      </div>
                      {order.discount_amount > 0 && (
                        <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>
                          Diskon: -{formatRp(order.discount_amount)}
                        </div>
                      )}
                      {order.points_used > 0 && (
                        <div style={{ fontSize: '11px', color: '#F59E0B', marginTop: '2px' }}>
                          Poin: -{formatRp(order.points_used)}
                        </div>
                      )}
                    </td>
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
                          <button
                            type="button"
                            onClick={() => handleAutoAssignCourier(order.id)}
                            title="Tugaskan otomatis ke kurir aktif paling senggang / terdekat"
                            style={{ padding: '6px 10px', background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                          >
                            ⚡ Auto
                          </button>
                        </div>
                      )}
                      {(order.courier_id || order.status === 'Sedang Diantar' || order.status === 'Dikirim') && (
                        <button
                          type="button"
                          onClick={() => setTrackingOrderId(order.id)}
                          title="Lacak posisi GPS kurir real-time di peta"
                          style={{ padding: '6px 12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          🗺️ Lacak
                        </button>
                      )}
                      {order.status === 'Dikirim' && (
                        <button onClick={() => handleUpdateOrderStatus(order.id, 'Selesai')} style={{ padding: '6px 12px', background: '#22C55E', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                          ✅ Tandai Selesai
                        </button>
                      )}
                      {order.status === 'Selesai' && order.proof_of_delivery && (
                        <button onClick={() => window.open(`${import.meta.env.VITE_API_URL}${order.proof_of_delivery}`, '_blank')} style={{ padding: '6px 12px', background: '#8B5CF6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                          📸 Lihat Bukti
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
                      <button
                        type="button"
                        onClick={() => setInvoiceModalOrderId(order.id)}
                        title="Buka / Cetak Invoice Kuitansi Digital Resmi"
                        style={{ padding: '6px 12px', background: '#6366F1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        🧾 Invoice
                      </button>
                      <button onClick={() => handlePrint(order)} style={{ padding: '6px 12px', background: '#4B5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        🖨️ Cetak
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintReceiptAdmin(order)}
                        disabled={printingOrderId === order.id}
                        title="Cetak langsung ke Printer Thermal Bluetooth 58mm"
                        style={{ padding: '6px 12px', background: printingOrderId === order.id ? '#9CA3AF' : '#0D9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        {printingOrderId === order.id ? '⏳ Cetak...' : '🖨️ BT POS'}
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

      {/* TAMPILAN TAB ANALITIK BISNIS & JAM SIBUK */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* KPI Summary Cards */}
          {advancedAnalytics?.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Total Pesanan</p>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '26px', color: 'var(--dark)' }}>{advancedAnalytics.summary.total_orders}</h3>
                <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 'bold' }}>Semua transaksi</span>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Omzet Kotor</p>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '24px', color: 'var(--primary)' }}>{formatRp(advancedAnalytics.summary.gross_revenue)}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Akumulasi omzet</span>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Rata-rata Pesanan (AOV)</p>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '24px', color: '#8B5CF6' }}>{formatRp(advancedAnalytics.summary.aov)}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nilai keranjang belanja</span>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Total Diskon Diberikan</p>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '24px', color: '#EF4444' }}>{formatRp(advancedAnalytics.summary.total_discounts)}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Voucher & potongan</span>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Poin Reward Diberikan</p>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '24px', color: '#F59E0B' }}>{advancedAnalytics.summary.total_points_given}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loyalty points</span>
              </div>
            </div>
          )}

          {/* Grafik Omzet Harian */}
          <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <h2 style={{ marginBottom: '20px' }}>Grafik Omzet Harian 📈</h2>
            {orders.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Belum ada data untuk ditampilkan.</p> : (
              <div style={{ width: '100%', height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 13 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 13 }} tickFormatter={(value) => `Rp${value/1000}k`} />
                    <Tooltip cursor={{ fill: '#F3F4F6' }} formatter={(value) => formatRp(value)} labelStyle={{ fontWeight: 'bold', color: '#111827' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                    <Bar dataKey="omzet" fill="#3B82F6" radius={[8, 8, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Grafik Jam Sibuk (Peak Hours) & Split Metode Pembayaran */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Jam Sibuk (Hourly Peak) */}
            <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--dark)' }}>⏰ Jam Sibuk Toko (Hourly Peak)</h3>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                Distribusi waktu pesanan masuk dalam 24 jam untuk optimasi shift kurir dan packing.
              </p>
              <div style={{ width: '100%', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={advancedAnalytics?.hourly_peak || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#FEF3C7' }} formatter={(val) => [`${val} Pesanan`, 'Pesanan Masuk']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="orders_count" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Metode Pembayaran Breakdown */}
            <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--dark)' }}>💳 Metode Pembayaran</h3>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                Pilihan cara bayar pelanggan.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(!advancedAnalytics?.payment_breakdown || advancedAnalytics.payment_breakdown.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Belum ada data pembayaran.</p>
                ) : (
                  advancedAnalytics.payment_breakdown.map((pb, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          {pb.payment_method === 'midtrans' ? '💳 Midtrans' : pb.payment_method === 'qris_manual' ? '📱 QRIS Manual' : pb.payment_method === 'cod' ? '💵 COD' : pb.payment_method}
                        </span>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{formatRp(pb.total_revenue || 0)}</small>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {pb.count} pesanan
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Top 10 Produk Terlaris */}
          <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--dark)' }}>🏆 10 Produk Terlaris (Berdasarkan Omzet)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <th style={{ padding: '12px' }}>Peringkat</th>
                  <th style={{ padding: '12px' }}>Nama Produk</th>
                  <th style={{ padding: '12px' }}>Terjual</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Total Omzet Produk</th>
                </tr>
              </thead>
              <tbody>
                {(!advancedAnalytics?.top_products || advancedAnalytics.top_products.length === 0) ? (
                  <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data produk terjual.</td></tr>
                ) : (
                  advancedAnalytics.top_products.map((tp, idx) => (
                    <tr key={tp.product_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>
                        {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600' }}>{tp.product_name}</td>
                      <td style={{ padding: '12px', color: '#10B981', fontWeight: 'bold' }}>{tp.total_qty_sold} pcs</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>{formatRp(tp.total_revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAMPILAN TAB PEMBAYARAN & MIDTRANS */}
      {activeTab === 'payment' && (
        <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h2 style={{ margin: 0, color: 'var(--dark)' }}>💳 Pengaturan Gateway Pembayaran & Midtrans</h2>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              Kelola saklar ON/OFF Midtrans Payment Gateway dan QRIS Toko Bebas MDR sesuai kebutuhan arus kas.
            </p>
          </div>

          <form onSubmit={handleSavePaymentSettings} style={{ maxWidth: '800px' }}>
            {/* Saklar Midtrans Gateway */}
            <div style={{ background: paymentSettings.midtrans_enabled ? '#EFF6FF' : '#F9FAFB', border: `2px solid ${paymentSettings.midtrans_enabled ? '#3B82F6' : '#E5E7EB'}`, borderRadius: '16px', padding: '24px', marginBottom: '24px', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>⚡</span>
                    <h3 style={{ margin: 0, color: paymentSettings.midtrans_enabled ? '#1E40AF' : '#374151' }}>
                      Midtrans Payment Gateway (Gopay, ShopeePay, VA Bank, QRIS Otomatis)
                    </h3>
                  </div>
                  <p style={{ margin: '8px 0 0 0', color: paymentSettings.midtrans_enabled ? '#1D4ED8' : '#6B7280', fontSize: '13px', lineHeight: '1.5' }}>
                    {paymentSettings.midtrans_enabled 
                      ? '🟢 STATUS AKTIF: Kasir menampilkan opsi Midtrans Snap. Pembayaran otomatis diverifikasi secara real-time lewat webhook.'
                      : '⚪ STATUS NONAKTIF: Midtrans disembunyikan dari kasir pelanggan. Menghemat MDR, transaksi dialihkan ke QRIS manual & COD.'}
                  </p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '56px', height: '30px', flexShrink: 0, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={paymentSettings.midtrans_enabled === 1 || paymentSettings.midtrans_enabled === true}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, midtrans_enabled: e.target.checked ? 1 : 0 })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: paymentSettings.midtrans_enabled ? '#2563EB' : '#D1D5DB', transition: '.3s', borderRadius: '30px' }}>
                    <span style={{ position: 'absolute', height: '22px', width: '22px', left: paymentSettings.midtrans_enabled ? '28px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                  </span>
                </label>
              </div>

              {/* Form Input Kredensial Midtrans */}
              <div style={{ marginTop: '20px', borderTop: '1px solid ' + (paymentSettings.midtrans_enabled ? '#BFDBFE' : '#E5E7EB'), paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>Merchant ID</label>
                    <input 
                      type="text" 
                      value={paymentSettings.midtrans_merchant_id || ''} 
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, midtrans_merchant_id: e.target.value })}
                      placeholder="Contoh: M817995214"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>Mode Lingkungan</label>
                    <select 
                      value={paymentSettings.midtrans_is_production ? 'production' : 'sandbox'}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, midtrans_is_production: e.target.value === 'production' ? 1 : 0 })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', background: 'white' }}
                    >
                      <option value="production">🚀 Production (Live / Transaksi Riil)</option>
                      <option value="sandbox">🧪 Sandbox (Testing / Simulasi)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>Client Key (Frontend Public)</label>
                  <input 
                    type="text" 
                    value={paymentSettings.midtrans_client_key || ''} 
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, midtrans_client_key: e.target.value })}
                    placeholder="Contoh: Mid-client-BaEsc6bdboUcT4YZ"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Server Key (Backend Private)</label>
                    <button 
                      type="button" 
                      onClick={() => setShowServerKey(!showServerKey)}
                      style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      {showServerKey ? '🙈 Sembunyikan' : '👁️ Tampilkan'}
                    </button>
                  </div>
                  <input 
                    type={showServerKey ? 'text' : 'password'} 
                    value={paymentSettings.midtrans_server_key || ''} 
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, midtrans_server_key: e.target.value })}
                    placeholder="Contoh: Mid-server-xxxxxxxxxxxxxxxx"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            {/* Saklar QRIS Toko Manual */}
            <div style={{ background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>📱</span>
                    <h3 style={{ margin: 0, color: '#166534' }}>QRIS Manual Toko (0% MDR Potongan)</h3>
                  </div>
                  <p style={{ margin: '8px 0 0 0', color: '#15803D', fontSize: '13px', lineHeight: '1.5' }}>
                    Pelanggan scan barcode QRIS statis GarnetaMart lalu konfirmasi struk pembayaran via WhatsApp. Bebas biaya gateway!
                  </p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '56px', height: '30px', flexShrink: 0, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={paymentSettings.qris_manual_enabled === 1 || paymentSettings.qris_manual_enabled === true}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, qris_manual_enabled: e.target.checked ? 1 : 0 })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: paymentSettings.qris_manual_enabled ? '#10B981' : '#D1D5DB', transition: '.3s', borderRadius: '30px' }}>
                    <span style={{ position: 'absolute', height: '22px', width: '22px', left: paymentSettings.qris_manual_enabled ? '28px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                  </span>
                </label>
              </div>
            </div>

            {/* Pengaturan Loyalty Points */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>🎁</span>
                <h3 style={{ margin: 0, color: '#92400E' }}>Program Loyalitas & Poin Pelanggan</h3>
              </div>
              <p style={{ margin: '0 0 16px 0', color: '#B45309', fontSize: '13px' }}>
                Pelanggan mendapatkan 1 koin reward tiap kelipatan nominal belanja berikut. (1 Poin = Potongan Rp 1 saat kasir checkout).
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>1 Poin per Belanja Rp</span>
                <input 
                  type="number" 
                  min="10"
                  value={paymentSettings.loyalty_point_rate || 100}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, loyalty_point_rate: parseInt(e.target.value) || 100 })}
                  style={{ width: '120px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '13px', color: '#6B7280' }}>(Default: Rp 100 belanja = 1 Poin)</span>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSavingPayment}
              style={{ padding: '14px 28px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
            >
              {isSavingPayment ? '⏳ Menyimpan...' : '💾 Simpan Pengaturan Pembayaran'}
            </button>
          </form>
        </div>
      )}

      {/* TAMPILAN TAB VOUCHER & PROMO */}
      {activeTab === 'promos' && (
        <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h2 style={{ margin: 0, color: 'var(--dark)' }}>🏷️ Manajemen Voucher Promo & Diskon</h2>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              Rancang kupon diskon persentase atau nominal langsung untuk memicu pembelian pelanggan baru & loyal.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'flex-start' }}>
            {/* Form Buat Voucher Baru */}
            <form onSubmit={handleCreatePromo} style={{ background: '#F9FAFB', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--dark)' }}>➕ Terbitkan Voucher Baru</h3>
              
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Kode Kupon (Kapital)</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Misal: DISKON10, HEMAT20K" 
                  value={newPromo.code} 
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', fontWeight: 'bold', letterSpacing: '1px' }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Tipe Diskon</label>
                  <select 
                    value={newPromo.discount_type} 
                    onChange={(e) => setNewPromo({ ...newPromo, discount_type: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', background: 'white' }}
                  >
                    <option value="percent">Persentase (%)</option>
                    <option value="fixed">Nominal Tetap (Rp)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                    Nilai {newPromo.discount_type === 'percent' ? '(%)' : '(Rp)'}
                  </label>
                  <input 
                    required 
                    type="number" 
                    placeholder={newPromo.discount_type === 'percent' ? '10' : '15000'} 
                    value={newPromo.discount_value} 
                    onChange={(e) => setNewPromo({ ...newPromo, discount_value: e.target.value })} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Min Belanja (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={newPromo.min_order} 
                    onChange={(e) => setNewPromo({ ...newPromo, min_order: e.target.value })} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Maks Potongan (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="Kosongkan jika bebas" 
                    value={newPromo.max_discount} 
                    onChange={(e) => setNewPromo({ ...newPromo, max_discount: e.target.value })} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Batas Kuota Pemakaian</label>
                <input 
                  type="number" 
                  placeholder="100" 
                  value={newPromo.usage_limit} 
                  onChange={(e) => setNewPromo({ ...newPromo, usage_limit: e.target.value })} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' }} 
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingPromo} 
                style={{ padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '6px' }}
              >
                {isSubmittingPromo ? 'Menyimpan...' : '➕ Terbitkan Voucher'}
              </button>
            </form>

            {/* Tabel Daftar Voucher */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px' }}>Kode</th>
                    <th style={{ padding: '12px' }}>Diskon</th>
                    <th style={{ padding: '12px' }}>Min Belanja</th>
                    <th style={{ padding: '12px' }}>Kuota</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada voucher promo.</td></tr>
                  ) : (
                    promos.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 10px', background: '#FEF3C7', color: '#B45309', borderRadius: '6px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                            {p.code}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--primary)' }}>
                          {p.discount_type === 'percent' ? `${p.discount_value}%` : formatRp(p.discount_value)}
                          {p.max_discount ? <small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 'normal' }}>Maks {formatRp(p.max_discount)}</small> : null}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{formatRp(p.min_order || 0)}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 'bold' }}>{p.used_count || 0}</span> / {p.usage_limit || '∞'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '99px', fontSize: '12px', fontWeight: 'bold', background: p.is_active ? '#BBF7D0' : '#FECACA', color: p.is_active ? '#166534' : '#991B1B' }}>
                            {p.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleTogglePromo(p.id, p.is_active)}
                            style={{ padding: '4px 8px', marginRight: '6px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            {p.is_active ? 'Matikan' : 'Aktifkan'}
                          </button>
                          <button 
                            onClick={() => handleDeletePromo(p.id)}
                            style={{ padding: '4px 8px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            Hapus
                          </button>
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

      {/* TAMPILAN TAB PENGATURAN TOKO */}
      {activeTab === 'settings' && (
        <div style={{ background: 'white', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <h2
            style={{ marginBottom: '20px', cursor: 'default', userSelect: 'none' }}
            onClick={handleSecretTap}
          >
            ⚙️ Pengaturan Toko
          </h2>

          {/* PENGATURAN QRIS (TERSEMBUNYI - BUKA DENGAN 5x KETUK JUDUL + PIN) */}
          {showQrisSection && (
            <div style={{ maxWidth: '600px', background: '#EFF6FF', padding: '24px', borderRadius: '16px', border: '1px solid #93C5FD', marginBottom: '30px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#1D4ED8' }}>📱 Pengaturan QRIS Pembayaran</h3>
              <p style={{ fontSize: '14px', color: '#1E40AF', marginBottom: '16px' }}>
                Hanya pemilik yang dapat mengganti gambar QRIS. Dilindungi oleh PIN rahasia.
              </p>

              {!qrisPinVerified ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>🔒 Masukkan PIN Rahasia untuk melanjutkan</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                    {[0,1,2,3,4,5].map(i => (
                      <div key={i} style={{ width: '40px', height: '52px', background: 'white', border: `2px solid ${qrisPinError ? '#EF4444' : '#93C5FD'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', color: '#1D4ED8' }}>
                        {qrisPinInput[i] ? '●' : ''}
                      </div>
                    ))}
                  </div>
                  {qrisPinError && <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '8px' }}>❌ PIN salah! Coba lagi.</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxWidth: '200px', margin: '0 auto' }}>
                    {['1','2','3','4','5','6','7','8','9','←','0','✓'].map(key => (
                      <button key={key} onClick={() => {
                        if (key === '←') {
                          setQrisPinInput(p => p.slice(0,-1));
                          setQrisPinError(false);
                        } else if (key === '✓') {
                          if (qrisPinInput === QRIS_PIN) {
                            setQrisPinVerified(true);
                            setQrisPinError(false);
                          } else {
                            setQrisPinError(true);
                            setQrisPinInput('');
                          }
                        } else if (qrisPinInput.length < 6) {
                          const newPin = qrisPinInput + key;
                          setQrisPinInput(newPin);
                          setQrisPinError(false);
                          if (newPin.length === 6) {
                            if (newPin === QRIS_PIN) {
                              setQrisPinVerified(true);
                            } else {
                              setTimeout(() => { setQrisPinError(true); setQrisPinInput(''); }, 300);
                            }
                          }
                        }
                      }} style={{ padding: '14px', background: key === '✓' ? '#2563EB' : key === '←' ? '#FEE2E2' : 'white', color: key === '✓' ? 'white' : key === '←' ? '#EF4444' : '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ width: '150px', height: '150px', background: 'white', border: '2px dashed #93C5FD', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    <img 
                      src={`${import.meta.env.VITE_API_URL}/uploads/qris.jpg`} 
                      alt="Current QRIS" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/150x150?text=Belum+Ada+QRIS' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: '#1E40AF', marginBottom: '12px' }}>✅ PIN benar! Anda bisa mengganti gambar QRIS.</p>
                    <label style={{ display: 'inline-block', background: '#2563EB', color: 'white', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Pilih File Gambar QRIS Baru
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg, image/webp" 
                        onChange={handleUploadQris} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                    <p style={{ fontSize: '12px', color: '#60A5FA', marginTop: '8px' }}>
                      *Gambar akan langsung terganti di seluruh HP pelanggan.
                    </p>
                    <button onClick={() => { setShowQrisSection(false); setQrisPinVerified(false); setQrisPinInput(''); }} style={{ marginTop: '12px', background: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>🔒</span> Tutup & Sembunyikan Panel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* PENGATURAN SUARA NOTIFIKASI */}
          <div style={{ maxWidth: '600px', background: '#FFFBEB', padding: '24px', borderRadius: '16px', border: '1px solid #FDE68A', marginBottom: '30px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#B45309' }}>🔊 Pengaturan Suara Notifikasi</h3>
            <p style={{ fontSize: '13px', color: '#92400E', marginBottom: '16px' }}>Pilih suara yang akan diputar setiap ada pesanan baru masuk.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" value="default" checked={alarmType === 'default'} onChange={handleTypeChange} />
                <span>🔔 Suara Kasir Minimart (Ting-Tong)</span>
              </label>

              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                  <input type="radio" value="tts" checked={alarmType === 'tts'} onChange={handleTypeChange} />
                  <span style={{ fontWeight: 'bold' }}>🤖 Robot Kasir (Suara Teks)</span>
                </label>
                {alarmType === 'tts' && (
                  <div style={{ marginLeft: '24px' }}>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>Ketik kata-kata yang ingin diucapkan robot:</p>
                    <input type="text" value={alarmTtsText} onChange={handleSaveTts} placeholder="Contoh: Ada pesanan bos" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' }} />
                    <button onClick={playNotificationSound} style={{ marginTop: '8px', padding: '6px 12px', background: '#E5E7EB', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>▶️ Test Suara</button>
                  </div>
                )}
              </div>

              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                  <input type="radio" value="audio" checked={alarmType === 'audio'} onChange={handleTypeChange} />
                  <span style={{ fontWeight: 'bold' }}>🎙️ Suara Custom (Upload MP3)</span>
                </label>
                {alarmType === 'audio' && (
                  <div style={{ marginLeft: '24px' }}>
                    <label style={{ display: 'inline-block', background: '#F59E0B', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      {isUploadingAlarm ? '⏳ Mengunggah...' : 'Pilih File MP3 / WAV'}
                      <input type="file" accept="audio/*" onChange={handleUploadAlarmAudio} style={{ display: 'none' }} disabled={isUploadingAlarm} />
                    </label>
                    <button onClick={playNotificationSound} style={{ marginLeft: '8px', padding: '8px 12px', background: '#E5E7EB', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>▶️ Test Suara</button>
                    {alarmAudioFile && <p style={{ fontSize: '11px', color: '#10B981', marginTop: '8px' }}>✅ File custom aktif</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '600px', background: '#F9FAFB', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Manajemen Banner Pop-up Promo</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* Bagian Atas: Tambah Banner Baru */}
              <div>
                <strong style={{ display: 'block', marginBottom: '12px', fontSize: '18px' }}>1. Tambah Banner Baru (Maks 10)</strong>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {/* Opsi 1: Buat dengan AI */}
                  <div style={{ flex: '1 1 250px', background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#8B5CF6' }}>✨ Buat Banner Otomatis (AI)</h4>
                    <textarea 
                      placeholder="Contoh: Promo minyak goreng bimoli diskon besar besaran..."
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', minHeight: '60px', marginBottom: '12px' }}
                    />
                    <button 
                      onClick={handleGenerateAI} 
                      disabled={isGeneratingAi || banners.length >= 10}
                      style={{ width: '100%', padding: '10px', background: banners.length >= 10 ? '#ccc' : '#8B5CF6', color: 'white', border: 'none', borderRadius: '8px', cursor: banners.length >= 10 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                    >
                      {isGeneratingAi ? '⏳ Melukis Banner...' : '🚀 Generate Banner'}
                    </button>
                  </div>

                  {/* Opsi 2: Unggah Manual */}
                  <div style={{ flex: '1 1 250px', background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 12px 0' }}>📁 Unggah Gambar Manual</h4>
                    <form onSubmit={handleSaveBanner} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg, image/webp" 
                        onChange={e => setBannerFile(e.target.files[0])} 
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', background: '#F9FAFB' }} 
                      />
                      <button type="submit" className="btn btn-primary" disabled={isSavingBanner || !bannerFile || banners.length >= 10} style={{ background: banners.length >= 10 ? '#ccc' : undefined }}>
                        {isSavingBanner ? 'Menyimpan...' : '💾 Unggah & Simpan'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

              {/* Bagian Bawah: Galeri Banner Aktif */}
              <div>
                <strong style={{ display: 'block', marginBottom: '12px', fontSize: '18px' }}>2. Galeri Banner Anda ({banners.length}/10)</strong>
                {banners.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#F3F4F6', borderRadius: '12px', color: 'var(--text-muted)' }}>
                    Belum ada banner. Silakan buat atau unggah di atas.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                    {banners.map(b => (
                      <div key={b.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: '120px', background: '#E5E7EB', position: 'relative' }}>
                          <img src={b.image_url.startsWith('http') ? b.image_url : `${import.meta.env.VITE_API_URL}${b.image_url}`} alt={`Banner ${b.id}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button 
                            onClick={() => handleDeleteBanner(b.id)}
                            style={{ position: 'absolute', top: '8px', right: '8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Hapus Banner"
                          >
                            🗑️
                          </button>
                        </div>
                        <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: b.is_active ? '#ECFDF5' : '#F9FAFB' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: b.is_active ? '#059669' : '#6B7280' }}>
                            {b.is_active ? '✅ Aktif' : '❌ Nonaktif'}
                          </span>
                          <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                            <input type="checkbox" checked={b.is_active === 1 || b.is_active === true} onChange={() => handleToggleBanner(b.id, b.is_active)} style={{ opacity: 0, width: 0, height: 0 }} />
                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: b.is_active ? '#10B981' : '#ccc', transition: '.4s', borderRadius: '34px' }}>
                              <span style={{ position: 'absolute', content: '""', height: '16px', width: '16px', left: b.is_active ? '20px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
                            </span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                  <option value="Grosir / Partai Besar">Grosir / Partai Besar</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Cemilan">Cemilan</option>
                  <option value="Kebutuhan Rumah">Kebutuhan Rumah</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                  File Gambar (Bisa Dikosongkan)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6', border: '1px dashed #9CA3AF', borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>🖼️</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#4B5563' }}>Pilih dari Galeri</span>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg, image/webp" 
                      onChange={e => setImageFile(e.target.files[0])} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', border: '1px dashed #60A5FA', borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>📸</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1D4ED8' }}>Foto Sekarang</span>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg, image/webp" 
                      capture="environment"
                      onChange={e => setImageFile(e.target.files[0])} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
                {imageFile && <p style={{ fontSize: '12px', color: '#10B981', margin: 0 }}>✅ 1 Foto siap diunggah ({imageFile.name})</p>}
              </div>
              {editingId && (
                <>
                  <ProductGalleryManager productId={editingId} authHeader={authHeader} />
                  <ProductVariantManager productId={editingId} authHeader={authHeader} />
                </>
              )}

              <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }}>
                Simpan Barang
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lembar Cetak Resi (Thermal 58mm) */}
      {printOrder && (
        <div id="print-section" style={{ background: 'white', color: 'black', fontFamily: "'Courier New', Courier, monospace", padding: '10px' }}>
          <div>
            <h2 style={{ textAlign: 'center', margin: '0 0 5px 0', fontSize: '18px', borderBottom: '1px dashed black', paddingBottom: '5px' }}>GARNETAMART</h2>
            <p style={{ textAlign: 'center', margin: '0 0 15px 0', fontSize: '12px' }}>Struk Pengiriman</p>
            
            <p style={{ margin: '3px 0', fontSize: '11px' }}>ID: #{printOrder.id}</p>
            <p style={{ margin: '3px 0', fontSize: '11px' }}>Tgl: {new Date(printOrder.order_date).toLocaleString('id-ID')}</p>
            
            <div style={{ margin: '10px 0', borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '5px 0' }}>
              <p style={{ margin: '3px 0', fontSize: '11px' }}><strong>PENERIMA:</strong></p>
              <p style={{ margin: '3px 0', fontSize: '14px', fontWeight: 'bold' }}>{printOrder.customer_name}</p>
              <p style={{ margin: '3px 0', fontSize: '12px' }}>{printOrder.customer_phone}</p>
              <p style={{ margin: '3px 0', fontSize: '11px' }}>{printOrder.customer_address}</p>
            </div>
            
            <div style={{ margin: '10px 0', textAlign: 'right' }}>
              <p style={{ margin: '3px 0', fontSize: '11px' }}>Total Bayar:</p>
              <h2 style={{ margin: '3px 0', fontSize: '16px' }}>{formatRp(printOrder.total_amount)}</h2>
              <p style={{ margin: '3px 0', fontSize: '11px' }}>({printOrder.status || 'Baru'})</p>
            </div>
            
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px' }}>
              <p style={{ margin: '2px 0' }}>Terima kasih 🙏</p>
              <p style={{ margin: '2px 0' }}>GarnetaMart Grosir</p>
            </div>
          </div>
        </div>
      )}

      {/* Style khusus untuk cetak Thermal 58mm */}
      <style>
        {`
          @media print {
            @page { margin: 0; }
            body { margin: 0; padding: 0; background: white; }
            body * { visibility: hidden; }
            
            #print-section, #print-section * {
              visibility: visible;
            }
            #print-section {
              position: absolute;
              left: 0;
              top: 0;
              width: 58mm; /* Lebar kertas kasir thermal */
              padding: 0;
              margin: 0;
            }
          }
        `}
      </style>

      {/* Fase 3 #3 & #4: Modal Live Tracking Kurir */}
      {trackingOrderId && (
        <LiveTrackingModal
          orderId={trackingOrderId}
          onClose={() => setTrackingOrderId(null)}
        />
      )}

      {/* Fase 5: Modal Digital Invoice / Kuitansi Resmi Admin */}
      {invoiceModalOrderId && (
        <DigitalInvoiceModal
          orderId={invoiceModalOrderId}
          onClose={() => setInvoiceModalOrderId(null)}
        />
      )}
    </div>
    </>
  );
}

export default Dashboard;
