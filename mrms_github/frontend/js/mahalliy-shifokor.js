let myPatients   = [];
let myDiagnoses  = [];
let torShi       = [];
let editDiagId   = null;

const ogirlikBadge = { 'Yengil':'yengil',"O'rtacha":'ortacha',"Og'ir":'ogir','Kritik':'kritik' };
const holatiClass  = { 'Faol':'faol','Surunkali':'surunkali','Tuzalgan':'tuzalgan' };
const refColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Rad etilgan':'rad' };
const appColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Bekor qilindi':'rad' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth('mahalliy_shifokor')) return;
  renderUserInfo();
  await loadPatients();
});

function showTab(name, el) {
  ['patients','diagnoses','referrals','appointments','profile','password'].forEach(t => {
    const tab = document.getElementById('tab-' + t);
    if (tab) tab.style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (name === 'diagnoses'    && !myDiagnoses.length) loadDiagnoses();
  if (name === 'referrals')                           loadReferrals();
  if (name === 'appointments')                        loadAppointments();
  if (name === 'profile')                             loadProfile();
}

async function changePassword() {
  const eskiParol  = document.getElementById('old-pass').value;
  const yangiParol = document.getElementById('new-pass').value;
  const confirm    = document.getElementById('confirm-pass').value;
  const errEl      = document.getElementById('passError');
  if (!eskiParol || !yangiParol || !confirm) { errEl.textContent = "Barcha maydonlarni to'ldiring"; return; }
  if (yangiParol !== confirm) { errEl.textContent = "Yangi parollar mos kelmadi"; return; }
  if (yangiParol.length < 6)  { errEl.textContent = "Parol kamida 6 ta belgi bo'lishi kerak"; return; }
  errEl.textContent = '';
  const res = await api.changeMyPassword(eskiParol, yangiParol);
  if (res?.success) {
    showToast('Parol muvaffaqiyatli yangilandi!', 'success');
    ['old-pass','new-pass','confirm-pass'].forEach(id => document.getElementById(id).value = '');
  } else { errEl.textContent = res?.message || 'Xatolik'; }
}

async function loadPatients() {
  setLoading('patients-table', 6);
  const res = await api.mahalliyPatients();
  if (res && res.success) {
    myPatients = res.data;
    document.getElementById('st-bemorlar').textContent   = myPatients.length;
    document.getElementById('st-tashxislar').textContent = myPatients.reduce((s, p) => s + (p.tashxislarSoni || 0), 0);
    renderPatients(myPatients);
  } else setEmpty('patients-table', 6, 'Yuklashda xatolik');

  const searchEl = document.getElementById('pat-search');
  if (searchEl) searchEl.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderPatients(myPatients.filter(p =>
      (p.firstName + ' ' + p.lastName).toLowerCase().includes(q) || (p.phone || '').includes(q)
    ));
  });
}

function renderPatients(list) {
  const tbody = document.getElementById('patients-table');
  if (!list.length) { setEmpty('patients-table', 6, 'Bemorlar topilmadi'); return; }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><div class="td-name">${p.firstName} ${p.lastName}</div><div class="td-sub">${p.phone}</div></td>
      <td>${p.tugilganSana}</td>
      <td>${p.jinsi}</td>
      <td>${p.qonGuruhi || '—'}</td>
      <td>${p.tashxislarSoni || 0} ta</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openPatientProfile(${p.id})">Profil ko'rish</button></td>
    </tr>`).join('');
}

async function loadDiagnoses() {
  setLoading('diagnoses-table', 7);
  if (!myPatients.length) { const r = await api.mahalliyPatients(); if (r?.success) myPatients = r.data; }
  const results = [];
  for (const p of myPatients) {
    const r = await api.mahalliyPatient(p.id);
    if (r?.success) (r.data.tashxislar || []).forEach(d => results.push({ ...d, bemor: p }));
  }
  myDiagnoses = results;
  renderDiagnoses(myDiagnoses);
}

function renderDiagnoses(list) {
  const tbody = document.getElementById('diagnoses-table');
  if (!list.length) { setEmpty('diagnoses-table', 7, 'Tashxislar topilmadi'); return; }
  tbody.innerHTML = list.map(d => `
    <tr>
      <td><span class="icd-code">${d.icdKod}</span></td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.tavsif}</td>
      <td>${d.bemor ? d.bemor.firstName + ' ' + d.bemor.lastName : '—'}</td>
      <td><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td>
      <td><span class="badge badge-${holatiClass[d.holati]||''}">${d.holati}</span></td>
      <td>${d.tashxisSana}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openDiagModal(${d.id})">Tahrirlash</button></td>
    </tr>`).join('');
}

async function loadReferrals() {
  const el = document.getElementById('referrals-list');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  if (!torShi.length) { const r = await api.mahalliyGetTorlar(); if (r?.success) torShi = r.data; }
  const res = await api.mahalliyPatients();
  if (!res?.success) { el.innerHTML = '<p style="padding:20px;color:var(--red)">Xatolik</p>'; return; }
  const allRefs = [];
  for (const p of res.data) {
    const r = await api.mahalliyPatient(p.id);
    if (r?.success) (r.data.yonaltirishlar || []).forEach(ref =>
      allRefs.push({ ...ref, bemorNomi: p.firstName + ' ' + p.lastName }));
  }
  if (!allRefs.length) { el.innerHTML = '<div class="table-empty" style="padding:30px">Yo\'naltirishlar yo\'q</div>'; return; }
  el.innerHTML = '<div style="padding:16px;display:flex;flex-direction:column;gap:10px">' +
    allRefs.map(r => `
      <div class="ref-card ${refColorMap[r.holati]||''}">
        <div class="ref-card-header">
          <div><div class="td-name">${r.bemorNomi}</div><div class="td-sub">${r.yuborilganSana}</div></div>
          <span class="badge badge-${refColorMap[r.holati]||''}">${r.holati}</span>
        </div>
        <div class="ref-card-body">
          <b>Mutaxassis:</b> Dr. ${r.torShifokor ? r.torShifokor.firstName + ' ' + r.torShifokor.lastName + ' (' + r.torShifokor.mutaxassislik + ')' : '—'}<br>
          <b>Sabab:</b> ${r.sabab}
          ${r.qabulSana ? '<br><b>Qabul sanasi:</b> ' + r.qabulSana : ''}
        </div>
      </div>`).join('') + '</div>';
}

async function loadAppointments() {
  const el = document.getElementById('appointments-list');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.mahalliyGetApps();
  if (!res?.success) { el.innerHTML = '<p style="padding:20px;color:var(--red)">Xatolik</p>'; return; }
  const list = res.data;
  if (!list.length) { el.innerHTML = '<div class="table-empty" style="padding:30px">Navbatlar yo\'q</div>'; return; }
  const today = new Date().toISOString().split('T')[0];
  el.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Sana</th><th>Vaqt</th><th>Bemor</th><th>Sabab</th><th>Holati</th><th>Amal</th></tr></thead>
      <tbody>
        ${list.map(a => `
          <tr style="${a.sana === today ? 'background:#f0fdf4' : ''}">
            <td><b>${a.sana}</b>${a.sana === today ? ' <span class="badge badge-faol">Bugun</span>' : ''}</td>
            <td><b>${a.vaqt}</b></td>
            <td>${a.bemor ? a.bemor.firstName + ' ' + a.bemor.lastName : '—'}</td>
            <td>${a.sabab}</td>
            <td><span class="badge badge-${appColorMap[a.holati]||''}">${a.holati}</span></td>
            <td>
              ${a.holati === 'Kutilmoqda' ? `
                <button class="btn btn-success btn-sm" onclick="updateApp(${a.id},'Tasdiqlangan')">Tasdiqlash</button>
                <button class="btn btn-danger btn-sm" onclick="updateApp(${a.id},'Bekor qilindi')">Bekor</button>
              ` : '—'}
            </td>
          </tr>`).join('')}
      </tbody>
    </table></div>`;
}

async function updateApp(id, holati) {
  const res = await api.mahalliyUpdateApp(id, { holati });
  if (res?.success) { showToast('Navbat yangilandi', 'success'); await loadAppointments(); }
  else showToast(res?.message || 'Xatolik', 'error');
}

async function loadProfile() {
  const el = document.getElementById('profile-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.mahalliyProfile();
  if (!res?.success) { el.innerHTML = '<p style="color:var(--red)">Xatolik</p>'; return; }
  const d = res.data;
  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${d.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>Dr. ${d.firstName} ${d.lastName}</h2>
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
      <div class="detail-card"><h3>Statistika</h3>
        <div class="detail-row"><span class="detail-label">Bemorlar</span><span class="detail-value">${d.biriktirilganBemorlar?.length || 0} ta</span></div>
        <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${d.phone}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${d.email}</span></div>
      </div>
    </div>`;
}

async function openPatientProfile(id) {
  document.getElementById('profileContent').innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  document.getElementById('profileModal').classList.remove('hidden');
  const res = await api.mahalliyPatient(id);
  if (!res?.success) { document.getElementById('profileContent').innerHTML = '<p>Xatolik</p>'; return; }
  const p = res.data;
  document.getElementById('profileContent').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${p.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>${p.firstName} ${p.lastName}</h2>
        <p>${p.jinsi} · Tug'ilgan: ${p.tugilganSana} · Qon guruhi: ${p.qonGuruhi || '—'}</p>
        <p>${p.phone} · ${p.email || '—'}</p>
      </div>
    </div>
    <div class="profile-grid" style="margin-bottom:16px">
      <div class="detail-card"><h3>Shaxsiy ma'lumotlar</h3>
        <div class="detail-row"><span class="detail-label">Manzil</span><span class="detail-value">${p.manzil || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">Ro'yxatga olingan</span><span class="detail-value">${p.royxatgaOlingan}</span></div>
      </div>
      <div class="detail-card"><h3>Yo'naltirishlar</h3>
        ${(p.yonaltirishlar || []).length === 0
          ? '<p style="color:var(--gray-400);font-size:13px">Yo\'naltirish yo\'q</p>'
          : p.yonaltirishlar.map(r => `
              <div class="detail-row">
                <span class="detail-label">${r.torShifokor?.mutaxassislik || '—'}</span>
                <span class="detail-value"><span class="badge badge-${refColorMap[r.holati]||''}">${r.holati}</span></span>
              </div>`).join('')}
      </div>
    </div>
    <div class="detail-card"><h3>Tashxislar (${(p.tashxislar||[]).length} ta)</h3>
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

async function openDiagModal(id = null) {
  editDiagId = id;
  document.getElementById('diagError').textContent = '';
  document.getElementById('diagModalTitle').textContent = id ? 'Tashxisni tahrirlash' : "Tashxis qo'shish";
  const sel = document.getElementById('d-patientId');
  sel.innerHTML = '<option value="">Bemor tanlang</option>';
  myPatients.forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.firstName} ${p.lastName}</option>`; });
  if (id) {
    const d = myDiagnoses.find(x => x.id === id);
    if (d) {
      document.getElementById('d-patientId').value = d.patientId;
      document.getElementById('d-icdKod').value    = d.icdKod;
      document.getElementById('d-tavsif').value    = d.tavsif;
      document.getElementById('d-ogirlik').value   = d.ogirlikDarajasi;
      document.getElementById('d-holati').value    = d.holati;
      document.getElementById('d-izoh').value      = d.izoh || '';
    }
  } else {
    ['icdKod','tavsif','izoh'].forEach(f => document.getElementById('d-' + f).value = '');
    document.getElementById('d-patientId').value = '';
    document.getElementById('d-ogirlik').value   = '';
    document.getElementById('d-holati').value    = 'Faol';
  }
  document.getElementById('diagModal').classList.remove('hidden');
}

async function saveDiagnosis() {
  const data = {
    patientId: document.getElementById('d-patientId').value,
    icdKod:    document.getElementById('d-icdKod').value.trim(),
    tavsif:    document.getElementById('d-tavsif').value.trim(),
    ogirlikDarajasi: document.getElementById('d-ogirlik').value,
    holati:    document.getElementById('d-holati').value,
    izoh:      document.getElementById('d-izoh').value.trim(),
  };
  if (!data.patientId || !data.icdKod || !data.tavsif || !data.ogirlikDarajasi) {
    document.getElementById('diagError').textContent = "Majburiy maydonlarni to'ldiring"; return;
  }
  const btn = document.getElementById('diagSaveBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = editDiagId
    ? await api.mahalliyUpdateDiag(editDiagId, data)
    : await api.mahalliyAddDiag(data);
  btn.disabled = false; btn.textContent = 'Saqlash';
  if (res && res.success) {
    showToast(editDiagId ? 'Tashxis yangilandi' : "Tashxis qo'shildi", 'success');
    closeModal('diagModal'); myDiagnoses = []; loadDiagnoses();
  } else { document.getElementById('diagError').textContent = res?.message || 'Xatolik'; }
}

async function openRefModal() {
  document.getElementById('refError').textContent = '';
  const pSel = document.getElementById('r-patientId');
  pSel.innerHTML = '<option value="">Bemor tanlang</option>';
  myPatients.forEach(p => { pSel.innerHTML += `<option value="${p.id}">${p.firstName} ${p.lastName}</option>`; });
  if (!torShi.length) { const r = await api.mahalliyGetTorlar(); if (r?.success) torShi = r.data; }
  const tSel = document.getElementById('r-torId');
  tSel.innerHTML = '<option value="">Shifokor tanlang</option>';
  torShi.forEach(d => { tSel.innerHTML += `<option value="${d.id}">Dr. ${d.firstName} ${d.lastName} — ${d.mutaxassislik}</option>`; });
  document.getElementById('r-sabab').value = '';
  document.getElementById('refModal').classList.remove('hidden');
}

async function saveReferral() {
  const data = {
    patientId:             document.getElementById('r-patientId').value,
    qabullovchiShifokorId: document.getElementById('r-torId').value,
    sabab:                 document.getElementById('r-sabab').value.trim(),
  };
  if (!data.patientId || !data.qabullovchiShifokorId || !data.sabab) {
    document.getElementById('refError').textContent = "Barcha maydonlarni to'ldiring"; return;
  }
  const btn = document.getElementById('refSaveBtn');
  btn.disabled = true; btn.textContent = 'Yuborilmoqda...';
  const res = await api.mahalliyCreateRef(data);
  btn.disabled = false; btn.textContent = 'Yuborish';
  if (res && res.success) {
    showToast("Yo'naltirish yuborildi", 'success');
    closeModal('refModal'); loadReferrals();
  } else { document.getElementById('refError').textContent = res?.message || 'Xatolik'; }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); editDiagId = null; }
