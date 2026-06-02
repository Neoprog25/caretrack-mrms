let allPatients  = [];
let allDoctors   = { mahalliy: [], tor: [] };
let selectedAppVaqt = null;

const appColorMap = { 'Kutilmoqda':'kutilmoqda','Tasdiqlangan':'tasdiqlangan','Bekor qilindi':'rad' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth('qabulxona')) return;
  renderUserInfo();
  const today = new Date().toISOString().split('T')[0];
  ['app-sana','sch-sana','nav-sana'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = today; if (id === 'app-sana') el.min = today; }
  });
  const dateEl = document.getElementById('dash-sana');
  if (dateEl) {
    const d = new Date();
    const kunlar = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    const oylar  = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    dateEl.textContent = `${kunlar[d.getDay()]}, ${d.getDate()} ${oylar[d.getMonth()]} ${d.getFullYear()}`;
  }
  await loadDoctors();
  await loadDashboard();
});

function showTab(name, el) {
  ['dashboard','patients','register','appointment','navbatlar','schedule','doctors','password'].forEach(t => {
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
  if (name === 'patients'  && !allPatients.length) loadPatients();
  if (name === 'navbatlar')  loadNavbatlar();
  if (name === 'doctors')    loadDoctorsTab();
}

// ─── DASHBOARD ───────────────────────────────────
async function loadDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const [pRes, aRes] = await Promise.all([api.qabulPatients(), api.qabulGetApps(`?sana=${today}`)]);

  if (pRes?.success) {
    document.getElementById('st-jami').textContent = pRes.data.length;
    // So'nggi 5 ta bemor
    const recent = pRes.data.slice(-5).reverse();
    document.getElementById('dash-recent-patients').innerHTML = recent.length
      ? recent.map(p => `
          <div style="padding:10px 16px;border-bottom:0.5px solid var(--gray-100);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="td-name">${p.firstName} ${p.lastName}</div>
              <div class="td-sub">${p.phone} · ${p.royxatgaOlingan}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="quickNavbat(${p.id})">Navbat</button>
          </div>`).join('')
      : '<div class="table-empty" style="padding:20px">Bemorlar yo\'q</div>';
  }

  if (aRes?.success) {
    const apps = aRes.data;
    document.getElementById('st-bugun').textContent      = apps.length;
    document.getElementById('st-kutilmoqda').textContent = apps.filter(a => a.holati === 'Kutilmoqda').length;
    document.getElementById('st-bajarildi').textContent  = apps.filter(a => a.holati === 'Tasdiqlangan').length;

    const tbody = document.getElementById('dash-apps');
    if (!apps.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Bugun navbat yo'q</td></tr>`;
    } else {
      const hozir = new Date();
      tbody.innerHTML = apps.slice(0, 10).map(a => {
        const appVaqt  = new Date(today + 'T' + a.vaqt);
        const otgan    = appVaqt < hozir;
        return `<tr style="${otgan && a.holati === 'Kutilmoqda' ? 'opacity:0.5' : ''}">
          <td><b>${a.vaqt}</b></td>
          <td>${a.bemor ? a.bemor.firstName+' '+a.bemor.lastName : '—'}</td>
          <td>${a.shifokor ? 'Dr. '+a.shifokor.lastName : '—'}</td>
          <td><span class="badge badge-${appColorMap[a.holati]||''}">${a.holati}</span></td>
        </tr>`;
      }).join('');
    }
  }
}

// ─── BEMORLAR ────────────────────────────────────
async function loadPatients() {
  setLoading('patients-table', 7);
  const res = await api.qabulPatients();
  if (res?.success) { allPatients = res.data; renderPatients(allPatients); }
  else setEmpty('patients-table', 7, 'Xatolik');

  const patSel = document.getElementById('app-patient');
  if (patSel && res?.success) {
    patSel.innerHTML = '<option value="">Bemor tanlang</option>';
    res.data.forEach(p => {
      patSel.innerHTML += `<option value="${p.id}">${p.firstName} ${p.lastName} (${p.phone})</option>`;
    });
  }

  document.getElementById('pat-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderPatients(allPatients.filter(p =>
      (p.firstName+' '+p.lastName).toLowerCase().includes(q) ||
      (p.phone||'').includes(q)
    ));
  });
}

function renderPatients(list) {
  const tbody = document.getElementById('patients-table');
  if (!list.length) { setEmpty('patients-table', 7, 'Bemorlar topilmadi'); return; }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><div class="td-name">${p.firstName} ${p.lastName}</div></td>
      <td>${p.tugilganSana||'—'}</td>
      <td>${p.jinsi||'—'}</td>
      <td>${p.phone}</td>
      <td>${p.shifokorIsmi||'<span style="color:var(--red)">Biriktirilmagan</span>'}</td>
      <td>${p.royxatgaOlingan}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="openEdit(${p.id})">Tahrirlash</button>
          <button class="btn btn-primary btn-sm" onclick="quickNavbat(${p.id})">Navbat</button>
        </div>
      </td>
    </tr>`).join('');
}

function quickNavbat(patientId) {
  showTab('appointment', null);
  setTimeout(() => {
    const sel = document.getElementById('app-patient');
    if (sel) sel.value = patientId;
  }, 100);
}

// ─── YANGI BEMOR ─────────────────────────────────
async function loadDoctors() {
  const res = await api.qabulDoctors();
  if (!res?.success) return;
  allDoctors = res.data;
  // Register formasiga shifokorlar
  const rSel = document.getElementById('r-shifokor');
  if (rSel) {
    rSel.innerHTML = '<option value="">Biriktirmaslik</option>';
    allDoctors.mahalliy.forEach(d => {
      rSel.innerHTML += `<option value="${d.id}">Dr. ${d.firstName} ${d.lastName} (${d.biriktirilganBemorlar?.length||0} bemor)</option>`;
    });
  }
}

async function registerPatient() {
  const data = {
    firstName:          document.getElementById('r-firstName').value.trim(),
    lastName:           document.getElementById('r-lastName').value.trim(),
    tugilganSana:       document.getElementById('r-tugilganSana').value,
    jinsi:              document.getElementById('r-jinsi').value,
    phone:              document.getElementById('r-phone').value.trim(),
    qonGuruhi:          document.getElementById('r-qonGuruhi').value,
    email:              document.getElementById('r-email').value.trim(),
    manzil:             document.getElementById('r-manzil').value.trim(),
    mahalliyShifokorId: document.getElementById('r-shifokor').value || null,
  };
  if (!data.firstName || !data.lastName || !data.tugilganSana || !data.jinsi || !data.phone) {
    document.getElementById('registerError').textContent = "Majburiy maydonlarni to'ldiring"; return;
  }
  const btn = document.getElementById('registerBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = await api.qabulRegister(data);
  btn.disabled = false; btn.textContent = '✓ Ro\'yxatga olish';
  if (res?.success) {
    showToast(`${data.firstName} ${data.lastName} muvaffaqiyatli ro'yxatga olindi!`, 'success');
    clearRegisterForm();
    allPatients = [];
    await loadDashboard();
    showTab('patients', null);
    await loadPatients();
  } else { document.getElementById('registerError').textContent = res?.message || 'Xatolik'; }
}

function clearRegisterForm() {
  ['r-firstName','r-lastName','r-tugilganSana','r-jinsi','r-phone','r-qonGuruhi','r-email','r-manzil']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('r-shifokor').value = '';
  document.getElementById('registerError').textContent = '';
}

// ─── NAVBAT BERISH ────────────────────────────────
function loadAppShifokorList() {
  const turi = document.getElementById('app-turi').value;
  const sel  = document.getElementById('app-shifokor');
  const list = turi === 'mahalliy_shifokor' ? allDoctors.mahalliy : allDoctors.tor;
  sel.innerHTML = '<option value="">Shifokor tanlang</option>';
  list.forEach(d => {
    const kun = (d.qabulKunlari||[]).join(', ') || '—';
    sel.innerHTML += `<option value="${d.id}">Dr. ${d.firstName} ${d.lastName} — ${d.mutaxassislik} (${kun})</option>`;
  });
  document.getElementById('app-schedule-block').style.display = 'none';
  selectedAppVaqt = null;
}

async function loadAppSchedule() {
  const turi       = document.getElementById('app-turi').value;
  const shifokorId = document.getElementById('app-shifokor').value;
  const sana       = document.getElementById('app-sana').value;
  if (!turi || !shifokorId || !sana) return;

  const res = await api.qabulGetSchedule(shifokorId, turi, sana);
  if (!res?.success) return;

  document.getElementById('app-schedule-block').style.display = '';
  document.getElementById('app-schedule-info').textContent =
    `Bo'sh: ${res.data.bos} ta · Band: ${res.data.band} ta`;
  selectedAppVaqt = null;

  document.getElementById('app-schedule-grid').innerHTML = res.data.barcha.map(v => {
    if (v.tushlik) return `<button disabled style="padding:8px 12px;border-radius:8px;font-size:11px;cursor:not-allowed;border:1px dashed #d1d5db;background:#f9fafb;color:#9ca3af;min-width:70px">${v.vaqt}<br><span style="font-size:10px">Tushlik</span></button>`;
    if (v.otgan)   return `<button disabled style="padding:8px 12px;border-radius:8px;font-size:13px;cursor:not-allowed;border:1px solid #e5e7eb;background:#f9fafb;color:#d1d5db;text-decoration:line-through;min-width:70px">${v.vaqt}</button>`;
    if (v.band)    return `<button disabled title="${v.bemor ? v.bemor.firstName+' '+v.bemor.lastName : 'Band'}" style="padding:8px 12px;border-radius:8px;font-size:11px;cursor:not-allowed;border:2px solid #fecaca;background:#fef2f2;color:#dc2626;min-width:70px">${v.vaqt}<br><span style="font-size:10px">${v.bemor ? v.bemor.firstName : 'Band'}</span></button>`;
    return `<button class="vaqt-btn bos" onclick="selectAppVaqt('${v.vaqt}',this)" style="padding:8px 12px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:2px solid var(--blue);background:white;color:var(--blue);transition:all .15s;min-width:70px">${v.vaqt}</button>`;
  }).join('');
}

function selectAppVaqt(vaqt, btn) {
  document.querySelectorAll('.vaqt-btn.bos').forEach(b => { b.style.background='white'; b.style.color='var(--blue)'; b.style.fontWeight='500'; });
  btn.style.background = 'var(--blue)'; btn.style.color = 'white'; btn.style.fontWeight = '700';
  selectedAppVaqt = vaqt;
}

async function createAppointment() {
  const data = {
    patientId:    document.getElementById('app-patient').value,
    shifokorId:   document.getElementById('app-shifokor').value,
    shifokorTuri: document.getElementById('app-turi').value,
    sana:         document.getElementById('app-sana').value,
    vaqt:         selectedAppVaqt,
    sabab:        document.getElementById('app-sabab').value.trim(),
  };
  const errEl = document.getElementById('appError');
  if (!data.patientId || !data.shifokorId || !data.shifokorTuri || !data.sana || !data.sabab) {
    errEl.textContent = "Barcha maydonlarni to'ldiring"; return;
  }
  if (!selectedAppVaqt) { errEl.textContent = 'Vaqt tanlang'; return; }
  errEl.textContent = '';
  const btn = document.getElementById('appBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res = await api.qabulCreateApp(data);
  btn.disabled = false; btn.textContent = '✓ Navbat berish';
  if (res?.success) {
    showToast(`${data.sana} kuni ${data.vaqt} ga navbat berildi!`, 'success');
    selectedAppVaqt = null;
    document.getElementById('app-schedule-block').style.display = 'none';
    document.getElementById('app-sabab').value = '';
    document.getElementById('app-patient').value = '';
    await loadDashboard();
  } else { errEl.textContent = res?.message || 'Xatolik'; }
}

// ─── NAVBATLAR BOSHQARUVI ─────────────────────────
function setToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('nav-sana').value = today;
  loadNavbatlar();
}

async function loadNavbatlar() {
  setLoading('navbatlar-table', 7);
  const sana   = document.getElementById('nav-sana').value;
  const holati = document.getElementById('nav-holati').value;
  const query  = sana ? `?sana=${sana}` : '';
  const res    = await api.qabulGetApps(query);
  if (!res?.success) { setEmpty('navbatlar-table', 7, 'Xatolik'); return; }
  let list = res.data;
  if (holati) list = list.filter(a => a.holati === holati);
  document.getElementById('nav-count').textContent = `${list.length} ta navbat`;
  if (!list.length) { setEmpty('navbatlar-table', 7, 'Navbatlar topilmadi'); return; }
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('navbatlar-table').innerHTML = list.map(a => `
    <tr style="${a.sana === today && a.holati==='Kutilmoqda' ? 'background:#f0fdf4' : ''}">
      <td><b>${a.sana}</b>${a.sana===today?' <span class="badge badge-faol">Bugun</span>':''}</td>
      <td><b>${a.vaqt}</b></td>
      <td>
        <div class="td-name">${a.bemor ? a.bemor.firstName+' '+a.bemor.lastName : '—'}</div>
        <div class="td-sub">${a.bemor?.phone||'—'}</div>
      </td>
      <td>${a.shifokor ? 'Dr. '+a.shifokor.firstName+' '+a.shifokor.lastName : '—'}<div class="td-sub">${a.shifokor?.mutaxassislik||'—'}</div></td>
      <td>${a.sabab}</td>
      <td><span class="badge badge-${appColorMap[a.holati]||''}">${a.holati}</span></td>
      <td>
        ${a.holati === 'Kutilmoqda' || a.holati === 'Tasdiqlangan' ? `
          <button class="btn btn-danger btn-sm" onclick="cancelNavbat(${a.id})">Bekor qilish</button>
        ` : '—'}
      </td>
    </tr>`).join('');
}

async function cancelNavbat(id) {
  if (!confirm("Navbatni bekor qilishga ishonchingiz komilmi?")) return;
  const res = await api.qabulCancelApp(id);
  if (res?.success) { showToast('Navbat bekor qilindi', 'success'); await loadNavbatlar(); await loadDashboard(); }
  else showToast(res?.message || 'Xatolik', 'error');
}

// ─── JADVAL KO'RISH ──────────────────────────────
function loadSchShifokorList() {
  const turi = document.getElementById('sch-turi').value;
  const sel  = document.getElementById('sch-shifokor');
  const list = turi === 'mahalliy_shifokor' ? allDoctors.mahalliy : allDoctors.tor;
  sel.innerHTML = '<option value="">Shifokor tanlang</option>';
  list.forEach(d => { sel.innerHTML += `<option value="${d.id}">${d.firstName} ${d.lastName} — ${d.mutaxassislik}</option>`; });
}

async function loadScheduleView() {
  const turi       = document.getElementById('sch-turi').value;
  const shifokorId = document.getElementById('sch-shifokor').value;
  const sana       = document.getElementById('sch-sana').value;
  const el         = document.getElementById('schedule-view');
  if (!turi || !shifokorId || !sana) { el.innerHTML = '<p style="color:var(--red);text-align:center">Barcha maydonlarni tanlang</p>'; return; }
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.qabulGetSchedule(shifokorId, turi, sana);
  if (!res?.success) { el.innerHTML = '<p style="color:var(--red);text-align:center">Xatolik</p>'; return; }
  const doc = (turi === 'mahalliy_shifokor' ? allDoctors.mahalliy : allDoctors.tor).find(d => d.id === parseInt(shifokorId));
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:12px 16px;background:var(--gray-50);border-radius:8px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-weight:600;color:var(--navy)">Dr. ${doc?.firstName} ${doc?.lastName}</div>
        <div style="font-size:12px;color:var(--gray-600)">${doc?.mutaxassislik} · ${sana} · ${doc?.ish_boshlanish||'09:00'}–${doc?.ish_tugash||'17:00'}</div>
      </div>
      <div style="display:flex;gap:16px;font-size:13px;flex-wrap:wrap">
        <span style="color:var(--green)">&#9989; Bo'sh: <b>${res.data.bos}</b></span>
        <span style="color:var(--red)">&#128274; Band: <b>${res.data.band}</b></span>
        <span style="color:var(--gray-600)">Jami: <b>${res.data.jami}</b></span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
      ${res.data.barcha.map(v => {
        if (v.tushlik) return `<div style="padding:10px 14px;border-radius:8px;border:1px dashed #d1d5db;background:#f9fafb"><div style="font-weight:600;color:#9ca3af">${v.vaqt}</div><div style="font-size:11px;color:#9ca3af">Tushlik vaqti</div></div>`;
        if (v.otgan)   return `<div style="padding:10px 14px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;opacity:0.5"><div style="font-weight:600;color:#d1d5db;text-decoration:line-through">${v.vaqt}</div><div style="font-size:11px;color:#d1d5db">O'tib ketgan</div></div>`;
        if (v.band)    return `<div style="padding:10px 14px;border-radius:8px;border:2px solid #fecaca;background:#fef2f2"><div style="font-weight:600;color:#dc2626">${v.vaqt}</div><div style="font-size:12px;color:#dc2626">${v.bemor ? v.bemor.firstName+' '+v.bemor.lastName : 'Band'}</div><div style="font-size:11px;color:#f87171">${v.sabab||''}</div></div>`;
        return `<div style="padding:10px 14px;border-radius:8px;border:2px solid #bbf7d0;background:#f0fdf4"><div style="font-weight:600;color:#166534">${v.vaqt}</div><div style="font-size:11px;color:#16a34a">Bo'sh</div></div>`;
      }).join('')}
    </div>`;
}

// ─── SHIFOKORLAR TAB ─────────────────────────────
async function loadDoctorsTab() {
  const el = document.getElementById('doctors-grid');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Yuklanmoqda...</div>';
  const res = await api.qabulDoctors();
  if (!res?.success) { el.innerHTML = '<p style="color:var(--red)">Xatolik</p>'; return; }
  const { mahalliy, tor } = res.data;
  // Bo'lim bo'yicha guruhlash
  const torByDept = {};
  tor.forEach(d => { if (!torByDept[d.mutaxassislik]) torByDept[d.mutaxassislik] = []; torByDept[d.mutaxassislik].push(d); });
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Mahalliy shifokorlar</span><span class="badge badge-mahalliy_shifokor">${mahalliy.length} ta</span></div>
      <div class="scroll-list">
        ${mahalliy.map(d => `
          <div class="doc-item">
            <div class="td-name">Dr. ${d.firstName} ${d.lastName}</div>
            <div class="td-sub">${d.mutaxassislik} · ${d.bolim}</div>
            <div class="td-sub">&#128197; ${(d.qabulKunlari||[]).join(', ')||'—'} · &#128336; ${d.ish_boshlanish||'09:00'}–${d.ish_tugash||'17:00'}</div>
            <div class="td-sub">Bemorlar: ${d.biriktirilganBemorlar?.length||0} ta · Bugun: <b>${d.bugungiNavbat||0}</b> navbat</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Tor mutaxassislar</span><span class="badge badge-tor_shifokor">${tor.length} ta</span></div>
      <div class="scroll-list">
        ${Object.entries(torByDept).map(([dept, docs]) => `
          <div style="padding:6px 16px;background:var(--gray-50);border-bottom:0.5px solid var(--gray-200)">
            <span style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.04em">${dept}</span>
          </div>
          ${docs.map(d => `
            <div class="doc-item">
              <div class="td-name">Dr. ${d.firstName} ${d.lastName}</div>
              <div class="td-sub">&#128197; ${(d.qabulKunlari||[]).join(', ')||'—'} · &#128336; ${d.ish_boshlanish||'09:00'}–${d.ish_tugash||'17:00'}</div>
              <div class="td-sub">${d.ish_smenasi === 'kecha' ? '🌙 Kecha smenasi' : '☀️ Kunduz smenasi'} · Bugun: <b>${d.bugungiNavbat||0}</b> navbat</div>
            </div>`).join('')}`).join('')}
      </div>
    </div>`;
}

// ─── BEMOR TAHRIRLASH ─────────────────────────────
function openEdit(id) {
  const p = allPatients.find(x => x.id === id);
  if (!p) return;
  document.getElementById('e-id').value        = id;
  document.getElementById('e-firstName').value = p.firstName;
  document.getElementById('e-lastName').value  = p.lastName;
  document.getElementById('e-phone').value     = p.phone;
  document.getElementById('e-email').value     = p.email||'';
  document.getElementById('e-manzil').value    = p.manzil||'';
  const sel = document.getElementById('e-shifokor');
  sel.innerHTML = '<option value="">Biriktirmaslik</option>';
  allDoctors.mahalliy.forEach(d => {
    sel.innerHTML += `<option value="${d.id}" ${p.mahalliyShifokorId === d.id ? 'selected' : ''}>Dr. ${d.firstName} ${d.lastName}</option>`;
  });
  document.getElementById('editModalTitle').textContent = `${p.firstName} ${p.lastName}`;
  document.getElementById('editError').textContent = '';
  document.getElementById('editModal').classList.remove('hidden');
}

async function saveEdit() {
  const id         = document.getElementById('e-id').value;
  const shifokorId = document.getElementById('e-shifokor').value;
  const data = {
    firstName: document.getElementById('e-firstName').value.trim(),
    lastName:  document.getElementById('e-lastName').value.trim(),
    phone:     document.getElementById('e-phone').value.trim(),
    email:     document.getElementById('e-email').value.trim(),
    manzil:    document.getElementById('e-manzil').value.trim(),
  };
  const btn = document.getElementById('editSaveBtn');
  btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
  const res1 = await api.qabulUpdate(id, data);
  const patient = allPatients.find(p => p.id === parseInt(id));
  if (shifokorId && String(patient?.mahalliyShifokorId) !== shifokorId) {
    await api.qabulAssign(id, { shifokorId: parseInt(shifokorId) });
  }
  btn.disabled = false; btn.textContent = 'Saqlash';
  if (res1?.success) {
    showToast("Ma'lumotlar yangilandi", 'success');
    closeModal('editModal'); allPatients = []; await loadPatients();
  } else { document.getElementById('editError').textContent = res1?.message || 'Xatolik'; }
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

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
