// Utility Cetak Struk Bluetooth POS Thermal 58mm (ESC/POS)
// Sesuai standar web-bluetooth-pos (256-byte chunking, 50ms throttle, 58mm padLR, 500ms grace period)

const KNOWN_PRINTER_UUIDS = [
  { svc: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af1-0000-1000-8000-00805f9b34fb' }, // Standard
  { svc: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-8841-43f4-a8d4-ecbe34729bb3' }, // Generic China Thermal (RPP02N, VSC, Eppos)
  { svc: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', char: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' }, // Epson/Star/M-POS
  { svc: '0000fee7-0000-1000-8000-00805f9b34fb', char: '0000fec8-0000-1000-8000-00805f9b34fb' }, // Qirui / Netum
  { svc: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', char: '6e400002-b5a3-f393-e0a9-e50e24dcca9e' }, // Nordic UART (Eco 58D)
  { svc: '0000ff00-0000-1000-8000-00805f9b34fb', char: '0000ff02-0000-1000-8000-00805f9b34fb' }, // Xprinter
  { svc: '0000fff0-0000-1000-8000-00805f9b34fb', char: '0000fff2-0000-1000-8000-00805f9b34fb' }, // Generic 58mm V2
];

/**
 * Format string teks dengan alignment rata kiri dan rata kanan pada lebar tertentu (default 32 char untuk printer 58mm).
 */
export function padLR(leftStr, rightStr, width = 32) {
  const left = String(leftStr || '');
  const right = String(rightStr || '');
  const spaceNeeded = width - left.length - right.length;
  if (spaceNeeded <= 0) {
    // Jika terlalu panjang, potong bagian kiri
    const truncatedLeft = left.substring(0, Math.max(1, width - right.length - 1)) + ' ';
    return truncatedLeft + right;
  }
  return left + ' '.repeat(spaceNeeded) + right;
}

/**
 * Format angka ke Rupiah
 */
function formatRp(num) {
  return 'Rp' + Number(num || 0).toLocaleString('id-ID');
}

/**
 * Cek apakah browser mendukung Web Bluetooth
 */
export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
}

/**
 * Cetak Struk Pesanan ke Printer Bluetooth Thermal 58mm
 * @param {Object} order Data order dari backend
 * @param {Array} orderItems Daftar item produk pesanan (opsional)
 */
export async function printReceiptBluetooth(order, orderItems = []) {
  if (!isBluetoothSupported()) {
    throw new Error("Web Bluetooth API tidak didukung di browser ini. Silakan gunakan Google Chrome atau Microsoft Edge di Android/PC.");
  }

  let device = null;
  try {
    // 1. Request Bluetooth Device (harus dipicu oleh klik user)
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_PRINTER_UUIDS.map(u => u.svc)
    });

    // 2. Connect GATT dengan Auto-Retry
    const connectGatt = async (retryCount = 3) => {
      try {
        return await device.gatt.connect();
      } catch (err) {
        if (retryCount <= 1) throw err;
        await new Promise(resolve => setTimeout(resolve, 500));
        return connectGatt(retryCount - 1);
      }
    };

    const server = await connectGatt();
    if (!server) throw new Error("Gagal terhubung ke GATT server printer.");

    // 3. Cari service dan characteristic yang cocok
    let characteristic = null;
    for (const pair of KNOWN_PRINTER_UUIDS) {
      try {
        const service = await server.getPrimaryService(pair.svc);
        const char = await service.getCharacteristic(pair.char);
        if (char) {
          characteristic = char;
          break;
        }
      } catch (_) {
        // Lanjut ke kombinasi UUID berikutnya
      }
    }

    if (!characteristic) {
      throw new Error("Karakteristik Print tidak ditemukan. Pastikan perangkat yang dipilih adalah Printer Kasir Thermal Bluetooth.");
    }

    const encoder = new TextEncoder();
    const divider = '--------------------------------\n';
    const doubleDivider = '================================\n';

    // Tanggal dan waktu order
    const orderDate = order.order_date || order.created_at
      ? new Date(order.order_date || order.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
      : new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });

    // Rangkai payload perintah ESC/POS
    const payload = [
      0x1b, 0x40, // ESC @ (Initialize printer)

      // HEADER TOKO (Rata Tengah)
      0x1b, 0x61, 0x01, // Center
      0x1d, 0x21, 0x11, // Double Width & Height
      ...encoder.encode("GARNETAMART\n"),
      0x1d, 0x21, 0x00, // Normal font
      ...encoder.encode("Sembako Murah & Cepat\n"),
      ...encoder.encode("Giwangan, Umbulharjo, YK\n"),
      ...encoder.encode("WA: 0812-3456-7890\n"),
      ...encoder.encode(doubleDivider),

      // INFORMASI ORDER (Rata Kiri)
      0x1b, 0x61, 0x00, // Left
      ...encoder.encode(padLR(`Order #${order.id}`, orderDate) + '\n'),
      ...encoder.encode(`Pelanggan: ${order.customer_name || '-'}\n`),
      ...encoder.encode(`Telepon  : ${order.customer_phone || '-'}\n`),
      ...encoder.encode(`Status   : ${order.status || 'Baru'}\n`),
      ...encoder.encode(divider),

      // DAFTAR BARANG
    ];

    if (orderItems && orderItems.length > 0) {
      orderItems.forEach(item => {
        const itemName = item.product_name || item.name || 'Produk';
        const variantText = item.variant_name ? ` (${item.variant_name})` : '';
        const fullItemName = itemName + variantText;
        const qty = item.quantity || item.qty || 1;
        const price = item.price || 0;
        const subtotal = qty * price;

        payload.push(...encoder.encode(fullItemName.substring(0, 32) + '\n'));
        payload.push(...encoder.encode(padLR(`  ${qty}x @ ${formatRp(price)}`, formatRp(subtotal)) + '\n'));
      });
    } else {
      // Jika order items tidak dilampirkan, cetak ringkasan total tagihan
      const subtotalEst = (order.total_amount || 0) - (order.shipping_fee || 0);
      payload.push(...encoder.encode(padLR("Total Barang", formatRp(Math.max(0, subtotalEst))) + '\n'));
    }

    payload.push(...encoder.encode(divider));

    // TOTAL TAGIHAN
    const shippingFee = order.shipping_fee || 0;
    const grandTotal = order.total_amount || 0;
    const subtotalCalc = Math.max(0, grandTotal - shippingFee);

    payload.push(
      ...encoder.encode(padLR("Subtotal:", formatRp(subtotalCalc)) + '\n'),
      ...encoder.encode(padLR("Ongkos Kirim:", formatRp(shippingFee)) + '\n'),
      ...encoder.encode(doubleDivider),
      0x1b, 0x45, 0x01, // Bold ON
      ...encoder.encode(padLR("TOTAL TAGIHAN:", formatRp(grandTotal)) + '\n'),
      0x1b, 0x45, 0x00, // Bold OFF
      ...encoder.encode(doubleDivider)
    );

    // INFORMASI PENGIRIMAN & FOOTER
    payload.push(
      0x1b, 0x61, 0x00, // Left
      ...encoder.encode(`Alamat Pengantaran:\n${order.customer_address || '-'}\n\n`),
      0x1b, 0x61, 0x01, // Center
      ...encoder.encode("Terima Kasih Atas Belanja Anda!\n"),
      ...encoder.encode("Simpan struk ini sebagai bukti bayar\n"),
      ...encoder.encode("www.garnetamart.com\n\n\n\n") // Feed paper 4 baris
    );

    const buffer = new Uint8Array(payload);

    // 4. Kirim data per 256 byte dengan jeda 50ms untuk cegah buffer overflow
    for (let i = 0; i < buffer.length; i += 256) {
      const chunk = buffer.slice(i, i + 256);
      await characteristic.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 5. Grace period 500ms agar mekanik printer selesai memutar kertas
    await new Promise(resolve => setTimeout(resolve, 500));

    return { success: true };
  } catch (error) {
    console.error("[BLUETOOTH PRINT ERROR]:", error);
    return { success: false, error: error.message };
  } finally {
    // 6. Selalu putuskan koneksi di finally agar printer tidak terkunci
    if (device && device.gatt && device.gatt.connected) {
      try {
        device.gatt.disconnect();
      } catch (_) {}
    }
  }
}
