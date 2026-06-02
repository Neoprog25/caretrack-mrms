let allReferrals = [];
let myProfile    = null;

const refColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Rad etilgan':'rad' };
const appColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Bekor qilindi':'rad' };
const ogirlikBadge = { 'Yengil':'yengil',"O'rtacha":'ortacha',"Og'ir":'ogir','Kritik':'kritik' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth('tor_shifokor')) return;
  renderUserInfo();
  const today = new Date().toISOString().split('T')[0];
  const sanaEl = document.getElementById('app-sana');
  if (sanaEl) sanaEl.value = today;
  await loadReferrals();
  document.getElementById('ref-holati').addEventListener('change', e => {
    const h = e.target.value;
    renderReferrals(h ? allReferrals.filter(r => r.holati === h) : allReferrals);
  });
});

function showTab(name, el) {
  ['referrals','appointments','profile','password'].forEach(t => {
    const tab = document.getElementById('tab-' + t);
    if (tab) tab.style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (name === 'appointments') { loadTodayApps(); }
  if (name === 'profile')      { loadProfile(); }
}

// ─── YO'NALTIRISHLAR ─────────────────────────────
async function loadReferrals() {
  const el = document.getElementById('referrals-list');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.torReferrals();
  if (!res?.success) { el.innerHTML = '<p style="padding:20px;color:var(--red)">Xatolik: ' + (res?.message||'') + '</p>'; return; }
  allReferrals = res.data;
  document.getElementById('st-kutilmoqda').textContent   = allReferrals.filter(r => r.holati === 'Kutilmoqda').length;
  document.getElementById('st-tasdiqlangan').textContent = allReferrals.filter(r => r.holati === 'Tasdiqlangan').length;
  document.getElementById('st-rad').textContent          = allReferrals.filter(r => r.holati === 'Rad etilgan').length;
  renderReferrals(allReferrals);
}

function renderReferrals(list) {
  const el = document.getElementById('referrals-list');
  if (!list.length) { el.innerHTML = '<div class="table-empty" style="padding:30px">Yo\'naltirishlar topilmadi</div>'; return; }
  el.innerHTML = list.map(r => `
    <div class="ref-card ${refColorMap[r.holati]||''}" style="margin:12px">
      <div class="ref-card-header">
        <div>
          <div class="td-name">${r.bemor ? r.bemor.firstName+' '+r.bemor.lastName : '—'}</div>
          <div class="td-sub">${r.yuborilganSana} · Dr. ${r.yuboruvchiShifokor ? r.yuboruvchiShifokor.firstName+' '+r.yuboruvchiShifokor.lastName : '—'}</div>
        </div>
        <span class="badge badge-${refColorMap[r.holati]||''}">${r.holati}</span>
      </div>
      <div class="ref-card-body"><b>Sabab:</b> ${r.sabab}</div>
      <div class="ref-card-footer">
        <button class="btn btn-secondary btn-sm" onclick="openPatient(${r.patientId})">&#128100; Bemor profili</button>
        <button class="btn btn-purple btn-sm" onclick="openConsult(${r.patientId})">&#129657; Konsultatsiya</button>
        ${r.holati === 'Kutilmoqda' ? `
          <button class="btn btn-success btn-sm" onclick="updateRef(${r.id},'Tasdiqlangan')">&#9989; Tasdiqlash</button>
          <button class="btn btn-danger btn-sm" onclick="updateRef(${r.id},'Rad etilgan')">&#10060; Rad etish</button>
        ` : ''}
      </div>
    </div>`).join('');
}

async function updateRef(id, holati) {
  if (!confirm(`Yo'naltirishni ${holati === 'Tasdiqlangan' ? 'tasdiqlaysizmi' : 'rad etasizmi'}?`)) return;
  const res = await api.torUpdateRef(id, { holati });
  if (res?.success) { showToast('Holat yangilandi', 'success'); await loadReferrals(); }
  else showToast(res?.message || 'Xatolik', 'error');
}

// ─── BEMOR PROFILI ────────────────────────────────
async function openPatient(id) {
  document.getElementById('patientContent').innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  document.getElementById('patientModal').classList.remove('hidden');
  const res = await api.torPatient(id);
  if (!res?.success) { document.getElementById('patientContent').innerHTML = '<p style="color:var(--red)">Xatolik: ' + (res?.message||'Ruxsat yo\'q') + '</p>'; return; }
  const p = res.data;
  document.getElementById('patientContent').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${p.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>${p.firstName} ${p.lastName}</h2>
        <p>${p.jinsi || '—'} · Tug'ilgan: ${p.tugilganSana || '—'} · Qon guruhi: ${p.qonGuruhi||'—'}</p>
        <p>${p.phone || '—'}</p>
      </div>
    </div>
    <div class="detail-card" style="margin-bottom:14px"><h3>Mahalliy shifokor</h3>
      ${p.mahalliyShifokor
        ? `<div class="detail-row"><span class="detail-label">Ismi</span><span class="detail-value">Dr. ${p.mahalliyShifokor.firstName} ${p.mahalliyShifokor.lastName}</span></div>
           <div class="detail-row"><span class="detail-label">Bo'lim</span><span class="detail-value">${p.mahalliyShifokor.bolim}</span></div>`
        : '<p style="color:var(--gray-400);font-size:13px">Shifokor biriktirilmagan</p>'}
    </div>
    <div class="detail-card"><h3>Tashxislar tarixi (${p.tashxislar?.length||0} ta)</h3>
      ${!(p.tashxislar?.length)
        ? '<p style="color:var(--gray-400);font-size:13px;padding:8px 0">Tashxis yo\'q</p>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>ICD</th><th>Tavsif</th><th>Og'irlik</th><th>Sana</th></tr></thead>
            <tbody>${p.tashxislar.map(d => `
              <tr>
                <td><span class="icd-code">${d.icdKod}</span></td>
                <td>${d.tavsif}</td>
                <td><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td>
                <td>${d.tashxisSana}</td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>
    <div style="margin-top:14px">
      <button class="btn btn-purple btn-sm" onclick="openConsult(${p.id});closeModal('patientModal')">&#129657; Konsultatsiya qo'shish</button>
    </div>`;
}

function openConsult(patientId) {
  document.getElementById('c-patientId').value = patientId;
  document.getElementById('consultError').textContent = '';
  ['c-icdKod','c-tavsif','c-izoh'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('c-ogirlik').value = '';
  document.getElementById('consultModal').classList.remove('hidden');
}

async function saveConsultation() {
  const data = {
    patientId:       document.getElementById('c-patientId').value,
    icdKod:          document.getElementById('c-icdKod').value.trim(),
    tavsif:          document.getElementById('c-tavsif').value.trim(),
    ogirlikDarajasi: document.getElementById('c-ogirlik').value,
    izoh:            document.getElementById('c-izoh').value.trim(),
    holati:          'Faol',
  };
  if (!data.icdKod || !data.tavsif || !data.ogirlikDarajasi) {
    document.getElementById('consultError').textContent = "Majburiy maydonlarni to'ldiring"; return;
  }
  const btn = document.getElementById('consultSaveBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = await api.torAddConsult(data);
  btn.disabled = false; btn.textContent = 'Saqlash';
  if (res?.success) { showToast('Konsultatsiya saqlandi', 'success'); closeModal('consultModal'); }
  else { document.getElementById('consultError').textContent = res?.message || 'Xatolik'; }
}

// ─── NAVBAT JADVALI ───────────────────────────────
function loadTodayApps() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('app-sana').value = today;
  loadAppointments();
}

async function loadAppointments() {
  setLoading('appointments-table', 6);
  const sana = document.getElementById('app-sana').value;
  const res = await api.torGetApps(sana ? `?sana=${sana}` : '');
  if (!res?.success) { setEmpty('appointments-table', 6, 'Xatolik'); return; }
  const list = res.data;
  if (!list.length) { setEmpty('appointments-table', 6, 'Ushbu sanada navbatlar yo\'q'); return; }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('appointments-table').innerHTML = list.map(a => {
    const yosh = a.bemor?.tugilganSana ? (() => {
      const b = new Date(a.bemor.tugilganSana), now = new Date();
      let y = now.getFullYear() - b.getFullYear();
      if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) y--;
      return y;
    })() : null;
    return `<tr style="${a.sana === today && a.holati==='Kutilmoqda' ? 'background:#f0fdf4' : ''}">
      <td><b>${a.vaqt}</b></td>
      <td>
        <div class="td-name">${a.bemor ? a.bemor.firstName+' '+a.bemor.lastName : '—'}</div>
        <div class="td-sub">${a.bemor?.phone||'—'}</div>
      </td>
      <td>${yosh !== null ? yosh + ' yosh' : '—'}</td>
      <td>${a.sabab}</td>
      <td><span class="badge badge-${appColorMap[a.holati]||''}">${a.holati}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="openPatient(${a.patientId})">Profil</button>
          <button class="btn btn-purple btn-sm" onclick="openConsult(${a.patientId})">Tashxis</button>
          ${a.holati === 'Kutilmoqda' ? `
            <button class="btn btn-success btn-sm" onclick="updateApp(${a.id},'Tasdiqlangan')">Tasdiqlash</button>
            <button class="btn btn-danger btn-sm" onclick="updateApp(${a.id},'Bekor qilindi')">Bekor</button>
          ` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function updateApp(id, holati) {
  const res = await api.torUpdateApp(id, { holati });
  if (res?.success) { showToast('Navbat yangilandi', 'success'); await loadAppointments(); }
  else showToast(res?.message || 'Xatolik', 'error');
}

// ─── PROFIL ───────────────────────────────────────
async function loadProfile() {
  const el  = document.getElementById('profile-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.torProfile();
  if (!res?.success) { el.innerHTML = '<div class="alert alert-danger">Profil topilmadi: ' + (res?.message||'') + '</div>'; return; }
  myProfile = res.data;
  renderProfile(myProfile);
}

function renderProfile(d) {
  const el = document.getElementById('profile-content');
  el.innerHTML = `
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
        <div class="detail-row"><span class="detail-label">Smena</span><span class="detail-value">${d.ish_smenasi === 'kecha' ? '🌙 Kecha smenasi' : '☀️ Kunduz smenasi'}</span></div>
        <div class="detail-row"><span class="detail-label">Ish vaqti</span><span class="detail-value">${d.ish_boshlanish||'09:00'} – ${d.ish_tugash||'17:00'}</span></div>
      </div>
      <div class="detail-card"><h3>Qabul jadvali</h3>
        ${(d.qabulKunlari||[]).map(k => `<div class="detail-row"><span class="detail-label">${k}</span><span class="detail-value" style="color:var(--green)">&#9989; Qabul kuni</span></div>`).join('') || '<p style="color:var(--gray-400);font-size:13px">Qabul kunlari belgilanmagan</p>'}
        <div class="detail-row" style="margin-top:8px"><span class="detail-label">Telefon</span><span class="detail-value">${d.phone||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${d.email||'—'}</span></div>
      </div>
    </div>`;
}

function openEditProfile() {
  if (!myProfile) return;
  document.getElementById('ep-phone').value = myProfile.phone || '';
  document.getElementById('ep-email').value = myProfile.email || '';
  document.getElementById('editProfileError').textContent = '';
  // Checkboxlarni belgilash
  document.querySelectorAll('#qabul-kunlar input[type=checkbox]').forEach(cb => {
    cb.checked = (myProfile.qabulKunlari || []).includes(cb.value);
  });
  document.getElementById('editProfileModal').classList.remove('hidden');
}

async function saveProfile() {
  const qabulKunlari = [];
  document.querySelectorAll('#qabul-kunlar input[type=checkbox]:checked').forEach(cb => qabulKunlari.push(cb.value));
  const data = {
    phone:        document.getElementById('ep-phone').value.trim(),
    email:        document.getElementById('ep-email').value.trim(),
    qabulKunlari,
  };
  const btn = document.getElementById('editProfileBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = await api.torUpdateProfile(data);
  btn.disabled = false; btn.textContent = 'Saqlash';
  if (res?.success) {
    showToast('Profil yangilandi', 'success');
    closeModal('editProfileModal');
    await loadProfile();
  } else { document.getElementById('editProfileError').textContent = res?.message || 'Xatolik'; }
}

// ─── PAROL O'ZGARTIRISH ───────────────────────────
async function changePassword() {
  const eskiParol = document.getElementById('old-pass').value;
  const yangiParol = document.getElementById('new-pass').value;
  const confirm   = document.getElementById('confirm-pass').value;
  const errEl     = document.getElementById('passError');

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

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
