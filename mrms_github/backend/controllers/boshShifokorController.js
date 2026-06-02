const { readJSON, writeJSON, sendSuccess, sendError, parseBody, generateId, getQueryParams } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ROL = ['bosh_shifokor'];

// Dashboard
async function getDashboard(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { patients }     = readJSON('patients.json');
    const { diagnoses }    = readJSON('diagnoses.json');
    const mahalliy         = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor              = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const { referrals }    = readJSON('referrals.json');
    const { appointments } = readJSON('appointments.json');
    const today = new Date().toISOString().split('T')[0];

    sendSuccess(res, {
      statistika: {
        jami_bemorlar:    patients.length,
        jami_tashxislar:  diagnoses.length,
        kritik_holatlar:  diagnoses.filter(d => d.ogirlikDarajasi === 'Kritik').length,
        kutilgan_yonalt:  referrals.filter(r => r.holati === 'Kutilmoqda').length,
        bugungi_qabul:    appointments.filter(a => a.sana === today).length,
        jami_shifokorlar: mahalliy.length + tor.length,
      },
      mahalliy_shifokorlar: mahalliy.map(d => ({
        ...d,
        bugungiNavbat: appointments.filter(a =>
          a.shifokorId === d.id && a.shifokorTuri === 'mahalliy_shifokor' && a.sana === today
        ).length
      })),
      tor_shifokorlar: tor.map(d => ({
        ...d,
        bugungiNavbat: appointments.filter(a =>
          a.shifokorId === d.id && a.shifokorTuri === 'tor_shifokor' && a.sana === today
        ).length
      })),
    });
  } catch(e) { sendError(res, e.message, 500); }
}

// O'z profili
async function getMyProfile(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const bosh = readJSON('bosh_shifokorlar.json').bosh_shifokorlar;
    const shifokor = bosh.find(d => d.id === user.refId);
    if (!shifokor) return sendError(res, 'Profil topilmadi', 404);
    sendSuccess(res, shifokor);
  } catch(e) { sendError(res, e.message, 500); }
}

// Barcha bemorlar
async function getAllPatients(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { patients } = readJSON('patients.json');
    const mahalliy     = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const { diagnoses } = readJSON('diagnoses.json');
    const q = getQueryParams(req.url);
    let result = patients;
    if (q.search) {
      const s = q.search.toLowerCase();
      result = result.filter(p =>
        p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s)
      );
    }
    result = result.map(p => ({
      ...p,
      mahalliyShifokor: mahalliy.find(d => d.id === p.mahalliyShifokorId) || null,
      tashxislarSoni:   diagnoses.filter(d => d.patientId === p.id).length
    }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

// Bemor to'liq profili
async function getPatientProfile(req, res, patientId) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { patients }     = readJSON('patients.json');
    const { diagnoses }    = readJSON('diagnoses.json');
    const { referrals }    = readJSON('referrals.json');
    const mahalliy         = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor              = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const { appointments } = readJSON('appointments.json');

    const patient = patients.find(p => p.id === parseInt(patientId));
    if (!patient) return sendError(res, 'Bemor topilmadi', 404);

    sendSuccess(res, {
      ...patient,
      mahalliyShifokor: mahalliy.find(d => d.id === patient.mahalliyShifokorId) || null,
      tashxislar:       diagnoses.filter(d => d.patientId === patient.id),
      yonaltirishlar:   referrals.filter(r => r.patientId === patient.id).map(r => ({
        ...r, torShifokor: tor.find(d => d.id === r.qabullovchiShifokorId) || null
      })),
      navbatlar:        appointments.filter(a => a.patientId === patient.id)
    });
  } catch(e) { sendError(res, e.message, 500); }
}

// Bemorni ko'chirish
async function transferPatient(req, res, patientId) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { yangiShifokorId } = await parseBody(req);
    if (!yangiShifokorId) return sendError(res, 'yangiShifokorId kiritilmadi', 400);
    const mData = readJSON('mahalliy_shifokorlar.json');
    const yangi = mData.mahalliy_shifokorlar.find(d => d.id === parseInt(yangiShifokorId));
    if (!yangi) return sendError(res, 'Shifokor topilmadi', 404);
    const data = readJSON('patients.json');
    const idx  = data.patients.findIndex(p => p.id === parseInt(patientId));
    if (idx === -1) return sendError(res, 'Bemor topilmadi', 404);
    const eskiId = data.patients[idx].mahalliyShifokorId;
    data.patients[idx].mahalliyShifokorId = parseInt(yangiShifokorId);
    writeJSON('patients.json', data);
    const eskiIdx  = mData.mahalliy_shifokorlar.findIndex(d => d.id === eskiId);
    const yangiIdx = mData.mahalliy_shifokorlar.findIndex(d => d.id === parseInt(yangiShifokorId));
    if (eskiIdx !== -1)
      mData.mahalliy_shifokorlar[eskiIdx].biriktirilganBemorlar =
        (mData.mahalliy_shifokorlar[eskiIdx].biriktirilganBemorlar || []).filter(id => id !== parseInt(patientId));
    if (yangiIdx !== -1) {
      if (!mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar)
        mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar = [];
      if (!mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar.includes(parseInt(patientId)))
        mData.mahalliy_shifokorlar[yangiIdx].biriktirilganBemorlar.push(parseInt(patientId));
    }
    writeJSON('mahalliy_shifokorlar.json', mData);
    sendSuccess(res, { message: "Bemor muvaffaqiyatli ko'chirildi" });
  } catch(e) { sendError(res, e.message, 500); }
}

// Barcha yo'naltirishlar
async function getReferrals(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { referrals } = readJSON('referrals.json');
    const { patients }  = readJSON('patients.json');
    const mahalliy      = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor           = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const result = referrals.map(r => ({
      ...r,
      bemor:              patients.find(p => p.id === r.patientId) || null,
      yuboruvchiShifokor: mahalliy.find(d => d.id === r.yuboruvcniShifokorId) || null,
      qabullovchi:        tor.find(d => d.id === r.qabullovchiShifokorId) || null,
    }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

// Barcha tashxislar
async function getAllDiagnoses(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { diagnoses } = readJSON('diagnoses.json');
    const { patients }  = readJSON('patients.json');
    const mahalliy      = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor           = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const q = getQueryParams(req.url);
    let result = diagnoses;
    if (q.patientId) result = result.filter(d => d.patientId === parseInt(q.patientId));
    if (q.ogirlik)   result = result.filter(d => d.ogirlikDarajasi === q.ogirlik);
    result = result.map(d => ({
      ...d,
      bemor: patients.find(p => p.id === d.patientId) || null,
      shifokor: d.shifokorTuri === 'mahalliy_shifokor'
        ? mahalliy.find(s => s.id === d.shifokorId) || null
        : tor.find(s => s.id === d.shifokorId) || null
    }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

// Navbat jadvali
async function getAllAppointments(req, res) {
  const user = authMiddleware(req, res, ROL); if (!user) return;
  try {
    const { appointments } = readJSON('appointments.json');
    const { patients }     = readJSON('patients.json');
    const mahalliy         = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor              = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const q = getQueryParams(req.url);
    let result = appointments;
    if (q.sana) result = result.filter(a => a.sana === q.sana);
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

module.exports = {
  getDashboard, getMyProfile,
  getAllPatients, getPatientProfile, transferPatient,
  getReferrals, getAllDiagnoses, getAllAppointments
};
