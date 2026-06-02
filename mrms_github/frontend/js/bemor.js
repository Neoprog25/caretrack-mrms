let myData       = null;
let allShifokors = { mahalliy: [], tor: [] };
let allNavbatlar = [];
let selectedVaqt = null;

const ogirlikBadge = { 'Yengil':'yengil',"O'rtacha":'ortacha',"Og'ir":'ogir','Kritik':'kritik' };
const holatiClass  = { 'Faol':'faol','Surunkali':'surunkali','Tuzalgan':'tuzalgan' };
const refColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Rad etilgan':'rad' };
const appColorMap  = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Bekor qilindi':'rad' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth('bemor')) return;
  renderUserInfo();
  const today = new Date().toISOString().split('T')[0];
  const sanaEl = document.getElementById('b-sana');
  if (sanaEl) { sanaEl.min = today; sanaEl.value = today; }
  // Sana matnini ko'rsatish
  const dashSana = document.getElementById('dash-sana');
  if (dashSana) {
    const d = new Date();
    const kunlar = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    const oylar  = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    dashSana.textContent = `${kunlar[d.getDay()]}, ${d.getDate()} ${oylar[d.getMonth()]} ${d.getFullYear()}`;
  }
  await Promise.all([loadProfile(), loadShifokorData()]);
});

function showTab(name, el) {
  ['dashboard','profile','diagnoses','appointments','booking','referrals','edit','password'].forEach(t => {
    const tab = document.getElementById('tab-' + t);
    if (tab) tab.style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('.nav-link').forEach(l => {
      if (l.getAttribute('onclick')?.includes(`'${name}'`)) l.classList.add('active');
    });
  }
  if (name === 'diagnoses'    && myData) renderDiagnoses(myData.tashxislar || []);
  if (name === 'appointments')           loadMyAppointments();
  if (name === 'referrals'    && myData) renderReferrals(myData.yonaltirishlar || []);
  if (name === 'edit'         && myData) prefillEdit();
  if (name === 'booking')                loadAllShifokors();
}

// ─── PROFIL YUKLASH ───────────────────────────────
async function loadProfile() {
  const res = await api.bemorProfile();
  if (!res?.success) return;
  myData = res.data;
  await renderDashboard();
  renderProfileMain();
}

async function loadShifokorData() {
  const res = await api.bemorGetShifokors();
  if (res?.success) allShifokors = res.data;
}

// ─── DASHBOARD ────────────────────────────────────
async function renderDashboard() {
  if (!myData) return;
  const p = myData;
  // Greet
  const greetEl = document.getElementById('dash-greet');
  if (greetEl) greetEl.textContent = `Xush kelibsiz, ${p.firstName}!`;
  // Statistika
  document.getElementById('ds-tashxis').textContent = (p.tashxislar||[]).length;
  document.getElementById('ds-kritik').textContent  = (p.tashxislar||[]).filter(d => d.ogirlikDarajasi === 'Kritik').length;
  document.getElementById('ds-yonalt').textContent  = (p.yonaltirishlar||[]).length;

  // Navbatlarni olish
  const aRes = await api.bemorGetApps();
  if (aRes?.success) {
    allNavbatlar = aRes.data;
    document.getElementById('ds-navbat').textContent = allNavbatlar.length;
    renderNextApp(allNavbatlar);
  }

  // Shifokor kartasi
  renderMyDoctor(p.mahalliyShifokor);

  // So'nggi tashxislar
  renderDashDiagnoses(p.tashxislar || []);
}

function renderNextApp(navbatlar) {
  const el    = document.getElementById('next-app-content');
  const today = new Date().toISOString().split('T')[0];
  const hozir = new Date();

  // Kelajakdagi, bekor qilinmagan navbatlarni topamiz
  const kelasi = navbatlar
    .filter(a => a.holati !== 'Bekor qilindi' && (a.sana > today || (a.sana === today && new Date(a.sana + 'T' + a.vaqt) > hozir)))
    .sort((a, b) => (a.sana + a.vaqt).localeCompare(b.sana + b.vaqt));

  if (!kelasi.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:16px">
        <div style="font-size:32px;margin-bottom:8px">📅</div>
        <p style="color:var(--gray-600);font-size:13px">Rejalashtirilgan navbat yo'q</p>
        <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="showTab('booking',null)">Navbat olish</button>
      </div>`;
    return;
  }

  const a   = kelasi[0];
  const doc = a.shifokor;
  const d   = new Date(a.sana);
  const oylar = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const bugun = a.sana === today;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px">
      <div style="background:${bugun?'#dbeafe':'#f0fdf4'};border-radius:12px;padding:14px 18px;text-align:center;flex-shrink:0">
        <div style="font-size:22px;font-weight:700;color:${bugun?'#1e40af':'#166534'};line-height:1">${d.getDate()}</div>
        <div style="font-size:11px;color:${bugun?'#3b82f6':'#16a34a'};margin-top:2px">${oylar[d.getMonth()]}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700;color:var(--navy)">${a.vaqt}
          ${bugun ? '<span class="badge badge-faol" style="margin-left:6px;font-size:11px">Bugun</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--gray-600);margin-top:2px">
          ${doc ? 'Dr. '+doc.firstName+' '+doc.lastName+' — '+doc.mutaxassislik : '—'}
        </div>
        <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${a.sabab}</div>
      </div>
    </div>
    ${kelasi.length > 1 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100);font-size:12px;color:var(--gray-600)">Yana ${kelasi.length-1} ta rejalashtirilgan navbat bor</div>` : ''}`;
}

function renderMyDoctor(doc) {
  const el = document.getElementById('my-doctor-content');
  if (!doc) {
    el.innerHTML = `<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:16px">Mahalliy shifokor biriktirilmagan</p>`;
    return;
  }
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="width:46px;height:46px;background:#e8f0fc;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--blue);flex-shrink:0">${doc.firstName.charAt(0)}</div>
      <div>
        <div style="font-weight:600;color:var(--navy)">Dr. ${doc.firstName} ${doc.lastName}</div>
        <div style="font-size:12px;color:var(--gray-600)">${doc.mutaxassislik} · ${doc.bolim}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
      <div style="background:var(--gray-50);border-radius:6px;padding:8px">
        <div style="color:var(--gray-400)">Ish vaqti</div>
        <div style="font-weight:600;color:var(--navy)">${doc.ish_boshlanish||'09:00'} – ${doc.ish_tugash||'17:00'}</div>
      </div>
      <div style="background:var(--gray-50);border-radius:6px;padding:8px">
        <div style="color:var(--gray-400)">Qabul kunlari</div>
        <div style="font-weight:600;color:var(--navy)">${(doc.qabulKunlari||[]).join(', ')||'—'}</div>
      </div>
    </div>
    <div style="margin-top:10px">
      <button class="btn btn-secondary btn-sm" onclick="showTab('booking',null)">Bu shifokorga navbat olish</button>
    </div>`;
}

function renderDashDiagnoses(list) {
  const el = document.getElementById('dash-diagnoses');
  const recent = [...list].sort((a,b) => b.tashxisSana?.localeCompare(a.tashxisSana||'')).slice(0, 5);
  if (!recent.length) {
    el.innerHTML = '<div class="table-empty" style="padding:30px">Tashxislar yo\'q</div>';
    return;
  }
  el.innerHTML = recent.map(d => `
    <div style="padding:10px 16px;border-bottom:0.5px solid var(--gray-100);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="icd-code">${d.icdKod}</span>
          <span style="font-size:13px;font-weight:500">${d.tavsif}</span>
        </div>
        <div style="font-size:11px;color:var(--gray-400);margin-top:2px">${d.tashxisSana||'—'}</div>
      </div>
      <span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span>
    </div>`).join('');
}

// ─── PROFIL ───────────────────────────────────────
function renderProfileMain() {
  const p   = myData;
  const doc = p.mahalliyShifokor;
  document.getElementById('profile-main').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${p.firstName.charAt(0)}</div>
      <div class="profile-info">
        <h2>${p.firstName} ${p.lastName}</h2>
        <p>${p.jinsi||'—'} · Tug'ilgan: ${p.tugilganSana||'—'} · ${p.yosh !== null ? p.yosh+' yosh' : ''} · Qon guruhi: ${p.qonGuruhi||'—'}</p>
        <p>&#128222; ${p.phone} · &#9993; ${p.email||'—'}</p>
      </div>
    </div>
    <div class="three-col" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon orange">&#129657;</div><div><div class="stat-value">${(p.tashxislar||[]).length}</div><div class="stat-label">Tashxislar</div></div></div>
      <div class="stat-card"><div class="stat-icon red">&#9888;</div><div><div class="stat-value">${(p.tashxislar||[]).filter(d=>d.ogirlikDarajasi==='Kritik').length}</div><div class="stat-label">Kritik</div></div></div>
      <div class="stat-card"><div class="stat-icon purple">&#128260;</div><div><div class="stat-value">${(p.yonaltirishlar||[]).length}</div><div class="stat-label">Yo'naltirishlar</div></div></div>
    </div>
    <div class="two-col">
      <div class="detail-card">
        <h3>Shaxsiy ma'lumotlar</h3>
        <div class="detail-row"><span class="detail-label">To'liq ism</span><span class="detail-value">${p.firstName} ${p.lastName}</span></div>
        <div class="detail-row"><span class="detail-label">Tug'ilgan sana</span><span class="detail-value">${p.tugilganSana||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Yoshi</span><span class="detail-value">${p.yosh !== null ? p.yosh+' yosh' : '—'}</span></div>
        <div class="detail-row"><span class="detail-label">Jinsi</span><span class="detail-value">${p.jinsi||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Qon guruhi</span><span class="detail-value">${p.qonGuruhi||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Manzil</span><span class="detail-value">${p.manzil||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Ro'yxat sanasi</span><span class="detail-value">${p.royxatgaOlingan||'—'}</span></div>
      </div>
      <div class="detail-card">
        <h3>Mahalliy shifokor</h3>
        ${doc ? `
          <div class="detail-row"><span class="detail-label">Ismi</span><span class="detail-value">Dr. ${doc.firstName} ${doc.lastName}</span></div>
          <div class="detail-row"><span class="detail-label">Mutaxassislik</span><span class="detail-value">${doc.mutaxassislik}</span></div>
          <div class="detail-row"><span class="detail-label">Bo'lim</span><span class="detail-value">${doc.bolim}</span></div>
          <div class="detail-row"><span class="detail-label">Ish vaqti</span><span class="detail-value">${doc.ish_boshlanish||'09:00'} – ${doc.ish_tugash||'17:00'}</span></div>
          <div class="detail-row"><span class="detail-label">Qabul kunlari</span><span class="detail-value">${(doc.qabulKunlari||[]).join(', ')||'—'}</span></div>
          <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${doc.phone||'—'}</span></div>
        ` : '<p style="color:var(--gray-400);font-size:13px">Shifokor biriktirilmagan</p>'}
      </div>
    </div>`;
}

// ─── TASHXISLAR ───────────────────────────────────
function renderDiagnoses(list) {
  const tbody = document.getElementById('diagnoses-table');
  if (!list.length) { setEmpty('diagnoses-table', 5, 'Tashxislar topilmadi'); return; }
  tbody.innerHTML = list.map(d => `
    <tr>
      <td><span class="icd-code">${d.icdKod}</span></td>
      <td>${d.tavsif}</td>
      <td><span class="badge badge-${ogirlikBadge[d.ogirlikDarajasi]||''}">${d.ogirlikDarajasi}</span></td>
      <td><span class="badge badge-${holatiClass[d.holati]||''}">${d.holati}</span></td>
      <td>${d.tashxisSana||'—'}</td>
    </tr>`).join('');
}

// ─── NAVBATLAR ────────────────────────────────────
async function loadMyAppointments() {
  const el = document.getElementById('appointments-list');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.bemorGetApps();
  if (!res?.success) { el.innerHTML = '<p style="color:var(--red);padding:20px">Xatolik</p>'; return; }
  allNavbatlar = res.data;
  if (!allNavbatlar.length) {
    el.innerHTML = `<div class="table-empty" style="padding:30px">
      Navbatlar yo'q. <a href="#" onclick="showTab('booking',null);return false" style="color:var(--blue)">Navbat olish</a>
    </div>`;
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  const hozir = new Date();
  el.innerHTML = `
    <div class="table-wrap card"><table>
      <thead><tr><th>Sana</th><th>Vaqt</th><th>Shifokor</th><th>Mutaxassislik</th><th>Ish vaqti</th><th>Sabab</th><th>Holati</th><th>Amal</th></tr></thead>
      <tbody>${allNavbatlar.map(a => {
        const navbatVaqt  = new Date(a.sana + 'T' + a.vaqt);
        const bekorMumkin = a.holati === 'Kutilmoqda' && (navbatVaqt - hozir) > 2*60*60*1000;
        return `
          <tr style="${a.sana === today && a.holati !== 'Bekor qilindi' ? 'background:#f0fdf4' : ''}">
            <td><b>${a.sana}</b>${a.sana===today?' <span class="badge badge-faol">Bugun</span>':''}</td>
            <td><b>${a.vaqt}</b></td>
            <td>${a.shifokor ? 'Dr. '+a.shifokor.firstName+' '+a.shifokor.lastName : '—'}</td>
            <td>${a.shifokor?.mutaxassislik||'—'}</td>
            <td style="font-size:12px;color:var(--gray-600)">${a.shifokor?.ish_boshlanish||'09:00'}–${a.shifokor?.ish_tugash||'17:00'}</td>
            <td>${a.sabab}</td>
            <td><span class="badge badge-${appColorMap[a.holati]||''}">${a.holati}</span></td>
            <td>${bekorMumkin ? `<button class="btn btn-danger btn-sm" onclick="cancelApp(${a.id})">Bekor</button>` : '—'}</td>
          </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
}

async function cancelApp(id) {
  if (!confirm('Navbatni bekor qilmoqchimisiz?')) return;
  const res = await api.bemorCancelApp(id);
  if (res?.success) {
    showToast('Navbat bekor qilindi', 'success');
    await loadMyAppointments();
    await loadProfile();
  } else showToast(res?.message || 'Xatolik', 'error');
}

// ─── NAVBAT OLISH ─────────────────────────────────
async function loadAllShifokors() {
  if (allShifokors.mahalliy.length || allShifokors.tor.length) return;
  const res = await api.bemorGetShifokors();
  if (res?.success) allShifokors = res.data;
}

function loadShifokorList() {
  const turi  = document.getElementById('b-turi').value;
  const selEl = document.getElementById('b-shifokor');
  const list  = turi === 'mahalliy_shifokor' ? allShifokors.mahalliy : allShifokors.tor;
  selEl.innerHTML = '<option value="">Shifokor tanlang</option>';
  list.forEach(d => {
    const kun = (d.qabulKunlari||[]).join(', ') || '—';
    selEl.innerHTML += `<option value="${d.id}">Dr. ${d.firstName} ${d.lastName} — ${d.mutaxassislik} (${kun})</option>`;
  });
  document.getElementById('schedule-block').style.display = 'none';
  selectedVaqt = null;
}

async function loadSchedule() {
  const turi       = document.getElementById('b-turi').value;
  const shifokorId = document.getElementById('b-shifokor').value;
  const sana       = document.getElementById('b-sana').value;
  if (!turi || !shifokorId || !sana) return;

  const res = await api.bemorGetSchedule(shifokorId, turi, sana);
  if (!res?.success) return;

  document.getElementById('schedule-block').style.display = '';
  selectedVaqt = null;

  const doc = (turi === 'mahalliy_shifokor' ? allShifokors.mahalliy : allShifokors.tor)
    .find(d => d.id === parseInt(shifokorId));
  const infoEl = document.getElementById('schedule-info');
  if (infoEl && doc) {
    infoEl.innerHTML = `&#128197; ${(doc.qabulKunlari||[]).join(', ')||'—'} &nbsp;|&nbsp;
      &#128336; ${doc.ish_boshlanish||'09:00'}–${doc.ish_tugash||'17:00'} &nbsp;|&nbsp;
      <span style="color:var(--green)">&#9989; Bo'sh: <b>${res.data.bos}</b></span> &nbsp;
      <span style="color:var(--red)">&#128274; Band: <b>${res.data.band}</b></span>`;
  }

  document.getElementById('schedule-grid').innerHTML = res.data.barcha.map(v => {
    if (v.tushlik) return `<button disabled style="padding:8px 12px;border-radius:8px;font-size:11px;cursor:not-allowed;border:1px dashed #d1d5db;background:#f9fafb;color:#9ca3af;min-width:70px;text-align:center">${v.vaqt}<br><span style="font-size:10px">Tushlik</span></button>`;
    if (v.otgan)   return `<button disabled style="padding:8px 12px;border-radius:8px;font-size:13px;cursor:not-allowed;border:1px solid #e5e7eb;background:#f9fafb;color:#d1d5db;text-decoration:line-through;min-width:70px">${v.vaqt}</button>`;
    if (v.band)    return `<button disabled style="padding:8px 12px;border-radius:8px;font-size:11px;cursor:not-allowed;border:2px solid #fecaca;background:#fef2f2;color:#dc2626;min-width:70px;text-align:center">${v.vaqt}<br><span style="font-size:10px">Band</span></button>`;
    return `<button class="vaqt-btn bos" onclick="selectVaqt('${v.vaqt}',this)" style="padding:8px 12px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:2px solid var(--blue);background:white;color:var(--blue);transition:all .15s;min-width:70px">${v.vaqt}</button>`;
  }).join('');
}

function selectVaqt(vaqt, btn) {
  document.querySelectorAll('.vaqt-btn.bos').forEach(b => { b.style.background='white'; b.style.color='var(--blue)'; b.style.fontWeight='500'; });
  btn.style.background = 'var(--blue)'; btn.style.color = 'white'; btn.style.fontWeight = '700';
  selectedVaqt = vaqt;
}

async function bookAppointment() {
  const turi       = document.getElementById('b-turi').value;
  const shifokorId = document.getElementById('b-shifokor').value;
  const sana       = document.getElementById('b-sana').value;
  const sabab      = document.getElementById('b-sabab').value.trim();
  const errEl      = document.getElementById('bookingError');
  if (!turi || !shifokorId || !sana || !sabab) { errEl.textContent = "Barcha maydonlarni to'ldiring"; return; }
  if (!selectedVaqt) { errEl.textContent = 'Vaqt tanlang'; return; }
  errEl.textContent = '';
  const btn = document.getElementById('bookingBtn');
  btn.disabled = true; btn.textContent = 'Yozilmoqda...';
  const res = await api.bemorCreateApp({ shifokorId: parseInt(shifokorId), shifokorTuri: turi, sana, vaqt: selectedVaqt, sabab });
  btn.disabled = false; btn.textContent = '✓ Navbatga yozilish';
  if (res?.success) {
    showToast(`${sana} kuni ${selectedVaqt} ga muvaffaqiyatli yozildingiz!`, 'success');
    selectedVaqt = null;
    document.getElementById('schedule-block').style.display = 'none';
    document.getElementById('b-sabab').value = '';
    await loadMyAppointments();
    await loadProfile();
    showTab('appointments', null);
  } else { errEl.textContent = res?.message || 'Xatolik'; }
}

// ─── YO'NALTIRISHLAR ──────────────────────────────
function renderReferrals(list) {
  const el = document.getElementById('referrals-list');
  if (!list.length) {
    el.innerHTML = '<div class="table-empty" style="padding:30px">Yo\'naltirishlar yo\'q</div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;padding:16px">' +
    list.map(r => `
      <div class="ref-card ${refColorMap[r.holati]||''}">
        <div class="ref-card-header">
          <div>
            <div class="td-name">${r.torShifokor ? 'Dr. '+r.torShifokor.firstName+' '+r.torShifokor.lastName : '—'}</div>
            <div class="td-sub">${r.torShifokor?.mutaxassislik||'—'} · ${r.torShifokor?.bolim||'—'}</div>
            <div class="td-sub">&#128197; Yuborilgan: ${r.yuborilganSana||'—'}${r.qabulSana ? ' · Qabul: '+r.qabulSana : ''}</div>
          </div>
          <span class="badge badge-${refColorMap[r.holati]||''}">${r.holati}</span>
        </div>
        <div class="ref-card-body"><b>Sabab:</b> ${r.sabab}</div>
        ${r.torShifokor?.phone ? `<div style="margin-top:8px;font-size:12px;color:var(--gray-600)">&#128222; ${r.torShifokor.phone}</div>` : ''}
        ${r.holati === 'Tasdiqlangan' ? `
          <div style="margin-top:10px">
            <button class="btn btn-primary btn-sm" onclick="showTab('booking',null)">Bu shifokorga navbat olish</button>
          </div>` : ''}
      </div>`).join('') + '</div>';
}

// ─── MA'LUMOTLARNI YANGILASH ──────────────────────
function prefillEdit() {
  if (!myData) return;
  document.getElementById('upd-phone').value  = myData.phone  || '';
  document.getElementById('upd-email').value  = myData.email  || '';
  document.getElementById('upd-manzil').value = myData.manzil || '';
  document.getElementById('editError').textContent = '';
}

async function saveMyInfo() {
  const data = {
    phone:  document.getElementById('upd-phone').value.trim(),
    email:  document.getElementById('upd-email').value.trim(),
    manzil: document.getElementById('upd-manzil').value.trim(),
  };
  if (!data.phone) { document.getElementById('editError').textContent = 'Telefon majburiy'; return; }
  const btn = document.getElementById('editBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = await api.bemorUpdate(data);
  btn.disabled = false; btn.textContent = '✓ Saqlash';
  if (res?.success) {
    showToast("Ma'lumotlar yangilandi!", 'success');
    await loadProfile();
    showTab('profile', null);
  } else { document.getElementById('editError').textContent = res?.message || 'Xatolik'; }
}

// ─── PAROL O'ZGARTIRISH ───────────────────────────
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
    showToast("Parol muvaffaqiyatli yangilandi!", 'success');
    ['old-pass','new-pass','confirm-pass'].forEach(id => document.getElementById(id).value = '');
  } else { errEl.textContent = res?.message || 'Xatolik'; }
}
