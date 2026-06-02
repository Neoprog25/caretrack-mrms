const { readJSON, writeJSON, sendSuccess, sendError, parseBody, generateId, getQueryParams } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ROL = ['tor_shifokor'];

// O'z profili
async function getMyProfile(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const tor = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const shifokor = tor.find(d => d.id === user.refId);
    if (!shifokor) return sendError(res, 'Profil topilmadi', 404);
    sendSuccess(res, shifokor);
  } catch(e) { sendError(res, e.message, 500); }
}

// Profilni yangilash (qabul kunlari)
async function updateMyProfile(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const data = readJSON('tor_shifokorlar.json');
    const idx  = data.tor_shifokorlar.findIndex(d => d.id === user.refId);
    if (idx === -1) return sendError(res, 'Profil topilmadi', 404);
    const { phone, email, qabulKunlari } = body;
    if (phone)       data.tor_shifokorlar[idx].phone       = phone;
    if (email)       data.tor_shifokorlar[idx].email       = email;
    if (qabulKunlari) data.tor_shifokorlar[idx].qabulKunlari = qabulKunlari;
    writeJSON('tor_shifokorlar.json', data);
    sendSuccess(res, data.tor_shifokorlar[idx]);
  } catch(e) { sendError(res, e.message, 500); }
}

// Yo'naltirishlar
async function getMyReferrals(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { referrals } = readJSON('referrals.json');
    const { patients }  = readJSON('patients.json');
    const mahalliy      = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const q = getQueryParams(req.url);
    let result = referrals.filter(r => r.qabullovchiShifokorId === user.refId);
    if (q.holati) result = result.filter(r => r.holati === q.holati);
    result = result.map(r => ({
      ...r,
      bemor:              patients.find(p => p.id === r.patientId) || null,
      yuboruvchiShifokor: mahalliy.find(d => d.id === r.yuboruvcniShifokorId) || null,
    }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

// Yo'naltirishni yangilash
async function updateReferral(req, res, id) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { holati } = await parseBody(req);
    if (!['Tasdiqlangan', 'Rad etilgan'].includes(holati))
      return sendError(res, "holati: Tasdiqlangan yoki Rad etilgan bo'lishi kerak", 400);
    const data = readJSON('referrals.json');
    const idx  = data.referrals.findIndex(r => r.id === parseInt(id));
    if (idx === -1) return sendError(res, "Yo'naltirish topilmadi", 404);
    if (data.referrals[idx].qabullovchiShifokorId !== user.refId)
      return sendError(res, "Bu yo'naltirish sizga emas", 403);
    data.referrals[idx].holati    = holati;
    data.referrals[idx].qabulSana = holati === 'Tasdiqlangan' ? new Date().toISOString().split('T')[0] : null;
    writeJSON('referrals.json', data);
    sendSuccess(res, data.referrals[idx]);
  } catch(e) { sendError(res, e.message, 500); }
}

// Bemor profili — yo'naltirilgan YOKI navbatga yozilgan bemor
async function getPatientProfile(req, res, patientId) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { referrals }    = readJSON('referrals.json');
    const { appointments } = readJSON('appointments.json');

    // Yo'naltirish YOKI navbat orqali ruxsat
    const hasAccess =
      referrals.some(r => r.patientId === parseInt(patientId) && r.qabullovchiShifokorId === user.refId) ||
      appointments.some(a => a.patientId === parseInt(patientId) && a.shifokorId === user.refId && a.shifokorTuri === 'tor_shifokor');

    if (!hasAccess) return sendError(res, "Bu bemorga ruxsatingiz yo'q", 403);

    const { patients }  = readJSON('patients.json');
    const { diagnoses } = readJSON('diagnoses.json');
    const mahalliy      = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;

    const patient = patients.find(p => p.id === parseInt(patientId));
    if (!patient) return sendError(res, 'Bemor topilmadi', 404);

    sendSuccess(res, {
      ...patient,
      mahalliyShifokor: mahalliy.find(d => d.id === patient.mahalliyShifokorId) || null,
      tashxislar:       diagnoses.filter(d => d.patientId === patient.id)
    });
  } catch(e) { sendError(res, e.message, 500); }
}

// Konsultatsiya tashxisi
async function addConsultation(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const { patientId, icdKod, tavsif, ogirlikDarajasi } = body;
    if (!patientId || !icdKod || !tavsif || !ogirlikDarajasi)
      return sendError(res, "Majburiy maydonlar to'ldirilmagan", 400);

    const { referrals }    = readJSON('referrals.json');
    const { appointments } = readJSON('appointments.json');
    const hasAccess =
      referrals.some(r => r.patientId === parseInt(patientId) && r.qabullovchiShifokorId === user.refId) ||
      appointments.some(a => a.patientId === parseInt(patientId) && a.shifokorId === user.refId && a.shifokorTuri === 'tor_shifokor');
    if (!hasAccess) return sendError(res, "Bu bemorga ruxsatingiz yo'q", 403);

    const data = readJSON('diagnoses.json');
    const newDiag = {
      id: generateId(data.diagnoses),
      patientId:        parseInt(patientId),
      shifokorId:       user.refId,
      shifokorTuri:     'tor_shifokor',
      icdKod, tavsif, ogirlikDarajasi,
      izoh:             body.izoh || '',
      holati:           body.holati || 'Faol',
      tashxisSana:      new Date().toISOString().split('T')[0]
    };
    data.diagnoses.push(newDiag);
    writeJSON('diagnoses.json', data);
    sendSuccess(res, newDiag, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

// O'z navbat jadvali
async function getMyAppointments(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { appointments } = readJSON('appointments.json');
    const { patients }     = readJSON('patients.json');
    const q = getQueryParams(req.url);
    let result = appointments.filter(a => a.shifokorId === user.refId && a.shifokorTuri === 'tor_shifokor');
    if (q.sana) result = result.filter(a => a.sana === q.sana);
    result = result.map(a => ({
      ...a, bemor: patients.find(p => p.id === a.patientId) || null
    })).sort((a, b) => (a.sana + a.vaqt).localeCompare(b.sana + b.vaqt));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

// Navbat holatini yangilash
async function updateAppointment(req, res, id) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { holati } = await parseBody(req);
    const data = readJSON('appointments.json');
    const idx  = data.appointments.findIndex(a => a.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Navbat topilmadi', 404);
    if (data.appointments[idx].shifokorId !== user.refId)
      return sendError(res, 'Bu navbat sizga emas', 403);
    data.appointments[idx].holati = holati;
    writeJSON('appointments.json', data);
    sendSuccess(res, data.appointments[idx]);
  } catch(e) { sendError(res, e.message, 500); }
}

module.exports = {
  getMyProfile, updateMyProfile,
  getMyReferrals, updateReferral,
  getPatientProfile, addConsultation,
  getMyAppointments, updateAppointment
};
