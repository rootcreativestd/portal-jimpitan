// =================================================================
// TEMPEL 2 LINK CSV DARI GOOGLE SHEETS DI BAWAH INI:
// =================================================================
const CSV_PEMASUKAN_URL   = "https://docs.google.com/spreadsheets/d/e/2PACX-1vShkWqM3qixazsFa8TwkBruDEplEvevPuPgWej5PAMDDFvCRzJho5GlO4b4OY55VIUxUJZ5vMtnJQUB/pub?gid=2071089316&single=true&output=csv";
const CSV_PENGELUARAN_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vShkWqM3qixazsFa8TwkBruDEplEvevPuPgWej5PAMDDFvCRzJho5GlO4b4OY55VIUxUJZ5vMtnJQUB/pub?gid=59537913&single=true&output=csv";

let appData = { pemasukan: [], pengeluaran: [] };
const daftarBulan = ["November", "Desember", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober"];
const daftarMinggu = ["Minggu I", "Minggu II", "Minggu III", "Minggu IV", "Minggu V"];

function parseRupiah(val) {
  if (!val) return 0;
  const bersih = String(val).replace(/[^0-9-]/g, '');
  return Number(bersih) || 0;
}

const formatRupiah = (n) => 'Rp' + (Number(n) || 0).toLocaleString('id-ID');

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err)
    });
  });
}

async function loadAllData() {
  try {
    const cacheBuster = (url) => url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    const [rawIn, rawOut] = await Promise.all([
      fetchCSV(cacheBuster(CSV_PEMASUKAN_URL)),
      fetchCSV(cacheBuster(CSV_PENGELUARAN_URL))
    ]);

    appData.pemasukan = rawIn
      .filter(r => r.ID_Transaksi)
      .map(r => ({
        id: r.ID_Transaksi,
        tanggal: r.Tanggal || '-',
        bulan: (r.Bulan || '').trim(),
        minggu: (r.Minggu_Ke || '').trim(),
        wilayah: (r.Wilayah || '').trim().toUpperCase(),
        jumlah: parseRupiah(r.Jumlah),
        petugas: r.Petugas_Pencatat || '',
        keterangan: r.Keterangan || ''
      }));

    appData.pengeluaran = rawOut
      .filter(r => r.ID_Pengeluaran)
      .map(r => ({
        id: r.ID_Pengeluaran,
        tanggal: r.Tanggal || '-',
        bulan: (r.Bulan || '').trim(),
        kategori: r.Kategori || '-',
        jumlah: parseRupiah(r.Jumlah),
        penerima: r.Penerima_Vendor || '-',
        status: r.Status_Bukti || '-',
        keterangan: r.Keterangan || '-'
      }));

    initDashboard();
  } catch (err) {
    document.getElementById('status-box').innerHTML = `
      <div class="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl max-w-md mx-auto text-sm">
        <p class="font-bold">Gagal memuat data CSV</p>
        <p class="mt-1 text-xs">Pastikan URL CSV sudah ditempel dengan benar dan sheet sudah dipublikasikan ke web.</p>
      </div>`;
  }
}

function initDashboard() {
  document.getElementById('status-box').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');

  const totalMasuk = appData.pemasukan.reduce((sum, r) => sum + r.jumlah, 0);
  const totalKeluar = appData.pengeluaran.reduce((sum, r) => sum + r.jumlah, 0);
  const saldo = totalMasuk - totalKeluar;
  const bulanAktif = new Set(appData.pemasukan.map(r => r.bulan)).size || 1;
  const rataBulan = Math.round(totalMasuk / bulanAktif);

  document.getElementById('card-masuk').textContent = formatRupiah(totalMasuk);
  document.getElementById('card-keluar').textContent = formatRupiah(totalKeluar);
  document.getElementById('card-saldo').textContent = formatRupiah(saldo);
  document.getElementById('card-rata').textContent = formatRupiah(rataBulan);

  const select = document.getElementById('filter-bulan');
  select.innerHTML = '';
  daftarBulan.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    select.appendChild(opt);
  });

  renderMingguan();
  renderBulanan();
  renderPengeluaran();
}

function renderMingguan() {
  const bulan = document.getElementById('filter-bulan').value;
  const tbody = document.getElementById('tbody-mingguan');
  tbody.innerHTML = '';

  let sumT = 0, sumB = 0, sumS = 0;

  daftarMinggu.forEach(m => {
    const rows = appData.pemasukan.filter(r => r.bulan === bulan && r.minggu === m);
    const timur = rows.filter(r => r.wilayah === 'TIMUR').reduce((s, r) => s + r.jumlah, 0);
    const barat = rows.filter(r => r.wilayah === 'BARAT').reduce((s, r) => s + r.jumlah, 0);
    const selatan = rows.filter(r => r.wilayah === 'SELATAN').reduce((s, r) => s + r.jumlah, 0);
    const total = timur + barat + selatan;
    const tanggal = rows.length > 0 ? rows[0].tanggal : '-';

    sumT += timur; sumB += barat; sumS += selatan;

    let badge = '<span class="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Belum Berjalan</span>';
    if (total > 0) {
      const belumSetor = rows.some(r => String(r.keterangan).toLowerCase().includes('belum'));
      badge = belumSetor
        ? '<span class="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-medium">Sebagian Belum Setor</span>'
        : '<span class="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-medium">Lengkap Disetor</span>';
    }

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3 font-medium">${m}</td>
        <td class="px-4 py-3 text-slate-500">${tanggal}</td>
        <td class="px-4 py-3 text-right">${formatRupiah(timur)}</td>
        <td class="px-4 py-3 text-right">${formatRupiah(barat)}</td>
        <td class="px-4 py-3 text-right">${formatRupiah(selatan)}</td>
        <td class="px-4 py-3 text-right font-semibold">${formatRupiah(total)}</td>
        <td class="px-4 py-3">${badge}</td>
      </tr>`;
  });

  const grandTotal = sumT + sumB + sumS;
  tbody.innerHTML += `
    <tr class="bg-emerald-50 font-bold text-emerald-900">
      <td class="px-4 py-3" colspan="2">TOTAL BULAN ${bulan.toUpperCase()}</td>
      <td class="px-4 py-3 text-right">${formatRupiah(sumT)}</td>
      <td class="px-4 py-3 text-right">${formatRupiah(sumB)}</td>
      <td class="px-4 py-3 text-right">${formatRupiah(sumS)}</td>
      <td class="px-4 py-3 text-right">${formatRupiah(grandTotal)}</td>
      <td class="px-4 py-3">-</td>
    </tr>`;
}

function renderBulanan() {
  const tbody = document.getElementById('tbody-bulanan');
  tbody.innerHTML = '';

  daftarBulan.forEach(b => {
    const rowsIn = appData.pemasukan.filter(r => r.bulan === b);
    const rowsOut = appData.pengeluaran.filter(r => r.bulan === b);

    const timur = rowsIn.filter(r => r.wilayah === 'TIMUR').reduce((s, r) => s + r.jumlah, 0);
    const barat = rowsIn.filter(r => r.wilayah === 'BARAT').reduce((s, r) => s + r.jumlah, 0);
    const selatan = rowsIn.filter(r => r.wilayah === 'SELATAN').reduce((s, r) => s + r.jumlah, 0);
    const masuk = timur + barat + selatan;
    const keluar = rowsOut.reduce((s, r) => s + r.jumlah, 0);
    const saldo = masuk - keluar;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-2.5 font-medium">${b}</td>
        <td class="px-4 py-2.5 text-right">${formatRupiah(timur)}</td>
        <td class="px-4 py-2.5 text-right">${formatRupiah(barat)}</td>
        <td class="px-4 py-2.5 text-right">${formatRupiah(selatan)}</td>
        <td class="px-4 py-2.5 text-right text-emerald-700 font-medium">${formatRupiah(masuk)}</td>
        <td class="px-4 py-2.5 text-right text-rose-600">${formatRupiah(keluar)}</td>
        <td class="px-4 py-2.5 text-right font-bold">${formatRupiah(saldo)}</td>
      </tr>`;
  });
}

function renderPengeluaran() {
  const tbody = document.getElementById('tbody-keluar');
  if (appData.pengeluaran.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">Belum ada catatan pengeluaran kas pada tahun 2026.</td></tr>`;
    return;
  }
  tbody.innerHTML = appData.pengeluaran.map(r => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3">${r.tanggal}</td>
      <td class="px-4 py-3 font-medium">${r.kategori}</td>
      <td class="px-4 py-3">${r.keterangan || '-'} <span class="text-xs text-slate-400">(${r.penerima || '-'})</span></td>
      <td class="px-4 py-3 text-xs">${r.status}</td>
      <td class="px-4 py-3 text-right font-semibold text-rose-600">${formatRupiah(r.jumlah)}</td>
    </tr>`).join('');
}

window.onload = loadAllData;