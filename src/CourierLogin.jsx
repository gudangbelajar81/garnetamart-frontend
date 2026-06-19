import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CourierLogin() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!pin) return alert("Masukkan PIN Anda!");

    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/couriers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem('courier_id', result.data.id);
        localStorage.setItem('courier_name', result.data.name);
        navigate('/kurir/dashboard');
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("Gagal terhubung ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--light)', padding: '20px' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🛵</div>
        <h1 style={{ color: 'var(--dark)', marginBottom: '8px' }}>Portal Kurir</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '14px' }}>Masukkan PIN rahasia Anda untuk melihat tugas hari ini.</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input 
            type="password" 
            placeholder="****" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid var(--border)', fontSize: '24px', textAlign: 'center', letterSpacing: '8px' }}
          />
          <button type="submit" disabled={isLoading} style={{ padding: '16px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? 'Mengecek...' : 'Masuk Sekarang'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CourierLogin;
