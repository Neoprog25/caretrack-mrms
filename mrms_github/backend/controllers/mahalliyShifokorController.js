const { readJSON, writeJSON, sendSuccess, sendError, parseBody, generateId, getQueryParams } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ROL = ['mahalliy_shifokor'];

async function getMyProfile(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const mahalliy = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const shifokor = mahalliy.find(d => d.id === user.refId);
    if (!shifokor) return sendError(res, 'Profil topilmadi', 404);
    sendSuccess(res, shifokor);
  } catch(e) { sendError(res, e.message, 500); }
}

async function getMyPatients(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { patients }  = readJSON('patients.json');
    const { diagnoses } = readJSON('diagnoses.json');
    const q = getQueryParams(req.url);
    let result = patients.filter(p => p.mahalliyShifokorId === user.refId);
    if (q.search) {
      const s = q.search.toLowerCase();
      result = result.filter(p =>
        p.firstName.toLowerCase().includes(s) ||
        p.lastName.toLowerCase().includes(s) ||
        (p.phone || '').includes(s)
      );
    }
    result = result.map(p => ({
      ...p,
      tashxislarSoni: diagnoses.filter(d => d.patientId === p.id).length
    }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

async function getPatientProfile(req, res, patientId) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { patients }  = readJSON('patients.json');
    const { diagnoses } = readJSON('diagnoses.json');
    const { referrals } = readJSON('referrals.json');
    const tor           = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const patient = patients.find(p => p.id === parseInt(patientId));
    if (!patient) return sendError(res, 'Bemor topilmadi', 404);
    if (patient.mahalliyShifokorId !== user.refId)
      return sendError(res, 'Bu bemor sizga biriktirilmagan', 403);
    const bemorYonaltirishlari = referrals.filter(r => r.patientId === patient.id).map(r => ({
      ...r, torShifokor: tor.find(d => d.id === r.qabullovchiShifokorId) || null
    }));
    sendSuccess(res, {
      ...patient,
      tashxislar:     diagnoses.filter(d => d.patientId === patient.id),
      yonaltirishlar: bemorYonaltirishlari
    });
  } catch(e) { sendError(res, e.message, 500); }
}

async function addDiagnosis(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const { patientId, icdKod, tavsif, ogirlikDarajasi } = body;
    if (!patientId || !icdKod || !tavsif || !ogirlikDarajasi)
      return sendError(res, "Majburiy maydonlar to'ldirilmagan", 400);
    const { patients } = readJSON('patients.json');
    const patient = patients.find(p => p.id === parseInt(patientId));
    if (!patient) return sendError(res, 'Bemor topilmadi', 404);
    if (patient.mahalliyShifokorId !== user.refId)
      return sendError(res, 'Bu bemor sizga biriktirilmagan', 403);
    const data = readJSON('diagnoses.json');
    const newDiag = {
      id: generateId(data.diagnoses),
      patientId:        parseInt(patientId),
      shifokorId:       user.refId,
      shifokorTuri:     'mahalliy_shifokor',
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

async function updateDiagnosis(req, res, id) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const data = readJSON('diagnoses.json');
    const idx  = data.diagnoses.findIndex(d => d.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Tashxis topilmadi', 404);
    if (data.diagnoses[idx].shifokorId !== user.refId || data.diagnoses[idx].shifokorTuri !== 'mahalliy_shifokor')
      return sendError(res, 'Bu tashxis sizniki emas', 403);
    data.diagnoses[idx] = { ...data.diagnoses[idx], ...body, id: data.diagnoses[idx].id };
    writeJSON('diagnoses.json', data);
    sendSuccess(res, data.diagnoses[idx]);
  } catch(e) { sendError(res, e.message, 500); }
}

async function createReferral(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const body = await parseBody(req);
    const { patientId, qabullovchiShifokorId, sabab } = body;
    if (!patientId || !qabullovchiShifokorId || !sabab)
      return sendError(res, "Majburiy maydonlar to'ldirilmagan", 400);
    const { patients } = readJSON('patients.json');
    const patient = patients.find(p => p.id === parseInt(patientId));
    if (!patient) return sendError(res, 'Bemor topilmadi', 404);
    if (patient.mahalliyShifokorId !== user.refId)
      return sendError(res, 'Bu bemor sizga biriktirilmagan', 403);
    const data = readJSON('referrals.json');
    const newRef = {
      id: generateId(data.referrals),
      patientId:              parseInt(patientId),
      yuboruvcniShifokorId:   user.refId,
      yuboruvchiTuri:         'mahalliy_shifokor',
      qabullovchiShifokorId:  parseInt(qabullovchiShifokorId),
      qabullovchiTuri:        'tor_shifokor',
      sabab,
      holati:                 'Kutilmoqda',
      yuborilganSana:         new Date().toISOString().split('T')[0],
      qabulSana:              null
    };
    data.referrals.push(newRef);
    writeJSON('referrals.json', data);
    sendSuccess(res, newRef, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

async function getTorShi(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { tor_shifokorlar } = readJSON('tor_shifokorlar.json');
    sendSuccess(res, tor_shifokorlar);
  } catch(e) { sendError(res, e.message, 500); }
}

async function getMyAppointments(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { appointments } = readJSON('appointments.json');
    const { patients }     = readJSON('patients.json');
    const q = getQueryParams(req.url);
    let result = appointments.filter(a => a.shifokorId === user.refId && a.shifokorTuri === 'mahalliy_shifokor');
    if (q.sana) result = result.filter(a => a.sana === q.sana);
    result = result.map(a => ({ ...a, bemor: patients.find(p => p.id === a.patientId) || null }));
    result.sort((a, b) => (a.sana + a.vaqt).localeCompare(b.sana + b.vaqt));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

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

module.exports = { getMyProfile, getMyPatients, getPatientProfile, addDiagnosis, updateDiagnosis, createReferral, getTorShi, getMyAppointments, updateAppointment };
