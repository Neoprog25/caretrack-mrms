let allPatients  = [];
let allDiagnoses = [];
let allReferrals = [];
let allApps      = [];
let mahalliyList = [];
let transferPatId = null;

const ogirlikBadge = { 'Yengil':'yengil',"O'rtacha":'ortacha',"Og'ir":'ogir','Kritik':'kritik' };
const holatiClass  = { 'Faol':'faol','Surunkali':'surunkali','Tuzalgan':'tuzalgan' };
const refColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Rad etilgan':'rad' };
const appColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Bekor qilindi':'rad' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth('bosh_shifokor')) return;
  renderUserInfo();
  const today = new Date().toISOString().split('T')[0];
  const sanaEl = document.getElementById('app-sana');
  if (sanaEl) sanaEl.value = today;
  await loadDashboard();
});

function showTab(name, el) {
  ['dashboard','patients','diagnoses','appointments','referrals','profile'].forEach(t => {
    const tab = document.getElementById('tab-' + t);
    if (tab) tab.style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (name === 'patients'     && !allPatients.length)  loadPatients();
  if (name === 'diagnoses'    && !allDiagnoses.length) loadDiagnoses();
  if (name === 'appointments')                         loadAppointments();
  if (name === 'referrals'    && !allReferrals.length) loadReferrals();
  if (name === 'profile')                              loadProfile();
}

async function loadDashboard() {
  const res = await api.boshDashboard();
  if (!res?.success) return;
  const s = res.data.statistika;
  document.getElementById('st-bemorlar').textContent   = s.jami_bemorlar;
  document.getElementById('st-shifokorlar').textContent= s.jami_shifokorlar;
  document.getElementById('st-tashxislar').textContent = s.jami_tashxislar;
  document.getElementById('st-kritik').textContent     = s.kritik_holatlar;
  document.getElementById('st-yonalt').textContent     = s.kutilgan_yonalt;
  document.getElementById('st-qabul').textContent      = s.bugungi_qabul;

  mahalliyList = res.data.mahalliy_shifokorlar;

  document.getElementById('mahalliy-list').innerHTML = res.data.mahalliy_shifokorlar.map(d => `
    <div style="padding:12px 20px;border-bottom:1px solid var(--gray-100)">
      <div class="td-name">Dr. ${d.firstName} ${d.lastName}</div>
      <div class="td-sub">${d.mutaxassislik} · ${d.tajriba} yillik tajriba</div>
      <div style="display:flex;gap:12px;margin-top:4px;font-size:12px">
        <span style="color:var(--blue)">&#128101; ${d.biriktirilganBemorlar?.length||0} bemor</span>
        <span style="color:var(--green)">&#128197; Bugun: ${d.bugungiNavbat||0} navbat</span>
      </div>
    </div>`).join('') || '<div class="table-empty" style="padding:20px">Yo\'q</div>';

  document.getElementById('tor-list').innerHTML = res.data.tor_shifokorlar.map(d => `
    <div style="padding:12px 20px;border-bottom:1px solid var(--gray-100)">
      <div class="td-name">Dr. ${d.firstName} ${d.lastName}</div>
      <div class="td-sub">${d.mutaxassislik} · ${d.bolim}</div>
      <div style="display:flex;gap:12px;margin-top:4px;font-size:12px">
        <span style="color:var(--purple)">&#128197; Bugun: ${d.bugungiNavbat||0} navbat</span>
        <span style="color:var(--gray-600)">${(d.qabulKunlari||[]).join(', ')}</span>
      </div>
    </div>`).join('') || '<div class="table-empty" style="padding:20px">Yo\'q</div>';
}

async function loadPatients() {
  setLoading('patients-table', 6);
  const res = await api.boshGetPatients();
  if (res?.success) { allPatients = res.data; renderPatients(allPatients); }
  else setEmpty('patients-table', 6, 'Xatolik');
  document.getElementById('pat-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderPatients(allPatients.filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(q) || (p.phone||'').includes(q)));
  });
}

function renderPatients(list) {
  const tbody = document.getElementById('patients-table');
  if (!list.length) { setEmpty('patients-table', 6, 'Bemorlar topilmadi'); return; }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><div class="td-name">${p.firstName} ${p.lastName}</div><div class="td-sub">${p.phone}</div></td>
      <td>${p.jinsi}</td>
      <td>${p.tugilganSana}</td>
      <td>${p.mahalliyShifokor ? 'Dr. '+p.mahalliyShifokor.firstName+' '+p.mahalliyShifokor.lastName : '<span style="color:var(--red)">Biriktirilmagan</span>'}</td>
      <td>${p.tashxislarSoni||0} ta</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="openPatient(${p.id})">Profil</button>
          <button class="btn btn-warning btn-sm" onclick="openTransfer(${p.id},'${p.firstName} ${p.lastName}')">Ko'chirish</button>
        </div>
      </td>
    </tr>`).join('');
}

async function openPatient(id) {
  document.getElementById('patientContent').innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  document.getElementById('patientModal').classList.remove('hidden');
  const res = await api.boshGetPatient(id);
  if (!res?.success) { document.getElementById('patientContent').innerHTML = '<p>Xatolik</p>'; return; }
  const p = res.data;
  document.getElementById('patientContent').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${p.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>${p.firstName} ${p.lastName}</h2>
        <p>${p.jinsi} · Tug'ilgan: ${p.tugilganSana} · Qon guruhi: ${p.qonGuruhi||'—'}</p>
        <p>${p.phone} · ${p.email||'—'}</p>
      </div>
    </div>
    <div class="profile-grid" style="margin-bottom:16px">
      <div class="detail-card"><h3>Shifokor</h3>
        ${p.mahalliyShifokor
          ? `<div class="detail-row"><span class="detail-label">Ismi</span><span class="detail-value">Dr. ${p.mahalliyShifokor.firstName} ${p.mahalliyShifokor.lastName}</span></div>
             <div class="detail-row"><span class="detail-label">Mutaxassislik</span><span class="detail-value">${p.mahalliyShifokor.mutaxassislik}</span></div>`
          : '<p style="color:var(--gray-400);font-size:13px">Biriktirilmagan</p>'}
      </div>
      <div class="detail-card"><h3>Yo'naltirishlar (${p.yonaltirishlar?.length||0})</h3>
        ${(p.yonaltirishlar||[]).map(r => `
          <div class="detail-row">
            <span class="detail-label">${r.torShifokor?.mutaxassislik||'—'}</span>
            <span class="detail-value"><span class="badge badge-${refColorMap[r.holati]||''}">${r.holati}</span></span>
          </div>`).join('') || '<p style="color:var(--gray-400);font-size:13px">Yo\'q</p>'}
      </div>
    </div>
    <div class="detail-card"><h3>Tashxislar (${p.tashxislar?.length||0} ta)</h3>
      ${(p.tashxislar||[]).length === 0
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

async function loadDiagnoses() {
  setLoading('diagnoses-table', 7);
  const res = await api.boshGetDiagnoses();
  if (res?.success) { allDiagnoses = res.data; renderDiagnoses(allDiagnoses); }
  else setEmpty('diagnoses-table', 7, 'Xatolik');
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
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.tavsif}</td>
      <td>${d.bemor ? d.bemor.firstName+' '+d.bemor.lastName : '—'}</td>
      <td>${d.shifokor ? 'Dr. '+d.shifokor.firstName+' '+d.shifokor.lastName : d.shifokorTuri}</td>
      <td><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td>
      <td><span class="badge badge-${holatiClass[d.holati]||''}">${d.holati}</span></td>
      <td>${d.tashxisSana}</td>
    </tr>`).join('');
}

async function loadAppointments() {
  setLoading('appointments-table', 7);
  const sana = document.getElementById('app-sana').value;
  const res  = await api.boshGetApps(sana ? `?sana=${sana}` : '');
  if (res?.success) {
    allApps = res.data;
    const today = new Date().toISOString().split('T')[0];
    const tbody = document.getElementById('appointments-table');
    if (!allApps.length) { setEmpty('appointments-table', 7, 'Navbatlar topilmadi'); return; }
    tbody.innerHTML = allApps.map(a => `
      <tr style="${a.sana === today ? 'background:#f0fdf4' : ''}">
        <td><b>${a.sana}</b>${a.sana === today ? ' <span class="badge badge-faol">Bugun</span>' : ''}</td>
        <td><b>${a.vaqt}</b></td>
        <td>${a.bemor ? a.bemor.firstName+' '+a.bemor.lastName : '—'}</td>
        <td>${a.shifokor ? 'Dr. '+a.shifokor.firstName+' '+a.shifokor.lastName : '—'}</td>
        <td>${a.shifokor?.mutaxassislik||'—'}</td>
        <td>${a.sabab}</td>
        <td><span class="badge badge-${appColorMap[a.holati]||''}">${a.holati}</span></td>
      </tr>`).join('');
  } else setEmpty('appointments-table', 7, 'Xatolik');
}

async function loadReferrals() {
  const el  = document.getElementById('referrals-list');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.boshGetReferrals();
  if (res?.success) { allReferrals = res.data; renderReferrals(allReferrals); }
  else el.innerHTML = '<p style="padding:20px;color:var(--red)">Xatolik</p>';
}

function filterReferrals() {
  const h = document.getElementById('ref-holati').value;
  renderReferrals(h ? allReferrals.filter(r => r.holati === h) : allReferrals);
}

function renderReferrals(list) {
  const el = document.getElementById('referrals-list');
  if (!list.length) { el.innerHTML = '<div class="table-empty" style="padding:30px">Yo\'naltirishlar topilmadi</div>'; return; }
  el.innerHTML = '<div style="padding:16px;display:flex;flex-direction:column;gap:10px">' +
    list.map(r => `
      <div class="ref-card ${refColorMap[r.holati]||''}">
        <div class="ref-card-header">
          <div>
            <div class="td-name">${r.bemor ? r.bemor.firstName+' '+r.bemor.lastName : '—'}</div>
            <div class="td-sub">${r.yuborilganSana}</div>
          </div>
          <span class="badge badge-${refColorMap[r.holati]||''}">${r.holati}</span>
        </div>
        <div class="ref-card-body">
          <b>Yuboruvchi:</b> Dr. ${r.yuboruvchiShifokor ? r.yuboruvchiShifokor.firstName+' '+r.yuboruvchiShifokor.lastName : '—'}<br>
          <b>Qabullovchi:</b> Dr. ${r.qabullovchi ? r.qabullovchi.firstName+' '+r.qabullovchi.lastName+' ('+r.qabullovchi.mutaxassislik+')' : '—'}<br>
          <b>Sabab:</b> ${r.sabab}
        </div>
      </div>`).join('') + '</div>';
}

function openTransfer(patientId, name) {
  transferPatId = patientId;
  document.getElementById('transfer-info').textContent = `"${name}" bemorini boshqa mahalliy shifokorga ko'chirish`;
  document.getElementById('transferError').textContent = '';
  const sel = document.getElementById('transfer-shifokor');
  sel.innerHTML = '<option value="">Shifokor tanlang</option>';
  mahalliyList.forEach(d => {
    sel.innerHTML += `<option value="${d.id}">Dr. ${d.firstName} ${d.lastName} (${d.biriktirilganBemorlar?.length||0} bemor, bugun: ${d.bugungiNavbat||0})</option>`;
  });
  document.getElementById('transferModal').classList.remove('hidden');
}

async function doTransfer() {
  const yangiId = document.getElementById('transfer-shifokor').value;
  if (!yangiId) { document.getElementById('transferError').textContent = 'Shifokor tanlang'; return; }
  const btn = document.getElementById('transferBtn');
  btn.disabled = true; btn.textContent = "Ko'chirilmoqda...";
  const res = await api.boshTransfer(transferPatId, { yangiShifokorId: parseInt(yangiId) });
  btn.disabled = false; btn.textContent = "Ko'chirish";
  if (res?.success) {
    showToast("Bemor muvaffaqiyatli ko'chirildi", 'success');
    closeModal('transferModal'); allPatients = []; loadPatients();
  } else { document.getElementById('transferError').textContent = res?.message || 'Xatolik'; }
}

async function loadProfile() {
  const el  = document.getElementById('profile-content');
  const res = await api.boshGetProfile();
  if (!res?.success) { el.innerHTML = '<div class="alert alert-danger">Profil topilmadi</div>'; return; }
  const d = res.data;
  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${d.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>${d.firstName} ${d.lastName}</h2>
        <p>${d.mutaxassislik} · ${d.bolim}</p>
        <p>${d.phone} · ${d.email}</p>
      </div>
    </div>
    <div class="profile-grid">
      <div class="detail-card"><h3>Kasbiy ma'lumotlar</h3>
        <div class="detail-row"><span class="detail-label">Mutaxassislik</span><span class="detail-value">${d.mutaxassislik}</span></div>
        <div class="detail-row"><span class="detail-label">Bo'lim</span><span class="detail-value">${d.bolim}</span></div>
        <div class="detail-row"><span class="detail-label">Tajriba</span><span class="detail-value">${d.tajriba} yil</span></div>
        <div class="detail-row"><span class="detail-label">Litsenziya</span><span class="detail-value">${d.licenseNumber}</span></div>
      </div>
      <div class="detail-card"><h3>Aloqa</h3>
        <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${d.phone}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${d.email}</span></div>
      </div>
    </div>`;
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
