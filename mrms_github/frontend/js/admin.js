let allPatients  = [];
let allDiagnoses = [];
let allUsers     = [];
let allDoctors   = { bosh: [], mahalliy: [], tor: [] };
let allApps      = [];
let editPatientId = null;
let editDiagId    = null;
let resetUserId   = null;
let currentUserFilter = 'all';

const ogirlikBadge = { 'Yengil':'yengil',"O'rtacha":'ortacha',"Og'ir":'ogir','Kritik':'kritik' };
const holatiClass  = { 'Faol':'faol','Surunkali':'surunkali','Tuzalgan':'tuzalgan' };
const appColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Bekor qilindi':'rad' };
const rolLabel = {
  admin:'Administrator', bosh_shifokor:'Bosh shifokor',
  mahalliy_shifokor:'Mahalliy shifokor', tor_shifokor:'Tor shifokor',
  qabulxona:'Qabulxona', bemor:'Bemor'
};
const rolBadge = {
  admin:'admin', bosh_shifokor:'bosh_shifokor',
  mahalliy_shifokor:'mahalliy_shifokor', tor_shifokor:'tor_shifokor',
  qabulxona:'qabulxona', bemor:'bemor'
};

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('admin')) return;
  renderUserInfo();
  const today = new Date().toISOString().split('T')[0];
  const appDateEl = document.getElementById('app-date-filter');
  if (appDateEl) appDateEl.value = today;
  loadDashboard();
});

function showTab(name, el) {
  ['dashboard','doctors','patients','diagnoses','appointments','users'].forEach(t => {
    const tab = document.getElementById('tab-' + t);
    if (tab) tab.style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');

  if (name === 'doctors'      && !allDoctors.mahalliy.length) loadDoctors();
  if (name === 'patients'     && !allPatients.length)         loadPatients();
  if (name === 'diagnoses'    && !allDiagnoses.length)        loadDiagnoses();
  if (name === 'appointments')                                loadAppointments();
  if (name === 'users'        && !allUsers.length)            loadUsers();
}

// ─── DASHBOARD ───────────────────────────────────
async function loadDashboard() {
  const res = await api.getStats();
  if (res?.success) {
    const d = res.data;
    document.getElementById('st-bemorlar').textContent    = d.bemorlarSoni;
    document.getElementById('st-shifokorlar').textContent = d.shifokorlarSoni;
    document.getElementById('st-tashxislar').textContent  = d.tashxislarSoni;
    document.getElementById('st-kritik').textContent      = d.kritikHolatlar;
    document.getElementById('st-yonalt').textContent      = d.yonaltirishlar;
    document.getElementById('st-qabul').textContent       = d.bugungiQabul;
  }

  const pRes = await api.adminGetPatients();
  if (pRes?.success) {
    const recent = pRes.data.slice(-5).reverse();
    document.getElementById('dash-patients').innerHTML = recent.length
      ? recent.map(p => `<tr>
          <td><div class="td-name">${p.firstName} ${p.lastName}</div></td>
          <td>${p.mahalliyShifokor ? 'Dr. '+p.mahalliyShifokor.lastName : '—'}</td>
          <td>${p.royxatgaOlingan}</td></tr>`).join('')
      : `<tr><td colspan="3" class="table-empty">Ma'lumot yo'q</td></tr>`;
  }

  const dRes = await api.adminGetDiagnoses();
  if (dRes?.success) {
    const recent = dRes.data.slice(-5).reverse();
    document.getElementById('dash-diagnoses').innerHTML = recent.length
      ? recent.map(d => `<tr>
          <td><span class="icd-code">${d.icdKod}</span></td>
          <td>${d.bemor ? d.bemor.firstName+' '+d.bemor.lastName : '—'}</td>
          <td><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td></tr>`).join('')
      : `<tr><td colspan="3" class="table-empty">Ma'lumot yo'q</td></tr>`;

    // Tashxislar grafigi
    const ogirlikCount = { 'Yengil':0, "O'rtacha":0, "Og'ir":0, 'Kritik':0 };
    dRes.data.forEach(d => { if (ogirlikCount[d.ogirlikDarajasi] !== undefined) ogirlikCount[d.ogirlikDarajasi]++; });
    const diagCtx = document.getElementById('diagChart');
    if (diagCtx) {
      if (window.diagChartInst) window.diagChartInst.destroy();
      window.diagChartInst = new Chart(diagCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(ogirlikCount),
          datasets: [{
            data: Object.values(ogirlikCount),
            backgroundColor: ['#22c47a','#e8a020','#d93025','#6d28d9'],
            borderWidth: 2, borderColor: '#fff'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { font: { size: 12 }, padding: 12 } } }
        }
      });
    }
  }

  // Navbatlar grafigi
  const aRes = await api.adminGetApps();
  if (aRes?.success && document.getElementById('appChart')) {
    const holatCount = { 'Tasdiqlangan':0, 'Kutilmoqda':0, 'Bekor qilindi':0 };
    aRes.data.forEach(a => { if (holatCount[a.holati] !== undefined) holatCount[a.holati]++; });
    if (window.appChartInst) window.appChartInst.destroy();
    window.appChartInst = new Chart(document.getElementById('appChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(holatCount),
        datasets: [{
          label: 'Navbatlar',
          data: Object.values(holatCount),
          backgroundColor: ['#22c47a','#e8a020','#d93025'],
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

// ─── SHIFOKORLAR ─────────────────────────────────
async function loadDoctors() {
  const el = document.getElementById('doctors-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.adminGetDoctors();
  if (!res?.success) { el.innerHTML = '<p style="color:var(--red);padding:20px">Xatolik</p>'; return; }
  allDoctors = res.data;
  showDoctorTab('bosh');
}

function showDoctorTab(tip) {
  const el = document.getElementById('doctors-content');
  const data = tip === 'bosh' ? allDoctors.bosh : tip === 'mahalliy' ? allDoctors.mahalliy : allDoctors.tor;
  const title = tip === 'bosh' ? 'Bosh shifokor' : tip === 'mahalliy' ? 'Mahalliy shifokorlar' : 'Tor shifokorlar (mutaxassislar)';
  const badge = tip === 'bosh' ? 'bosh_shifokor' : tip === 'mahalliy' ? 'mahalliy_shifokor' : 'tor_shifokor';

  document.querySelectorAll('[onclick*="showDoctorTab"]').forEach(b => {
    b.className = b.getAttribute('onclick').includes(`'${tip}'`) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  });

  if (!data || !data.length) {
    el.innerHTML = `<div class="alert alert-info" style="padding:16px;border-radius:8px;background:#eff6ff;color:#1e40af">${title} hozircha yo'q</div>`;
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${title}</span>
        <span class="badge badge-${badge}">${data.length} ta</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>F.I.Sh.</th><th>Mutaxassislik</th><th>Bo'lim</th><th>Tajriba</th><th>Telefon</th><th>Amallar</th></tr></thead>
        <tbody>${data.map(d => `
          <tr>
            <td><div class="td-name">Dr. ${d.firstName} ${d.lastName}</div><div class="td-sub">${d.licenseNumber||''}</div></td>
            <td>${d.mutaxassislik}</td>
            <td>${d.bolim}</td>
            <td>${d.tajriba} yil</td>
            <td>${d.phone||'—'}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="viewDoctorProfile(${d.id},'${d.turi||tip+'_shifokor'}')">Profil</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
}

async function viewDoctorProfile(id, turi) {
  document.getElementById('profileModalTitle').textContent = 'Shifokor profili';
  document.getElementById('profileContent').innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  document.getElementById('profileModal').classList.remove('hidden');

  const doctors = turi.includes('mahalliy') ? allDoctors.mahalliy : turi.includes('tor') ? allDoctors.tor : allDoctors.bosh;
  const d = doctors.find(x => x.id === id);
  if (!d) { document.getElementById('profileContent').innerHTML = '<p>Topilmadi</p>'; return; }

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${d.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>Dr. ${d.firstName} ${d.lastName}</h2>
        <p>${d.mutaxassislik} · ${d.bolim}</p>
        <p>${d.phone||'—'} · ${d.email||'—'}</p>
      </div>
    </div>
    <div class="profile-grid">
      <div class="detail-card"><h3>Kasbiy ma'lumotlar</h3>
        <div class="detail-row"><span class="detail-label">Mutaxassislik</span><span class="detail-value">${d.mutaxassislik}</span></div>
        <div class="detail-row"><span class="detail-label">Bo'lim</span><span class="detail-value">${d.bolim}</span></div>
        <div class="detail-row"><span class="detail-label">Tajriba</span><span class="detail-value">${d.tajriba} yil</span></div>
        <div class="detail-row"><span class="detail-label">Litsenziya</span><span class="detail-value">${d.licenseNumber||'—'}</span></div>
      </div>
      <div class="detail-card"><h3>Aloqa ma'lumotlari</h3>
        <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${d.phone||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${d.email||'—'}</span></div>
        ${d.biriktirilganBemorlar ? `<div class="detail-row"><span class="detail-label">Bemorlar</span><span class="detail-value">${d.biriktirilganBemorlar.length} ta</span></div>` : ''}
        ${d.qabulKunlari ? `<div class="detail-row"><span class="detail-label">Qabul kunlari</span><span class="detail-value">${d.qabulKunlari.join(', ')}</span></div>` : ''}
      </div>
    </div>`;
}

// ─── BEMORLAR ────────────────────────────────────
async function loadPatients() {
  setLoading('patients-table', 7);
  const res = await api.adminGetPatients();
  if (res?.success) {
    allPatients = res.data;
    // Shifokor filter
    const sel = document.getElementById('pat-shifokor-filter');
    const shifokorlar = [...new Set(allPatients.filter(p => p.mahalliyShifokor).map(p => JSON.stringify({ id: p.mahalliyShifokorId, name: 'Dr. '+p.mahalliyShifokor.firstName+' '+p.mahalliyShifokor.lastName })))].map(s => JSON.parse(s));
    shifokorlar.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.name}</option>`; });
    renderPatients(allPatients);
  } else setEmpty('patients-table', 7, 'Yuklashda xatolik');

  document.getElementById('pat-search')?.addEventListener('input', filterPatients);
  document.getElementById('pat-shifokor-filter')?.addEventListener('change', filterPatients);
}

function filterPatients() {
  const q    = document.getElementById('pat-search').value.toLowerCase();
  const docId = document.getElementById('pat-shifokor-filter').value;
  renderPatients(allPatients.filter(p =>
    (!q    || (p.firstName+' '+p.lastName).toLowerCase().includes(q) || (p.phone||'').includes(q)) &&
    (!docId || String(p.mahalliyShifokorId) === docId)
  ));
}

function renderPatients(list) {
  const tbody = document.getElementById('patients-table');
  if (!list.length) { setEmpty('patients-table', 7, 'Bemorlar topilmadi'); return; }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><div class="td-name">${p.firstName} ${p.lastName}</div><div class="td-sub">${p.phone}</div></td>
      <td>${p.jinsi}</td><td>${p.tugilganSana}</td>
      <td>${p.qonGuruhi||'—'}</td>
      <td>${p.mahalliyShifokor ? 'Dr. '+p.mahalliyShifokor.firstName+' '+p.mahalliyShifokor.lastName : '<span style="color:var(--red)">Biriktirilmagan</span>'}</td>
      <td>${p.royxatgaOlingan}</td>
      <td><div class="btn-group">
        <button class="btn btn-secondary btn-sm" onclick="openPatientProfile(${p.id})">Profil</button>
        <button class="btn btn-secondary btn-sm" onclick="openPatientModal(${p.id})">Tahrirlash</button>
        <button class="btn btn-danger btn-sm" onclick="deletePatient(${p.id})">O'chirish</button>
      </div></td>
    </tr>`).join('');
}

async function openPatientProfile(id) {
  document.getElementById('patientProfileContent').innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  document.getElementById('patientProfileModal').classList.remove('hidden');
  const res = await api.adminGetPatient(id);
  if (!res?.success) { document.getElementById('patientProfileContent').innerHTML = '<p>Xatolik</p>'; return; }
  const p = res.data;
  document.getElementById('patientProfileContent').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${p.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>${p.firstName} ${p.lastName}</h2>
        <p>${p.jinsi} · Tug'ilgan: ${p.tugilganSana} · Qon guruhi: ${p.qonGuruhi||'—'}</p>
        <p>${p.phone} · ${p.email||'—'}</p>
      </div>
    </div>
    <div class="profile-grid" style="margin-bottom:16px">
      <div class="detail-card"><h3>Shaxsiy ma'lumotlar</h3>
        <div class="detail-row"><span class="detail-label">Manzil</span><span class="detail-value">${p.manzil||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Ro'yxat sanasi</span><span class="detail-value">${p.royxatgaOlingan}</span></div>
      </div>
      <div class="detail-card"><h3>Shifokor</h3>
        ${p.mahalliyShifokor
          ? `<div class="detail-row"><span class="detail-label">Ismi</span><span class="detail-value">Dr. ${p.mahalliyShifokor.firstName} ${p.mahalliyShifokor.lastName}</span></div>
             <div class="detail-row"><span class="detail-label">Mutaxassislik</span><span class="detail-value">${p.mahalliyShifokor.mutaxassislik}</span></div>`
          : '<p style="color:var(--gray-400);font-size:13px">Shifokor biriktirilmagan</p>'}
      </div>
    </div>
    <div class="detail-card"><h3>Tashxislar (${p.tashxislar?.length||0} ta)</h3>
      ${!(p.tashxislar?.length)
        ? '<p style="color:var(--gray-400);font-size:13px;padding:8px 0">Tashxis yo\'q</p>'
        : `<table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--gray-200)">
              <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">ICD</th>
              <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">Tavsif</th>
              <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">Og'irlik</th>
              <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">Sana</th>
            </tr></thead>
            <tbody>${p.tashxislar.map(d => `
              <tr style="border-bottom:1px solid var(--gray-100)">
                <td style="padding:8px"><span class="icd-code">${d.icdKod}</span></td>
                <td style="padding:8px;font-size:13px">${d.tavsif}</td>
                <td style="padding:8px"><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td>
                <td style="padding:8px;font-size:13px">${d.tashxisSana}</td>
              </tr>`).join('')}
            </tbody></table>`}
    </div>`;
}

async function openPatientModal(id = null) {
  editPatientId = id;
  document.getElementById('patientError').textContent = '';
  document.getElementById('patientModalTitle').textContent = id ? 'Bemorni tahrirlash' : 'Bemor qo\'shish';
  if (!allDoctors.mahalliy.length) await loadDoctors();
  const sel = document.getElementById('p-shifokorId');
  sel.innerHTML = '<option value="">Tanlang</option>';
  allDoctors.mahalliy.forEach(d => { sel.innerHTML += `<option value="${d.id}">Dr. ${d.firstName} ${d.lastName}</option>`; });
  if (id) {
    const p = allPatients.find(x => x.id === id);
    if (p) {
      document.getElementById('p-firstName').value    = p.firstName;
      document.getElementById('p-lastName').value     = p.lastName;
      document.getElementById('p-tugilganSana').value = p.tugilganSana;
      document.getElementById('p-jinsi').value        = p.jinsi;
      document.getElementById('p-phone').value        = p.phone;
      document.getElementById('p-qonGuruhi').value    = p.qonGuruhi||'';
      document.getElementById('p-email').value        = p.email||'';
      document.getElementById('p-manzil').value       = p.manzil||'';
      document.getElementById('p-shifokorId').value   = p.mahalliyShifokorId||'';
    }
  } else {
    ['p-firstName','p-lastName','p-tugilganSana','p-jinsi','p-phone','p-qonGuruhi','p-email','p-manzil']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('p-shifokorId').value = '';
  }
  document.getElementById('patientModal').classList.remove('hidden');
}

async function savePatient() {
  const data = {
    firstName: document.getElementById('p-firstName').value.trim(),
    lastName:  document.getElementById('p-lastName').value.trim(),
    tugilganSana: document.getElementById('p-tugilganSana').value,
    jinsi:     document.getElementById('p-jinsi').value,
    phone:     document.getElementById('p-phone').value.trim(),
    qonGuruhi: document.getElementById('p-qonGuruhi').value,
    email:     document.getElementById('p-email').value.trim(),
    manzil:    document.getElementById('p-manzil').value.trim(),
    mahalliyShifokorId: document.getElementById('p-shifokorId').value || null,
  };
  if (!data.firstName || !data.lastName || !data.tugilganSana || !data.jinsi || !data.phone) {
    document.getElementById('patientError').textContent = "Majburiy maydonlarni to'ldiring"; return;
  }
  const btn = document.getElementById('patientSaveBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = editPatientId ? await api.adminUpdatePatient(editPatientId, data) : await api.adminCreatePatient(data);
  btn.disabled = false; btn.textContent = 'Saqlash';
  if (res?.success) {
    showToast(editPatientId ? 'Bemor yangilandi' : "Bemor qo'shildi", 'success');
    closeModal('patientModal'); allPatients = []; await loadPatients();
  } else { document.getElementById('patientError').textContent = res?.message || 'Xatolik'; }
}

async function deletePatient(id) {
  if (!confirm("Ushbu bemorni o'chirishga ishonchingiz komilmi?")) return;
  const res = await api.adminDeletePatient(id);
  if (res?.success) { showToast("Bemor o'chirildi", 'success'); allPatients = []; await loadPatients(); }
  else showToast(res?.message || 'Xatolik', 'error');
}

// ─── TASHXISLAR ──────────────────────────────────
async function loadDiagnoses() {
  setLoading('diagnoses-table', 7);
  const res = await api.adminGetDiagnoses();
  if (res?.success) { allDiagnoses = res.data; renderDiagnoses(allDiagnoses); }
  else setEmpty('diagnoses-table', 7, 'Yuklashda xatolik');
  document.getElementById('diag-search')?.addEventListener('input', filterDiagnoses);
  document.getElementById('diag-ogirlik')?.addEventListener('change', filterDiagnoses);
}

function filterDiagnoses() {
  const q = document.getElementById('diag-search').value.toLowerCase();
  const o = document.getElementById('diag-ogirlik').value;
  renderDiagnoses(allDiagnoses.filter(d =>
    (!q || d.icdKod.toLowerCase().includes(q) || d.tavsif.toLowerCase().includes(q)) &&
    (!o || d.ogirlikDarajasi === o)
  ));
}

function renderDiagnoses(list) {
  const tbody = document.getElementById('diagnoses-table');
  if (!list.length) { setEmpty('diagnoses-table', 7, 'Tashxislar topilmadi'); return; }
  tbody.innerHTML = list.map(d => `
    <tr>
      <td><span class="icd-code">${d.icdKod}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${d.tavsif}">${d.tavsif}</td>
      <td>${d.bemor ? d.bemor.firstName+' '+d.bemor.lastName : '—'}</td>
      <td><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td>
      <td><span class="badge badge-${holatiClass[d.holati]||''}">${d.holati}</span></td>
      <td>${d.tashxisSana}</td>
      <td><div class="btn-group">
        <button class="btn btn-secondary btn-sm" onclick="openDiagModal(${d.id})">Tahrirlash</button>
        <button class="btn btn-danger btn-sm" onclick="deleteDiagnosis(${d.id})">O'chirish</button>
      </div></td>
    </tr>`).join('');
}

async function openDiagModal(id = null) {
  editDiagId = id;
  document.getElementById('diagError').textContent = '';
  document.getElementById('diagModalTitle').textContent = id ? 'Tashxisni tahrirlash' : 'Tashxis qo\'shish';
  if (!allPatients.length) { const r = await api.adminGetPatients(); if (r?.success) allPatients = r.data; }
  const sel = document.getElementById('d-patientId');
  sel.innerHTML = '<option value="">Bemor tanlang</option>';
  allPatients.forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.firstName} ${p.lastName}</option>`; });
  if (id) {
    const d = allDiagnoses.find(x => x.id === id);
    if (d) {
      document.getElementById('d-patientId').value = d.patientId;
      document.getElementById('d-icdKod').value    = d.icdKod;
      document.getElementById('d-tavsif').value    = d.tavsif;
      document.getElementById('d-ogirlik').value   = d.ogirlikDarajasi;
      document.getElementById('d-holati').value    = d.holati;
      document.getElementById('d-izoh').value      = d.izoh||'';
    }
  } else {
    ['d-icdKod','d-tavsif','d-izoh'].forEach(f => document.getElementById(f).value = '');
    document.getElementById('d-patientId').value = '';
    document.getElementById('d-ogirlik').value   = '';
    document.getElementById('d-holati').value    = 'Faol';
  }
  document.getElementById('diagModal').classList.remove('hidden');
}

async function saveDiagnosis() {
  const data = {
    patientId:       document.getElementById('d-patientId').value,
    icdKod:          document.getElementById('d-icdKod').value.trim(),
    tavsif:          document.getElementById('d-tavsif').value.trim(),
    ogirlikDarajasi: document.getElementById('d-ogirlik').value,
    holati:          document.getElementById('d-holati').value,
    izoh:            document.getElementById('d-izoh').value.trim(),
  };
  if (!data.patientId || !data.icdKod || !data.tavsif || !data.ogirlikDarajasi) {
    document.getElementById('diagError').textContent = "Majburiy maydonlarni to'ldiring"; return;
  }
  const btn = document.getElementById('diagSaveBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = editDiagId ? await api.adminUpdateDiag(editDiagId, data) : await api.adminCreateDiag(data);
  btn.disabled = false; btn.textContent = 'Saqlash';
  if (res?.success) {
    showToast(editDiagId ? 'Tashxis yangilandi' : "Tashxis qo'shildi", 'success');
    closeModal('diagModal'); allDiagnoses = []; await loadDiagnoses();
  } else { document.getElementById('diagError').textContent = res?.message || 'Xatolik'; }
}

async function deleteDiagnosis(id) {
  if (!confirm("Tashxisni o'chirishga ishonchingiz komilmi?")) return;
  const res = await api.adminDeleteDiag(id);
  if (res?.success) { showToast("Tashxis o'chirildi", 'success'); allDiagnoses = []; await loadDiagnoses(); }
  else showToast(res?.message || 'Xatolik', 'error');
}

// ─── NAVBATLAR ───────────────────────────────────
async function loadAppointments() {
  setLoading('appointments-table', 7);
  const sana   = document.getElementById('app-date-filter').value;
  const holati = document.getElementById('app-holati-filter').value;
  let query = '';
  if (sana) query += (query ? '&' : '?') + 'sana=' + sana;

  const res = await api.adminGetApps(query ? query : '');
  if (!res?.success) { setEmpty('appointments-table', 7, 'Yuklashda xatolik'); return; }
  let list = res.data;
  if (holati) list = list.filter(a => a.holati === holati);
  if (!list.length) { setEmpty('appointments-table', 7, 'Navbatlar topilmadi'); return; }
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('appointments-table').innerHTML = list.map(a => `
    <tr style="${a.sana === today ? 'background:#f0fdf4' : ''}">
      <td><b>${a.sana}</b>${a.sana === today ? ' <span class="badge badge-faol">Bugun</span>' : ''}</td>
      <td><b>${a.vaqt}</b></td>
      <td>${a.bemor ? a.bemor.firstName+' '+a.bemor.lastName : '—'}</td>
      <td>${a.shifokor ? 'Dr. '+a.shifokor.firstName+' '+a.shifokor.lastName : '—'}</td>
      <td>${a.shifokor?.mutaxassislik||'—'}</td>
      <td>${a.sabab}</td>
      <td><span class="badge badge-${appColorMap[a.holati]||''}">${a.holati}</span></td>
    </tr>`).join('');
}

// ─── FOYDALANUVCHILAR ────────────────────────────
async function loadUsers() {
  setLoading('users-table', 7);
  const res = await api.getUsers();
  if (res?.success) {
    allUsers = res.data;
    filterUsers('all');
  } else setEmpty('users-table', 7, 'Yuklashda xatolik');
}

function filterUsers(role) {
  currentUserFilter = role;
  // Tab tugmalarini yangilash
  ['all','admin','bosh','mahalliy','tor','qabul','bemor'].forEach(t => {
    const el = document.getElementById('utab-' + t);
    if (el) el.className = t === role || (t==='bosh'&&role==='bosh_shifokor') || (t==='mahalliy'&&role==='mahalliy_shifokor') || (t==='tor'&&role==='tor_shifokor') || (t==='qabul'&&role==='qabulxona') ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  });
  const filtered = role === 'all' ? allUsers : allUsers.filter(u => u.role === role);
  document.getElementById('user-count').textContent = `${filtered.length} ta foydalanuvchi`;
  renderUsers(filtered);
}

function searchUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  const base = currentUserFilter === 'all' ? allUsers : allUsers.filter(u => u.role === currentUserFilter);
  const filtered = q ? base.filter(u => u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) : base;
  document.getElementById('user-count').textContent = `${filtered.length} ta foydalanuvchi`;
  renderUsers(filtered);
}

async function toggleUser(id) {
  const res = await api.toggleUserStatus(id);
  if (res?.success) {
    showToast(res.data.message, res.data.faol ? 'success' : 'warning');
    allUsers = []; await loadUsers();
  } else showToast(res?.message || 'Xatolik', 'error');
}

function renderUsers(list) {
  const tbody = document.getElementById('users-table');
  if (!list.length) { setEmpty('users-table', 7, 'Foydalanuvchilar topilmadi'); return; }
  tbody.innerHTML = list.map(u => `
    <tr style="${u.faol===false?'opacity:0.6;background:#fff5f5':''}">
      <td>
        <div class="td-name">${u.fullName}</div>
        <div class="td-sub">${u.email||'—'}</div>
        ${u.mutaxassislik ? `<div class="td-sub" style="color:var(--blue)">${u.mutaxassislik}</div>` : ''}
        ${u.tugilganSana  ? `<div class="td-sub">Tug'ilgan: ${u.tugilganSana} · ${u.yosh !== undefined ? u.yosh + ' yosh' : ''}</div>` : ''}
      </td>
      <td><code style="background:var(--gray-100);padding:2px 6px;border-radius:4px;font-size:12px">${u.username}</code></td>
      <td><span class="badge badge-${rolBadge[u.role]||''}">${rolLabel[u.role]||u.role}</span></td>
      <td>${u.phone||'—'}</td>
      <td>${u.createdAt||'—'}</td>
      <td><span class="badge badge-${u.faol!==false?'faol':'ogir'}">${u.faol!==false?'Faol':'Bloklangan'}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="viewUserProfile(${u.id})">Profil</button>
          <button class="btn btn-warning btn-sm" onclick="openResetModal(${u.id},'${u.fullName}')">🔑</button>
          <button class="btn btn-${u.faol!==false?'secondary':'success'} btn-sm" onclick="toggleUser(${u.id})" title="${u.faol!==false?'Bloklash':'Faollashtirish'}">${u.faol!==false?'🔒':'🔓'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">O'chirish</button>
        </div>
      </td>
    </tr>`).join('');
}

async function viewUserProfile(id) {
  document.getElementById('profileModalTitle').textContent = 'Profil yuklanmoqda...';
  document.getElementById('profileContent').innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  document.getElementById('profileModal').classList.remove('hidden');

  const res = await api.getUserById(id);
  if (!res?.success) { document.getElementById('profileContent').innerHTML = '<p style="color:var(--red)">Xatolik: ' + (res?.message||'') + '</p>'; return; }
  const u = res.data;
  document.getElementById('profileModalTitle').textContent = u.fullName + ' — to\'liq profil';

  // Umumiy header
  let html = `
    <div class="profile-header">
      <div class="profile-avatar">${u.fullName.charAt(0)}</div>
      <div class="profile-info">
        <h2>${u.fullName}</h2>
        <p><span class="badge badge-${rolBadge[u.role]||''}">${rolLabel[u.role]||u.role}</span>
           <span class="badge badge-${u.faol!==false?'faol':'ogir'}" style="margin-left:6px">${u.faol!==false?'Faol':'Bloklangan'}</span></p>
        <p>${u.phone||'—'} · ${u.email||'—'}</p>
      </div>
    </div>`;

  // Hisob ma'lumotlari (umumiy)
  html += `
    <div class="profile-grid" style="margin-bottom:14px">
      <div class="detail-card"><h3>Hisob ma'lumotlari</h3>
        <div class="detail-row"><span class="detail-label">Username</span><span class="detail-value"><code style="background:var(--gray-100);padding:2px 6px;border-radius:4px">${u.username}</code></span></div>
        <div class="detail-row"><span class="detail-label">Rol</span><span class="detail-value">${rolLabel[u.role]||u.role}</span></div>
        <div class="detail-row"><span class="detail-label">Yaratilgan</span><span class="detail-value">${u.createdAt||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Holati</span><span class="detail-value"><span class="badge badge-${u.faol!==false?'faol':'ogir'}">${u.faol!==false?'Faol':'Bloklangan'}</span></span></div>
      </div>
      <div class="detail-card"><h3>Aloqa ma'lumotlari</h3>
        <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${u.phone||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${u.email||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Xavfsizlik savoli</span><span class="detail-value" style="font-size:12px">${u.xavfsizlikSavoli||'—'}</span></div>
      </div>
    </div>`;

  // Rol bo'yicha qo'shimcha
  if (['mahalliy_shifokor','tor_shifokor','bosh_shifokor'].includes(u.role) && u.shifokorMalumot) {
    const d = u.shifokorMalumot;
    html += `
      <div class="detail-card" style="margin-bottom:14px"><h3>Kasbiy ma'lumotlar</h3>
        <div class="profile-grid">
          <div>
            <div class="detail-row"><span class="detail-label">Mutaxassislik</span><span class="detail-value">${d.mutaxassislik}</span></div>
            <div class="detail-row"><span class="detail-label">Bo'lim</span><span class="detail-value">${d.bolim}</span></div>
            <div class="detail-row"><span class="detail-label">Tajriba</span><span class="detail-value">${d.tajriba} yil</span></div>
            <div class="detail-row"><span class="detail-label">Litsenziya</span><span class="detail-value">${d.licenseNumber||'—'}</span></div>
          </div>
          <div>
            ${u.bemorlarSoni !== undefined ? `<div class="detail-row"><span class="detail-label">Biriktirilgan bemorlar</span><span class="detail-value">${u.bemorlarSoni} ta</span></div>` : ''}
            ${d.qabulKunlari ? `<div class="detail-row"><span class="detail-label">Qabul kunlari</span><span class="detail-value">${d.qabulKunlari.join(', ')}</span></div>` : ''}
          </div>
        </div>
      </div>`;
  }

  if (u.role === 'bemor' && u.bemorMalumot) {
    const p = u.bemorMalumot;
    html += `
      <div class="detail-card" style="margin-bottom:14px"><h3>Tibbiy ma'lumotlar</h3>
        <div class="profile-grid">
          <div>
            <div class="detail-row"><span class="detail-label">Tug'ilgan sana</span><span class="detail-value">${p.tugilganSana||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">Yoshi</span><span class="detail-value">${p.yosh !== null ? p.yosh + ' yosh' : '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Jinsi</span><span class="detail-value">${p.jinsi||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">Qon guruhi</span><span class="detail-value">${p.qonGuruhi||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">Manzil</span><span class="detail-value">${p.manzil||'—'}</span></div>
          </div>
          <div>
            <div class="detail-row"><span class="detail-label">Ro'yxat sanasi</span><span class="detail-value">${p.royxatgaOlingan||'—'}</span></div>
            <div class="detail-row"><span class="detail-label">Mahalliy shifokor</span><span class="detail-value">${p.mahalliyShifokor ? 'Dr. '+p.mahalliyShifokor.firstName+' '+p.mahalliyShifokor.lastName : '<span style="color:var(--red)">Biriktirilmagan</span>'}</span></div>
            <div class="detail-row"><span class="detail-label">Jami tashxislar</span><span class="detail-value">${p.tashxislar?.length||0} ta</span></div>
            <div class="detail-row"><span class="detail-label">So'nggi navbatlar</span><span class="detail-value">${p.navbatlar?.length||0} ta</span></div>
          </div>
        </div>
      </div>`;

    if (p.tashxislar?.length) {
      html += `<div class="detail-card"><h3>Tashxislar (${p.tashxislar.length} ta)</h3>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--gray-200)">
            <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">ICD</th>
            <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">Tavsif</th>
            <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">Og'irlik</th>
            <th style="padding:8px;font-size:12px;color:var(--gray-600);text-align:left">Sana</th>
          </tr></thead>
          <tbody>${p.tashxislar.map(d => `
            <tr style="border-bottom:1px solid var(--gray-100)">
              <td style="padding:8px"><span class="icd-code">${d.icdKod}</span></td>
              <td style="padding:8px;font-size:13px">${d.tavsif}</td>
              <td style="padding:8px"><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td>
              <td style="padding:8px;font-size:13px">${d.tashxisSana}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }
  }

  // Amallar tugmalari
  html += `
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-warning btn-sm" onclick="openResetModal(${u.id},'${u.fullName}');closeModal('profileModal')">🔑 Parolni tiklash</button>
      <button class="btn btn-${u.faol!==false?'danger':'success'} btn-sm" onclick="toggleUser(${u.id});closeModal('profileModal')">
        ${u.faol!==false?'🔒 Bloklash':'🔓 Faollashtirish'}
      </button>
    </div>`;

  document.getElementById('profileContent').innerHTML = html;
}

function openResetModal(userId, fullName) {
  resetUserId = userId;
  document.getElementById('reset-user-info').textContent = `👤 ${fullName} uchun yangi parol o'rnating`;
  document.getElementById('reset-password').value = '';
  document.getElementById('resetError').textContent = '';
  document.getElementById('resetModal').classList.remove('hidden');
}

async function doResetPassword() {
  const yangiParol = document.getElementById('reset-password').value.trim();
  if (!yangiParol || yangiParol.length < 6) {
    document.getElementById('resetError').textContent = "Parol kamida 6 ta belgidan iborat bo'lishi kerak";
    return;
  }
  const btn = document.getElementById('resetBtn');
  btn.disabled = true; btn.textContent = 'Yangilanmoqda...';
  const res = await api.adminResetPassword(resetUserId, yangiParol);
  btn.disabled = false; btn.textContent = 'Parolni yangilash';
  if (res?.success) {
    showToast(res.data.message, 'success');
    closeModal('resetModal');
  } else { document.getElementById('resetError').textContent = res?.message || 'Xatolik'; }
}

function openUserModal() {
  ['u-fullName','u-username','u-password','u-phone','u-email',
   'u-mutaxassislik','u-bolim','u-licenseNumber','u-tajriba',
   'u-tugilganSana','u-manzil']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('u-role').value = '';
  const jinsiEl = document.getElementById('u-jinsi');
  if (jinsiEl) jinsiEl.value = '';
  const qonEl = document.getElementById('u-qonGuruhi');
  if (qonEl) qonEl.value = '';
  document.getElementById('doctor-fields').style.display = 'none';
  const bemorFields = document.getElementById('bemor-fields');
  if (bemorFields) bemorFields.style.display = 'none';
  document.getElementById('userError').textContent = '';
  document.getElementById('userModalTitle').textContent = "Foydalanuvchi qo'shish";

  // Bemor uchun shifokor selectini to'ldirish
  const sel = document.getElementById('u-shifokorId');
  if (sel && allDoctors.mahalliy.length) {
    sel.innerHTML = '<option value="">Biriktirmaslik</option>';
    allDoctors.mahalliy.forEach(d => {
      sel.innerHTML += `<option value="${d.id}">Dr. ${d.firstName} ${d.lastName} (${d.biriktirilganBemorlar?.length||0} bemor)</option>`;
    });
  }
  document.getElementById('userModal').classList.remove('hidden');
}

function toggleDoctorFields() {
  const role = document.getElementById('u-role').value;
  const doctorRoles = ['bosh_shifokor','mahalliy_shifokor','tor_shifokor'];
  document.getElementById('doctor-fields').style.display = doctorRoles.includes(role) ? '' : 'none';
  const bemorFields = document.getElementById('bemor-fields');
  if (bemorFields) bemorFields.style.display = role === 'bemor' ? '' : 'none';
}

async function saveUser() {
  const role = document.getElementById('u-role').value;
  const doctorRoles = ['bosh_shifokor','mahalliy_shifokor','tor_shifokor'];
  const data = {
    fullName:           document.getElementById('u-fullName').value.trim(),
    username:           document.getElementById('u-username').value.trim(),
    password:           document.getElementById('u-password').value.trim(),
    role,
    phone:              document.getElementById('u-phone').value.trim(),
    email:              document.getElementById('u-email').value.trim(),
    mutaxassislik:      document.getElementById('u-mutaxassislik')?.value.trim() || '',
    bolim:              document.getElementById('u-bolim')?.value.trim() || '',
    licenseNumber:      document.getElementById('u-licenseNumber')?.value.trim() || '',
    tajriba:            parseInt(document.getElementById('u-tajriba')?.value || 0),
    tugilganSana:       document.getElementById('u-tugilganSana')?.value || '',
    jinsi:              document.getElementById('u-jinsi')?.value || '',
    qonGuruhi:          document.getElementById('u-qonGuruhi')?.value || '',
    manzil:             document.getElementById('u-manzil')?.value.trim() || '',
    mahalliyShifokorId: document.getElementById('u-shifokorId')?.value || null,
  };

  if (!data.fullName || !data.username || !data.password || !data.role) {
    document.getElementById('userError').textContent = "Majburiy maydonlarni to'ldiring"; return;
  }
  if (data.password.length < 6) {
    document.getElementById('userError').textContent = "Parol kamida 6 ta belgidan iborat bo'lishi kerak"; return;
  }
  if (doctorRoles.includes(role) && !data.mutaxassislik) {
    document.getElementById('userError').textContent = "Shifokor uchun mutaxassislik kiritilishi shart"; return;
  }
  if (role === 'bemor' && (!data.tugilganSana || !data.jinsi || !data.phone)) {
    document.getElementById('userError').textContent = "Bemor uchun tug'ilgan sana, jinsi va telefon kiritilishi shart"; return;
  }

  const res = await api.createUser(data);
  if (res?.success) {
    showToast("Foydalanuvchi qo'shildi", 'success');
    closeModal('userModal'); allUsers = []; await loadUsers();
  } else { document.getElementById('userError').textContent = res?.message || 'Xatolik'; }
}

async function deleteUser(id) {
  if (!confirm("Foydalanuvchini o'chirishga ishonchingiz komilmi?")) return;
  const res = await api.deleteUser(id);
  if (res?.success) { showToast("O'chirildi", 'success'); allUsers = []; await loadUsers(); }
  else showToast(res?.message || 'Xatolik', 'error');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  editPatientId = null; editDiagId = null; resetUserId = null;
}

function showToast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
