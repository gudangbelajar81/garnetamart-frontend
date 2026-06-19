import { useState } from 'react';

function CustomerAuth({ onClose, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    name: '',
    address: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'error' atau 'success'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const endpoint = isRegister ? '/api/customers/register' : '/api/customers/login';
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      
      if (result.success) {
        setMessageType('success');
        setMessage(result.message);
        localStorage.setItem('garneta_customer', JSON.stringify(result.data));
        setTimeout(() => {
          onLoginSuccess(result.data);
        }, 1000); // Tunggu 1 detik agar pesan sukses terbaca
      } else {
        setMessageType('error');
        setMessage(result.message);
      }
    } catch (err) {
      setMessageType('error');
      setMessage("Kesalahan koneksi ke server. Pastikan internet Anda lancar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
      <div style={{ background: 'var(--card)', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>✖</button>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>{isRegister ? '📝' : '👋'}</div>
          <h2 style={{ margin: 0, color: 'var(--dark)' }}>{isRegister ? 'Daftar Member' : 'Selamat Datang'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
            {isRegister ? 'Isi data Anda untuk mempermudah belanja berikutnya.' : 'Masuk untuk lanjut belanja dengan cepat.'}
          </p>
        </div>

        {message && (
          <div style={{ padding: '12px', marginBottom: '16px', borderRadius: '8px', background: messageType === 'success' ? '#D1FAE5' : '#FEE2E2', color: messageType === 'success' ? '#065F46' : '#991B1B', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Nomor WhatsApp (Aktif)</label>
            <input 
              type="tel" 
              placeholder="Contoh: 08123456789" 
              required
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '16px', background: 'var(--light)', color: 'var(--text-main)' }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>PIN / Password</label>
            <input 
              type="password" 
              placeholder="Rahasia Anda" 
              required
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '16px', background: 'var(--light)', color: 'var(--text-main)' }}
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Nama Lengkap / Nama Toko Anda</label>
                <input 
                  type="text" 
                  placeholder="Misal: Budi / Toko Makmur" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '16px', background: 'var(--light)', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>Alamat Pengiriman (Patokan)</label>
                <textarea 
                  placeholder="Misal: Jl. Raya 123 (Pagar Merah)" 
                  required
                  rows="3"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '16px', background: 'var(--light)', color: 'var(--text-main)', resize: 'none' }}
                />
              </div>
            </>
          )}

          <button type="submit" disabled={isLoading} style={{ padding: '16px', marginTop: '10px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? 'Memproses...' : (isRegister ? 'Daftar Sekarang' : 'Masuk')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
          {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
          <span 
            onClick={() => setIsRegister(!isRegister)}
            style={{ color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {isRegister ? 'Login di sini' : 'Daftar di sini'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default CustomerAuth;
