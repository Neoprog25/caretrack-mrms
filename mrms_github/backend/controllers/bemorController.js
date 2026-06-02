const { readJSON, writeJSON, sendSuccess, sendError, parseBody, generateId, getQueryParams } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ROL = ['bemor'];

// Tushlik vaqtlari
const TUSHLIK_BOSHLANISH = '13:00';
const TUSHLIK_TUGASH     = '14:00';

// Vaqtni daqiqaga aylantirish
function vaqtDaqiqa(vaqt) {
  const [h, m] = vaqt.split(':').map(Number);
  return h * 60 + m;
}

// Slot o'tib ketganmi yoki tushlik vaqtimi
function slotHolati(sana, vaqt) {
  const hozir = new Date();
  const hozirSana = hozir.toISOString().split('T')[0];
  const hozirVaqt = hozir.getHours() * 60 + hozir.getMinutes();

  const tushlikBosh = vaqtDaqiqa(TUSHLIK_BOSHLANISH);
  const tushlikTug  = vaqtDaqiqa(TUSHLIK_TUGASH);
  const slotDaq     = vaqtDaqiqa(vaqt);

  // Tushlik vaqtimi?
  if (slotDaq >= tushlikBosh && slotDaq < tushlikTug) return 'tushlik';

  // O'tib ketganmi?
  if (sana < hozirSana) return 'otgan';
  if (sana === hozirSana && slotDaq <= hozirVaqt) return 'otgan';

  return 'bos';
}

async function getMyProfile(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { bemorlar }  = readJSON('bemorlar.json');
    const bemorHisob    = bemorlar.find(b => b.userId === user.id);
    if (!bemorHisob) return sendError(res, 'Bemor profili topilmadi', 404);
    const { patients }  = readJSON('patients.json');
    const { diagnoses } = readJSON('diagnoses.json');
    const mahalliy      = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const { referrals } = readJSON('referrals.json');
    const tor           = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const patient = patients.find(p => p.id === bemorHisob.patientId);
    if (!patient) return sendError(res, 'Tibbiy yozuv topilmadi', 404);

    // Yosh hisoblash
    const yosh = (() => {
      if (!patient.tugilganSana) return null;
      const bugun = new Date(), tugil = new Date(patient.tugilganSana);
      let y = bugun.getFullYear() - tugil.getFullYear();
      if (bugun.getMonth() < tugil.getMonth() || (bugun.getMonth() === tugil.getMonth() && bugun.getDate() < tugil.getDate())) y--;
      return y;
    })();

    sendSuccess(res, {
      ...patient,
      yosh,
      mahalliyShifokor:  mahalliy.find(d => d.id === patient.mahalliyShifokorId) || null,
      tashxislar:        diagnoses.filter(d => d.patientId === patient.id),
      yonaltirishlar:    referrals.filter(r => r.patientId === patient.id).map(r => ({
        ...r, torShifokor: tor.find(d => d.id === r.qabullovchiShifokorId) || null
      })),
    });
  } catch(e) { sendError(res, e.message, 500); }
}

async function updateMyInfo(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const { bemorlar } = readJSON('bemorlar.json');
    const bemorHisob   = bemorlar.find(b => b.userId === user.id);
    if (!bemorHisob) return sendError(res, 'Bemor profili topilmadi', 404);
    const data = readJSON('patients.json');
    const idx  = data.patients.findIndex(p => p.id === bemorHisob.patientId);
    if (idx === -1) return sendError(res, 'Tibbiy yozuv topilmadi', 404);
    const { phone, email, manzil } = body;
    if (phone)  data.patients[idx].phone  = phone;
    if (email)  data.patients[idx].email  = email;
    if (manzil) data.patients[idx].manzil = manzil;
    writeJSON('patients.json', data);
    sendSuccess(res, { message: "Ma'lumotlar yangilandi", data: data.patients[idx] });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getAvailableShifokors(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const mahalliy = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor      = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    sendSuccess(res, { mahalliy, tor });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getMyAppointments(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { bemorlar } = readJSON('bemorlar.json');
    const bemorHisob   = bemorlar.find(b => b.userId === user.id);
    if (!bemorHisob) return sendError(res, 'Bemor profili topilmadi', 404);
    const { appointments } = readJSON('appointments.json');
    const mahalliy         = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor              = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const result = appointments
      .filter(a => a.patientId === bemorHisob.patientId)
      .map(a => ({
        ...a,
        shifokor: a.shifokorTuri === 'mahalliy_shifokor'
          ? mahalliy.find(d => d.id === a.shifokorId) || null
          : tor.find(d => d.id === a.shifokorId) || null
      }))
      .sort((a, b) => (a.sana + a.vaqt).localeCompare(b.sana + b.vaqt));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

async function createAppointment(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const { shifokorId, shifokorTuri, sana, vaqt, sabab } = body;
    if (!shifokorId || !shifokorTuri || !sana || !vaqt || !sabab)
      return sendError(res, "Barcha maydonlar to'ldirilishi shart", 400);

    // O'tgan vaqt tekshiruvi
    const holat = slotHolati(sana, vaqt);
    if (holat === 'otgan')  return sendError(res, "Bu vaqt o'tib ketgan. Kelajakdagi vaqtni tanlang", 400);
    if (holat === 'tushlik') return sendError(res, "Tushlik vaqtida (13:00–14:00) navbat yozib bo'lmaydi", 400);

    const { bemorlar } = readJSON('bemorlar.json');
    const bemorHisob   = bemorlar.find(b => b.userId === user.id);
    if (!bemorHisob) return sendError(res, 'Bemor profili topilmadi', 404);

    const data = readJSON('appointments.json');
    const band = data.appointments.find(a =>
      a.shifokorId === parseInt(shifokorId) &&
      a.shifokorTuri === shifokorTuri &&
      a.sana === sana && a.vaqt === vaqt &&
      a.holati !== 'Bekor qilindi'
    );
    if (band) return sendError(res, "Bu vaqt band. Boshqa vaqt tanlang", 409);

    const newApp = {
      id: generateId(data.appointments),
      patientId: bemorHisob.patientId,
      shifokorId: parseInt(shifokorId),
      shifokorTuri, sana, vaqt, sabab,
      holati: 'Kutilmoqda',
      yaratilgan: new Date().toISOString().split('T')[0],
      yaratuvchi: 'bemor'
    };
    data.appointments.push(newApp);
    writeJSON('appointments.json', data);
    sendSuccess(res, newApp, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

async function cancelAppointment(req, res, id) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { bemorlar } = readJSON('bemorlar.json');
    const bemorHisob   = bemorlar.find(b => b.userId === user.id);
    if (!bemorHisob) return sendError(res, 'Profil topilmadi', 404);
    const data = readJSON('appointments.json');
    const idx  = data.appointments.findIndex(a => a.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Navbat topilmadi', 404);
    if (data.appointments[idx].patientId !== bemorHisob.patientId)
      return sendError(res, 'Bu navbat sizga tegishli emas', 403);

    // Qabul vaqtidan 2 soat oldin bekor qilish
    const hozir = new Date();
    const navbat = new Date(data.appointments[idx].sana + 'T' + data.appointments[idx].vaqt);
    const farqMs = navbat - hozir;
    if (farqMs < 2 * 60 * 60 * 1000)
      return sendError(res, "Qabul vaqtidan 2 soat qolganda bekor qilib bo'lmaydi", 400);

    data.appointments[idx].holati = 'Bekor qilindi';
    writeJSON('appointments.json', data);
    sendSuccess(res, { message: 'Navbat bekor qilindi' });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getShifokorSchedule(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { shifokorId, shifokorTuri, sana } = getQueryParams(req.url);
    if (!shifokorId || !shifokorTuri || !sana)
      return sendError(res, 'shifokorId, shifokorTuri va sana kerak', 400);

    const { appointments } = readJSON('appointments.json');
    const bandVaqtlar = appointments
      .filter(a =>
        a.shifokorId === parseInt(shifokorId) &&
        a.shifokorTuri === shifokorTuri &&
        a.sana === sana && a.holati !== 'Bekor qilindi'
      ).map(a => a.vaqt);

    // 9:00 – 17:00, har 30 daqiqa, tushlik skip
    const barcha = [];
    for (let h = 9; h < 17; h++) {
      for (const m of ['00', '30']) {
        const vaqt = `${String(h).padStart(2,'0')}:${m}`;
        const holat = slotHolati(sana, vaqt);
        if (holat === 'tushlik') {
          barcha.push({ vaqt, band: true, tushlik: true, otgan: false });
        } else if (holat === 'otgan') {
          barcha.push({ vaqt, band: true, tushlik: false, otgan: true });
        } else {
          barcha.push({ vaqt, band: bandVaqtlar.includes(vaqt), tushlik: false, otgan: false });
        }
      }
    }
    const bos   = barcha.filter(v => !v.band).length;
    const band  = barcha.filter(v => v.band && !v.tushlik && !v.otgan).length;
    sendSuccess(res, { sana, barcha, jami: barcha.length, band, bos });
  } catch(e) { sendError(res, e.message, 500); }
}

module.exports = {
  getMyProfile, updateMyInfo, getAvailableShifokors,
  getMyAppointments, createAppointment, cancelAppointment,
  getShifokorSchedule
};
