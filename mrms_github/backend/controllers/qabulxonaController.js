const { readJSON, writeJSON, sendSuccess, sendError, parseBody, generateId, getQueryParams } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ROL = ['qabulxona'];

const TUSHLIK_BOSHLANISH = '13:00';
const TUSHLIK_TUGASH     = '14:00';

function vaqtDaqiqa(v) { const [h,m] = v.split(':').map(Number); return h*60+m; }

function slotHolati(sana, vaqt) {
  const hozir = new Date();
  const hozirSana = hozir.toISOString().split('T')[0];
  const hozirVaqt = hozir.getHours() * 60 + hozir.getMinutes();
  const tB = vaqtDaqiqa(TUSHLIK_BOSHLANISH), tT = vaqtDaqiqa(TUSHLIK_TUGASH);
  const sD = vaqtDaqiqa(vaqt);
  if (sD >= tB && sD < tT) return 'tushlik';
  if (sana < hozirSana) return 'otgan';
  if (sana === hozirSana && sD <= hozirVaqt) return 'otgan';
  return 'bos';
}

async function getDoctors(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const mahalliy = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor      = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const { appointments } = readJSON('appointments.json');
    const today = new Date().toISOString().split('T')[0];

    const mahalliyWithCount = mahalliy.map(d => ({
      ...d,
      bugungiNavbat: appointments.filter(a =>
        a.shifokorId === d.id && a.shifokorTuri === 'mahalliy_shifokor' && a.sana === today
      ).length
    }));
    const torWithCount = tor.map(d => ({
      ...d,
      bugungiNavbat: appointments.filter(a =>
        a.shifokorId === d.id && a.shifokorTuri === 'tor_shifokor' && a.sana === today
      ).length
    }));
    sendSuccess(res, { mahalliy: mahalliyWithCount, tor: torWithCount });
  } catch(e) { sendError(res, e.message, 500); }
}

// Bemorlar ro'yxati (tibbiy ma'lumot YO'Q)
async function getPatients(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { patients } = readJSON('patients.json');
    const mahalliy     = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const q = getQueryParams(req.url);
    let result = patients;
    if (q.search) {
      const s = q.search.toLowerCase();
      result = result.filter(p =>
        p.firstName.toLowerCase().includes(s) ||
        p.lastName.toLowerCase().includes(s) ||
        (p.phone || '').includes(s)
      );
    }
    result = result.map(({ qonGuruhi, ...rest }) => ({
      ...rest,
      shifokorIsmi: mahalliy.find(d => d.id === rest.mahalliyShifokorId)
        ? `Dr. ${mahalliy.find(d => d.id === rest.mahalliyShifokorId).firstName} ${mahalliy.find(d => d.id === rest.mahalliyShifokorId).lastName}`
        : 'Biriktirilmagan'
    }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

// Yangi bemor ro'yxatga olish
async function registerPatient(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const { firstName, lastName, tugilganSana, jinsi, phone } = body;
    if (!firstName || !lastName || !tugilganSana || !jinsi || !phone)
      return sendError(res, "Majburiy maydonlar to'ldirilmagan", 400);

    const data = readJSON('patients.json');
    const newPatient = {
      id: generateId(data.patients),
      firstName, lastName, tugilganSana, jinsi, phone,
      email:              body.email || '',
      manzil:             body.manzil || '',
      qonGuruhi:          body.qonGuruhi || '',
      mahalliyShifokorId: body.mahalliyShifokorId ? parseInt(body.mahalliyShifokorId) : null,
      royxatgaOlingan:    new Date().toISOString().split('T')[0]
    };
    data.patients.push(newPatient);
    writeJSON('patients.json', data);

    // Mahalliy shifokorning biriktirilgan bemorlar ro'yxatini yangilash
    if (body.mahalliyShifokorId) {
      const mData = readJSON('mahalliy_shifokorlar.json');
      const idx = mData.mahalliy_shifokorlar.findIndex(d => d.id === parseInt(body.mahalliyShifokorId));
      if (idx !== -1) {
        if (!mData.mahalliy_shifokorlar[idx].biriktirilganBemorlar)
          mData.mahalliy_shifokorlar[idx].biriktirilganBemorlar = [];
        mData.mahalliy_shifokorlar[idx].biriktirilganBemorlar.push(newPatient.id);
        writeJSON('mahalliy_shifokorlar.json', mData);
      }
    }
    sendSuccess(res, newPatient, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

// Bemorni shifokorga biriktirish
async function assignDoctor(req, res, patientId) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { shifokorId } = await parseBody(req);
    if (!shifokorId) return sendError(res, 'shifokorId kiritilmadi', 400);

    const data = readJSON('patients.json');
    const idx  = data.patients.findIndex(p => p.id === parseInt(patientId));
    if (idx === -1) return sendError(res, 'Bemor topilmadi', 404);

    const eskiId = data.patients[idx].mahalliyShifokorId;
    data.patients[idx].mahalliyShifokorId = parseInt(shifokorId);
    writeJSON('patients.json', data);

    // Eski shifokordan olib, yangisiga qo'shamiz
    const mData = readJSON('mahalliy_shifokorlar.json');
    if (eskiId) {
      const eskiIdx = mData.mahalliy_shifokorlar.findIndex(d => d.id === eskiId);
      if (eskiIdx !== -1) {
        mData.mahalliy_shifokorlar[eskiIdx].biriktirilganBemorlar =
          (mData.mahalliy_shifokorlar[eskiIdx].biriktirilganBemorlar || [])
            .filter(id => id !== parseInt(patientId));
      }
    }
    const yangiIdx = mData.mahalliy_shifokorlar.findIndex(d => d.id === parseInt(shifokorId));
    if (yangiIdx !== -1) {
      if (!mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar)
        mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar = [];
      if (!mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar.includes(parseInt(patientId)))
        mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar.push(parseInt(patientId));
    }
    writeJSON('mahalliy_shifokorlar.json', mData);
    sendSuccess(res, { message: "Bemor shifokorga biriktirildi" });
  } catch(e) { sendError(res, e.message, 500); }
}

// Bemor shaxsiy ma'lumotini yangilash
async function updatePatientInfo(req, res, id) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const data = readJSON('patients.json');
    const idx  = data.patients.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Bemor topilmadi', 404);
    const { firstName, lastName, phone, email, manzil } = body;
    if (firstName)  data.patients[idx].firstName = firstName;
    if (lastName)   data.patients[idx].lastName  = lastName;
    if (phone)      data.patients[idx].phone     = phone;
    if (email)      data.patients[idx].email     = email;
    if (manzil)     data.patients[idx].manzil    = manzil;
    writeJSON('patients.json', data);
    sendSuccess(res, data.patients[idx]);
  } catch(e) { sendError(res, e.message, 500); }
}

// Navbat berish
async function createAppointment(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const { patientId, shifokorId, shifokorTuri, sana, vaqt, sabab } = body;
    if (!patientId || !shifokorId || !shifokorTuri || !sana || !vaqt || !sabab)
      return sendError(res, "Barcha maydonlar to'ldirilishi shart", 400);

    // Vaqt validatsiyasi
    const holat = slotHolati(sana, vaqt);
    if (holat === 'otgan')   return sendError(res, "Bu vaqt o'tib ketgan", 400);
    if (holat === 'tushlik') return sendError(res, "Tushlik vaqtida (13:00–14:00) navbat yozib bo'lmaydi", 400);

    const data = readJSON('appointments.json');
    const band = data.appointments.find(a =>
      a.shifokorId === parseInt(shifokorId) && a.shifokorTuri === shifokorTuri &&
      a.sana === sana && a.vaqt === vaqt && a.holati !== 'Bekor qilindi'
    );
    if (band) return sendError(res, "Bu vaqt band. Boshqa vaqt tanlang", 409);

    const newApp = {
      id: generateId(data.appointments),
      patientId: parseInt(patientId), shifokorId: parseInt(shifokorId),
      shifokorTuri, sana, vaqt, sabab,
      holati: 'Tasdiqlangan',
      yaratilgan: new Date().toISOString().split('T')[0], yaratuvchi: 'qabulxona'
    };
    data.appointments.push(newApp);
    writeJSON('appointments.json', data);
    sendSuccess(res, newApp, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

// Shifokor jadvalini ko'rish (band/bo's vaqtlar — vaqt validatsiyasi bilan)
async function getShifokorSchedule(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { shifokorId, shifokorTuri, sana } = getQueryParams(req.url);
    if (!shifokorId || !shifokorTuri || !sana)
      return sendError(res, 'shifokorId, shifokorTuri va sana kerak', 400);

    const { appointments } = readJSON('appointments.json');
    const { patients }     = readJSON('patients.json');

    const bandlar = appointments
      .filter(a =>
        a.shifokorId === parseInt(shifokorId) && a.shifokorTuri === shifokorTuri &&
        a.sana === sana && a.holati !== 'Bekor qilindi'
      )
      .map(a => ({
        vaqt: a.vaqt, bemor: patients.find(p => p.id === a.patientId) || null,
        sabab: a.sabab, holati: a.holati
      }));

    const barcha = [];
    for (let h = 9; h < 17; h++) {
      for (const m of ['00', '30']) {
        const vaqt = `${String(h).padStart(2,'0')}:${m}`;
        const holat = slotHolati(sana, vaqt);
        const bandInfo = bandlar.find(b => b.vaqt === vaqt);
        barcha.push({
          vaqt,
          band:    !!bandInfo || holat !== 'bos',
          tushlik: holat === 'tushlik',
          otgan:   holat === 'otgan',
          bemor:   bandInfo?.bemor || null,
          sabab:   bandInfo?.sabab || null
        });
      }
    }
    const bos  = barcha.filter(v => !v.band).length;
    const band = barcha.filter(v => v.band && !v.tushlik && !v.otgan).length;
    sendSuccess(res, { sana, barcha, jami: barcha.length, band, bos });
  } catch(e) { sendError(res, e.message, 500); }
}

// Barcha navbatlar
async function getAllAppointments(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { appointments } = readJSON('appointments.json');
    const { patients }     = readJSON('patients.json');
    const mahalliy         = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor              = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const q = getQueryParams(req.url);

    let result = appointments;
    if (q.sana)       result = result.filter(a => a.sana === q.sana);
    if (q.shifokorId) result = result.filter(a => a.shifokorId === parseInt(q.shifokorId));

    result = result.map(a => ({
      ...a,
      bemor: patients.find(p => p.id === a.patientId) || null,
      shifokor: a.shifokorTuri === 'mahalliy_shifokor'
        ? mahalliy.find(d => d.id === a.shifokorId) || null
        : tor.find(d => d.id === a.shifokorId) || null
    })).sort((a, b) => (a.sana + a.vaqt).localeCompare(b.sana + b.vaqt));

    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}


async function cancelAppointment(req, res, id) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const data = readJSON('appointments.json');
    const idx  = data.appointments.findIndex(a => a.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Navbat topilmadi', 404);
    data.appointments[idx].holati = 'Bekor qilindi';
    writeJSON('appointments.json', data);
    sendSuccess(res, { message: 'Navbat bekor qilindi' });
  } catch(e) { sendError(res, e.message, 500); }
}

module.exports = {
  getDoctors, getPatients, registerPatient, assignDoctor,
  updatePatientInfo, createAppointment, cancelAppointment,
  getShifokorSchedule, getAllAppointments
};
