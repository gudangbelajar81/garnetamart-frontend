import { useState } from 'react';

function LegalModal({ initialTab = 'privacy', onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="legal-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '720px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
          borderRadius: '20px 20px 0 0'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: 'bold' }}>
              ⚖️ Informasi Hukum & Kepatuhan Layanan
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              GarnetaMart — Transparan, Aman, dan Patuh Regulasi Republik Indonesia
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px', background: '#E2E8F0', color: '#475569',
              border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            ✕ Tutup
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F1F5F9', padding: '6px 12px', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none',
              fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
              background: activeTab === 'privacy' ? '#ffffff' : 'transparent',
              color: activeTab === 'privacy' ? '#2563EB' : '#64748B',
              boxShadow: activeTab === 'privacy' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            🛡️ Kebijakan Privasi (UU PDP)
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none',
              fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
              background: activeTab === 'terms' ? '#ffffff' : 'transparent',
              color: activeTab === 'terms' ? '#2563EB' : '#64748B',
              boxShadow: activeTab === 'terms' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            📜 Syarat & Ketentuan Layanan
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none',
              fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
              background: activeTab === 'contact' ? '#ffffff' : 'transparent',
              color: activeTab === 'contact' ? '#2563EB' : '#64748B',
              boxShadow: activeTab === 'contact' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            🏢 Kontak & Legal Toko
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px 28px', color: '#334155', fontSize: '14px', lineHeight: '1.7', overflowY: 'auto' }}>
          {activeTab === 'privacy' && (
            <div>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', color: '#1E40AF', fontSize: '13px' }}>
                <strong>📌 Komitmen Privasi:</strong> Kebijakan ini disusun berdasarkan <b>Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)</b>. Kami menjamin kerahasiaan seluruh informasi Anda.
              </div>

              <h3 style={{ color: '#0F172A', fontSize: '15px', marginTop: 0 }}>1. Data yang Kami Kumpulkan</h3>
              <p>Untuk memproses pesanan sembako dan pengantaran belanja Anda, sistem GarnetaMart mencatat:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                <li><b>Identitas Diri:</b> Nama lengkap pelanggan.</li>
                <li><b>Informasi Kontak:</b> Nomor WhatsApp / Telepon aktif untuk koordinasi kurir.</li>
                <li><b>Alamat & Lokasi:</b> Alamat tempat tinggal dan koordinat GPS pengantaran.</li>
                <li><b>Data Transaksi:</b> Riwayat pesanan, pilihan metode pembayaran, dan poin loyalitas.</li>
              </ul>

              <h3 style={{ color: '#0F172A', fontSize: '15px', marginTop: '20px' }}>2. Tujuan Penggunaan Data</h3>
              <p>Data pribadi Anda digunakan semata-mata untuk:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                <li>Memandu kurir menuju titik alamat pengantaran secara akurat dan tepat waktu.</li>
                <li>Mengirim notifikasi otomatis mengenai perkembangan status pesanan via WhatsApp resmi.</li>
                <li>Mencatat perolehan dan penukaran koin poin loyalitas member GarnetaMart.</li>
              </ul>

              <h3 style={{ color: '#0F172A', fontSize: '15px', marginTop: '20px' }}>3. Keamanan Informasi & Transaksi Finansial</h3>
              <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                <li><b>Password:</b> Terenkripsi menggunakan algoritma cryptographic hash <i>bcrypt</i> (salt round 10).</li>
                <li><b>Pembayaran:</b> Seluruh transaksi digital diproses melalui gateway resmi perbankan (Midtrans) yang tersertifikasi PCI-DSS. GarnetaMart <b>tidak pernah menyimpan</b> data nomor kartu kredit atau PIN perbankan pelanggan.</li>
                <li><b>Anti-Bocor:</b> Kami <b>TIDAK AKAN PERNAH</b> menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga untuk kepentingan iklan spam.</li>
              </ul>

              <h3 style={{ color: '#0F172A', fontSize: '15px', marginTop: '20px' }}>4. Hak Anda Sebagai Subjek Data</h3>
              <p>Sesuai UU PDP, Anda memiliki hak penuh untuk meminta pembaruan data yang keliru atau penghapusan data akun member Anda dengan menghubungi layanan pelanggan resmi kami.</p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div>
              <h3 style={{ color: '#0F172A', fontSize: '15px', marginTop: 0 }}>1. Ketentuan Pemesanan</h3>
              <p>Dengan melakukan pemesanan di GarnetaMart, Anda menyetujui ketentuan berikut:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                <li>Seluruh harga yang tertera di katalog adalah harga resmi grosir & sembako dan dapat berubah sewaktu-waktu mengikuti fluktuasi pasar komoditas.</li>
                <li>Pesanan diproses sesuai urutan antrean masuk pada jam operasional toko (07.00 - 21.00 WIB).</li>
              </ul>

              <h3 style={{ color: '#0F172A', fontSize: '15px', marginTop: '20px' }}>2. Pengiriman & Armada Kendaraan</h3>
              <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                <li><b>Armada Motor / Obrok:</b> Diperuntukkan bagi pesanan sembako standar/sedang (maksimal berat ±35 kg).</li>
                <li><b>Armada Mobil Pick-up / Tossa:</b> Diperuntukkan bagi pembelian partai besar / karungan (beras, minyak dus, gula sak). Untuk pengantaran Pick-up volume besar, pembeli dimohon bersiap untuk turut membongkar muatan di lokasi.</li>
                <li>Ongkos kirim dihitung berdasarkan jarak rute tempuh (km) dan jenis armada yang dipilih.</li>
              </ul>

              <h3 style={{ color: '#0F172A', fontSize: '15px', marginTop: '20px' }}>3. Kebijakan Retur & Garansi Sembako</h3>
              <p>GarnetaMart menjamin kualitas seluruh barang yang dikirim. Jika terjadi:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                <li>Kemasan beras/minyak/gula bocor atau rusak saat diterima.</li>
                <li>Barang salah kirim atau kuantitas kurang.</li>
              </ul>
              <p>Pelanggan berhak mengajukan penggantian barang dalam waktu <b>1x24 jam sejak barang diterima</b> dengan menunjukkan kuitansi/invoice digital dan foto bukti ke WhatsApp Admin.</p>
            </div>
          )}

          {activeTab === 'contact' && (
            <div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '16px', marginBottom: '20px' }}>
                <span style={{ fontSize: '36px' }}>🏬</span>
                <h3 style={{ margin: '8px 0 4px 0', color: '#0F172A' }}>GarnetaMart Yogyakarta</h3>
                <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>Pusat Sembako, Grosir & Kebutuhan Rumah Tangga Murah</p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 0', fontWeight: 'bold', width: '160px', color: '#64748B' }}>Alamat Toko:</td>
                    <td style={{ padding: '10px 0' }}>Jl. Garneta Raya No. 88, Sleman, Daerah Istimewa Yogyakarta 55281</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 0', fontWeight: 'bold', color: '#64748B' }}>Jam Operasional:</td>
                    <td style={{ padding: '10px 0' }}>Senin – Minggu: 07.00 – 21.00 WIB (Buka Setiap Hari)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 0', fontWeight: 'bold', color: '#64748B' }}>WhatsApp Customer Care:</td>
                    <td style={{ padding: '10px 0' }}>0812-3456-7890</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 0', fontWeight: 'bold', color: '#64748B' }}>Email Pengaduan:</td>
                    <td style={{ padding: '10px 0' }}>cs@garnetamart.com</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 0', fontWeight: 'bold', color: '#64748B' }}>Dasar Hukum:</td>
                    <td style={{ padding: '10px 0' }}>UU No. 11/2008 (ITE) & UU No. 27/2022 (PDP) Republik Indonesia</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC',
          borderRadius: '0 0 20px 20px', textAlign: 'right'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', background: '#2563EB', color: 'white',
              border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Saya Memahami & Setuju
          </button>
        </div>
      </div>
    </div>
  );
}

export default LegalModal;
