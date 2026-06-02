const bcrypt = require('bcryptjs');
const { readJSON, writeJSON, sendSuccess, sendError, parseBody, generateId, getQueryParams } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const ADMIN = ['admin'];

// Yosh hisoblash
function calcAge(tugilganSana) {
  if (!tugilganSana) return null;
  const bugun = new Date();
  const tugil  = new Date(tugilganSana);
  let yosh = bugun.getFullYear() - tugil.getFullYear();
  const m = bugun.getMonth() - tugil.getMonth();
  if (m < 0 || (m === 0 && bugun.getDate() < tugil.getDate())) yosh--;
  return yosh;
}

async function getStats(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const { patients }     = readJSON('patients.json');
    const { diagnoses }    = readJSON('diagnoses.json');
    const bosh             = readJSON('bosh_shifokorlar.json').bosh_shifokorlar;
    const mahalliy         = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor              = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const { referrals }    = readJSON('referrals.json');
    const { appointments } = readJSON('appointments.json');
    const today = new Date().toISOString().split('T')[0];
    sendSuccess(res, {
      bemorlarSoni:    patients.length,
      tashxislarSoni:  diagnoses.length,
      kritikHolatlar:  diagnoses.filter(d => d.ogirlikDarajasi === 'Kritik').length,
      shifokorlarSoni: bosh.length + mahalliy.length + tor.length,
      yonaltirishlar:  referrals.filter(r => r.holati === 'Kutilmoqda').length,
      bugungiQabul:    appointments.filter(a => a.sana === today).length,
    });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getUsers(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const { users }    = readJSON('users.json');
    const { patients } = readJSON('patients.json');
    const mahalliy     = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor          = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const bosh         = readJSON('bosh_shifokorlar.json').bosh_shifokorlar;
    const { bemorlar } = readJSON('bemorlar.json');

    const enriched = users.map(({ password, ...u }) => {
      let extra = {};
      // Rol bo'yicha qo'shimcha ma'lumot
      if (u.role === 'mahalliy_shifokor' && u.refId) {
        const doc = mahalliy.find(d => d.id === u.refId);
        if (doc) extra = { mutaxassislik: doc.mutaxassislik, bolim: doc.bolim, tajriba: doc.tajriba, licenseNumber: doc.licenseNumber };
      } else if (u.role === 'tor_shifokor' && u.refId) {
        const doc = tor.find(d => d.id === u.refId);
        if (doc) extra = { mutaxassislik: doc.mutaxassislik, bolim: doc.bolim, tajriba: doc.tajriba, licenseNumber: doc.licenseNumber, qabulKunlari: doc.qabulKunlari };
      } else if (u.role === 'bosh_shifokor' && u.refId) {
        const doc = bosh.find(d => d.id === u.refId);
        if (doc) extra = { mutaxassislik: doc.mutaxassislik, bolim: doc.bolim, tajriba: doc.tajriba, licenseNumber: doc.licenseNumber };
      } else if (u.role === 'bemor' && u.refId) {
        const bemor = bemorlar.find(b => b.userId === u.id);
        if (bemor) {
          const patient = patients.find(p => p.id === bemor.patientId);
          if (patient) extra = {
            tugilganSana: patient.tugilganSana,
            yosh:         calcAge(patient.tugilganSana),
            jinsi:        patient.jinsi,
            qonGuruhi:    patient.qonGuruhi,
            manzil:       patient.manzil,
            patientId:    patient.id,
          };
        }
      }
      return { ...u, ...extra };
    });
    sendSuccess(res, enriched);
  } catch(e) { sendError(res, e.message, 500); }
}

async function getUserById(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const { users }    = readJSON('users.json');
    const { patients } = readJSON('patients.json');
    const { diagnoses }    = readJSON('diagnoses.json');
    const { appointments } = readJSON('appointments.json');
    const mahalliy     = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const tor          = readJSON('tor_shifokorlar.json').tor_shifokorlar;
    const bosh         = readJSON('bosh_shifokorlar.json').bosh_shifokorlar;
    const { bemorlar } = readJSON('bemorlar.json');

    const u = users.find(x => x.id === parseInt(id));
    if (!u) return sendError(res, 'Foydalanuvchi topilmadi', 404);
    const { password, ...safe } = u;

    let profile = { ...safe };

    if (u.role === 'mahalliy_shifokor' && u.refId) {
      const doc = mahalliy.find(d => d.id === u.refId);
      if (doc) {
        profile.shifokorMalumot = doc;
        profile.bemorlarSoni = (doc.biriktirilganBemorlar || []).length;
      }
    } else if (u.role === 'tor_shifokor' && u.refId) {
      const doc = tor.find(d => d.id === u.refId);
      if (doc) profile.shifokorMalumot = doc;
    } else if (u.role === 'bosh_shifokor' && u.refId) {
      const doc = bosh.find(d => d.id === u.refId);
      if (doc) profile.shifokorMalumot = doc;
    } else if (u.role === 'bemor') {
      const bemor = bemorlar.find(b => b.userId === u.id);
      if (bemor) {
        const patient = patients.find(p => p.id === bemor.patientId);
        if (patient) {
          const mahalliyDoc = mahalliy.find(d => d.id === patient.mahalliyShifokorId);
          profile.bemorMalumot = {
            ...patient,
            yosh: calcAge(patient.tugilganSana),
            mahalliyShifokor: mahalliyDoc || null,
            tashxislar:   diagnoses.filter(d => d.patientId === patient.id),
            navbatlar:    appointments.filter(a => a.patientId === patient.id).slice(-5),
          };
        }
      }
    }
    sendSuccess(res, profile);
  } catch(e) { sendError(res, e.message, 500); }
}

async function createUser(req, res) {
  const admin = authMiddleware(req, res, ADMIN); if (!admin) return;
  try {
    const body = await parseBody(req);
    const { username, password, role, fullName } = body;
    if (!username || !password || !role || !fullName)
      return sendError(res, 'Barcha majburiy maydonlarni to\'ldiring', 400);
    if (password.length < 6)
      return sendError(res, 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak', 400);

    const data = readJSON('users.json');
    if (data.users.find(u => u.username === username))
      return sendError(res, 'Bu username allaqachon mavjud', 409);

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = {
      id: generateId(data.users),
      username, password: hashedPassword, role, fullName,
      phone: body.phone || '', email: body.email || '',
      refId: null,
      xavfsizlikSavoli: body.xavfsizlikSavoli || 'Onangizning qiz ismi?',
      xavfsizlikJavobi: body.xavfsizlikJavobi || 'default',
      createdAt: new Date().toISOString().split('T')[0],
      faol: true
    };
    data.users.push(newUser);
    writeJSON('users.json', data);

    // Rol bo'yicha tegishli JSON ga ham qo'shamiz
    if (role === 'mahalliy_shifokor') {
      const mData = readJSON('mahalliy_shifokorlar.json');
      const parts = fullName.replace('Dr. ','').split(' ');
      const newDoc = {
        id: generateId(mData.mahalliy_shifokorlar),
        firstName: parts[0], lastName: parts.slice(1).join(' '),
        phone: body.phone || '', email: body.email || '',
        mutaxassislik: body.mutaxassislik || 'Umumiy amaliyot (GP)',
        bolim: body.bolim || 'Umumiy qabul',
        licenseNumber: body.licenseNumber || '',
        tajriba: parseInt(body.tajriba) || 0,
        biriktirilganBemorlar: [],
        createdAt: new Date().toISOString().split('T')[0]
      };
      mData.mahalliy_shifokorlar.push(newDoc);
      writeJSON('mahalliy_shifokorlar.json', mData);
      const idx = data.users.findIndex(u => u.username === username);
      data.users[idx].refId = newDoc.id;
      writeJSON('users.json', data);

    } else if (role === 'tor_shifokor') {
      const tData = readJSON('tor_shifokorlar.json');
      const parts = fullName.replace('Dr. ','').split(' ');
      const newDoc = {
        id: generateId(tData.tor_shifokorlar),
        firstName: parts[0], lastName: parts.slice(1).join(' '),
        phone: body.phone || '', email: body.email || '',
        mutaxassislik: body.mutaxassislik || 'Mutaxassis',
        bolim: body.bolim || "Mutaxassislik bo'limi",
        licenseNumber: body.licenseNumber || '',
        tajriba: parseInt(body.tajriba) || 0,
        qabulKunlari: body.qabulKunlari || [],
        createdAt: new Date().toISOString().split('T')[0]
      };
      tData.tor_shifokorlar.push(newDoc);
      writeJSON('tor_shifokorlar.json', tData);
      const idx = data.users.findIndex(u => u.username === username);
      data.users[idx].refId = newDoc.id;
      writeJSON('users.json', data);

    } else if (role === 'bosh_shifokor') {
      const bData = readJSON('bosh_shifokorlar.json');
      const parts = fullName.replace('Prof. ','').replace('Dr. ','').split(' ');
      const newDoc = {
        id: generateId(bData.bosh_shifokorlar),
        firstName: parts[0], lastName: parts.slice(1).join(' '),
        phone: body.phone || '', email: body.email || '',
        mutaxassislik: body.mutaxassislik || 'Umumiy tibbiyot',
        bolim: body.bolim || 'Boshqaruv',
        licenseNumber: body.licenseNumber || '',
        tajriba: parseInt(body.tajriba) || 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      bData.bosh_shifokorlar.push(newDoc);
      writeJSON('bosh_shifokorlar.json', bData);
      const idx = data.users.findIndex(u => u.username === username);
      data.users[idx].refId = newDoc.id;
      writeJSON('users.json', data);

    } else if (role === 'bemor') {
      const pData = readJSON('patients.json');
      const bData = readJSON('bemorlar.json');
      const parts = fullName.split(' ');
      const newPatient = {
        id: generateId(pData.patients),
        firstName: parts[0], lastName: parts.slice(1).join(' '),
        tugilganSana: body.tugilganSana || '',
        jinsi: body.jinsi || '',
        phone: body.phone || '',
        email: body.email || '',
        manzil: body.manzil || '',
        qonGuruhi: body.qonGuruhi || '',
        mahalliyShifokorId: body.mahalliyShifokorId ? parseInt(body.mahalliyShifokorId) : null,
        royxatgaOlingan: new Date().toISOString().split('T')[0]
      };
      pData.patients.push(newPatient);
      writeJSON('patients.json', pData);
      const newBemor = {
        id: generateId(bData.bemorlar),
        userId: newUser.id, patientId: newPatient.id,
        username, fullName,
        createdAt: new Date().toISOString().split('T')[0]
      };
      bData.bemorlar.push(newBemor);
      writeJSON('bemorlar.json', bData);
      const idx = data.users.findIndex(u => u.username === username);
      data.users[idx].refId = newPatient.id;
      writeJSON('users.json', data);
    }

    const { password: _, ...safeUser } = newUser;
    sendSuccess(res, safeUser, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

async function updateUser(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const body = await parseBody(req);
    const data = readJSON('users.json');
    const idx  = data.users.findIndex(u => u.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Foydalanuvchi topilmadi', 404);
    // Parolni alohida o'zgartiriladi — bu yerda o'zgartirmaymiz
    const { password, ...updates } = body;
    data.users[idx] = { ...data.users[idx], ...updates, id: data.users[idx].id };
    writeJSON('users.json', data);
    const { password: _, ...safe } = data.users[idx];
    sendSuccess(res, safe);
  } catch(e) { sendError(res, e.message, 500); }
}

async function deleteUser(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const data = readJSON('users.json');
    const idx  = data.users.findIndex(u => u.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Foydalanuvchi topilmadi', 404);
    if (parseInt(id) === user.id) return sendError(res, "O'z hisobingizni o'chira olmaysiz", 400);
    data.users.splice(idx, 1);
    writeJSON('users.json', data);
    sendSuccess(res, { message: "Foydalanuvchi o'chirildi" });
  } catch(e) { sendError(res, e.message, 500); }
}

async function toggleUserStatus(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const data = readJSON('users.json');
    const idx  = data.users.findIndex(u => u.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Foydalanuvchi topilmadi', 404);
    if (parseInt(id) === user.id) return sendError(res, "O'z hisobingizni bloklay olmaysiz", 400);
    data.users[idx].faol = !data.users[idx].faol;
    writeJSON('users.json', data);
    sendSuccess(res, { faol: data.users[idx].faol, message: data.users[idx].faol ? 'Hisob faollashtirildi' : 'Hisob bloklandi' });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getAllDoctors(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const bosh     = readJSON('bosh_shifokorlar.json').bosh_shifokorlar.map(d => ({ ...d, turi: 'bosh_shifokor' }));
    const mahalliy = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar.map(d => ({ ...d, turi: 'mahalliy_shifokor' }));
    const tor      = readJSON('tor_shifokorlar.json').tor_shifokorlar.map(d => ({ ...d, turi: 'tor_shifokor' }));
    sendSuccess(res, { bosh, mahalliy, tor, jami: bosh.length + mahalliy.length + tor.length });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getAllPatients(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const { patients } = readJSON('patients.json');
    const mahalliy     = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const q = getQueryParams(req.url);
    let result = patients;
    if (q.search) {
      const s = q.search.toLowerCase();
      result = result.filter(p =>
        p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s) || (p.phone||'').includes(s)
      );
    }
    if (q.shifokorId) result = result.filter(p => p.mahalliyShifokorId === parseInt(q.shifokorId));
    result = result.map(p => ({
      ...p,
      yosh: calcAge(p.tugilganSana),
      mahalliyShifokor: mahalliy.find(d => d.id === p.mahalliyShifokorId) || null
    }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

async function getPatientById(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const { patients }     = readJSON('patients.json');
    const mahalliy         = readJSON('mahalliy_shifokorlar.json').mahalliy_shifokorlar;
    const { diagnoses }    = readJSON('diagnoses.json');
    const { appointments } = readJSON('appointments.json');
    const patient = patients.find(p => p.id === parseInt(id));
    if (!patient) return sendError(res, 'Bemor topilmadi', 404);
    sendSuccess(res, {
      ...patient,
      yosh: calcAge(patient.tugilganSana),
      mahalliyShifokor: mahalliy.find(d => d.id === patient.mahalliyShifokorId) || null,
      tashxislar:   diagnoses.filter(d => d.patientId === patient.id),
      navbatlar:    appointments.filter(a => a.patientId === patient.id)
    });
  } catch(e) { sendError(res, e.message, 500); }
}

async function createPatient(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const body = await parseBody(req);
    const { firstName, lastName, tugilganSana, jinsi, phone } = body;
    if (!firstName || !lastName || !tugilganSana || !jinsi || !phone)
      return sendError(res, "Majburiy maydonlarni to'ldiring", 400);
    const data = readJSON('patients.json');
    const newPatient = {
      id: generateId(data.patients),
      firstName, lastName, tugilganSana, jinsi, phone,
      email: body.email || '', manzil: body.manzil || '',
      qonGuruhi: body.qonGuruhi || '',
      mahalliyShifokorId: body.mahalliyShifokorId ? parseInt(body.mahalliyShifokorId) : null,
      royxatgaOlingan: new Date().toISOString().split('T')[0]
    };
    data.patients.push(newPatient);
    writeJSON('patients.json', data);
    sendSuccess(res, newPatient, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

async function updatePatient(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const body = await parseBody(req);
    const data = readJSON('patients.json');
    const idx  = data.patients.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Bemor topilmadi', 404);
    data.patients[idx] = { ...data.patients[idx], ...body, id: data.patients[idx].id };
    writeJSON('patients.json', data);
    sendSuccess(res, data.patients[idx]);
  } catch(e) { sendError(res, e.message, 500); }
}

async function deletePatient(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const data = readJSON('patients.json');
    const idx  = data.patients.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Bemor topilmadi', 404);
    data.patients.splice(idx, 1);
    writeJSON('patients.json', data);
    sendSuccess(res, { message: "Bemor o'chirildi" });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getAllDiagnoses(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const { diagnoses } = readJSON('diagnoses.json');
    const { patients }  = readJSON('patients.json');
    const q = getQueryParams(req.url);
    let result = diagnoses;
    if (q.patientId) result = result.filter(d => d.patientId === parseInt(q.patientId));
    if (q.ogirlik)   result = result.filter(d => d.ogirlikDarajasi === q.ogirlik);
    if (q.search) {
      const s = q.search.toLowerCase();
      result = result.filter(d => d.icdKod.toLowerCase().includes(s) || d.tavsif.toLowerCase().includes(s));
    }
    result = result.map(d => ({ ...d, bemor: patients.find(p => p.id === d.patientId) || null }));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

async function createDiagnosis(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const body = await parseBody(req);
    const { patientId, icdKod, tavsif, ogirlikDarajasi } = body;
    if (!patientId || !icdKod || !tavsif || !ogirlikDarajasi)
      return sendError(res, "Majburiy maydonlarni to'ldiring", 400);
    const data = readJSON('diagnoses.json');
    const newDiag = {
      id: generateId(data.diagnoses),
      patientId: parseInt(patientId),
      shifokorId: null, shifokorTuri: 'admin',
      icdKod, tavsif, ogirlikDarajasi,
      izoh: body.izoh || '', holati: body.holati || 'Faol',
      tashxisSana: new Date().toISOString().split('T')[0]
    };
    data.diagnoses.push(newDiag);
    writeJSON('diagnoses.json', data);
    sendSuccess(res, newDiag, 201);
  } catch(e) { sendError(res, e.message, 500); }
}

async function updateDiagnosis(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const body = await parseBody(req);
    const data = readJSON('diagnoses.json');
    const idx  = data.diagnoses.findIndex(d => d.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Tashxis topilmadi', 404);
    data.diagnoses[idx] = { ...data.diagnoses[idx], ...body, id: data.diagnoses[idx].id };
    writeJSON('diagnoses.json', data);
    sendSuccess(res, data.diagnoses[idx]);
  } catch(e) { sendError(res, e.message, 500); }
}

async function deleteDiagnosis(req, res, id) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
  try {
    const data = readJSON('diagnoses.json');
    const idx  = data.diagnoses.findIndex(d => d.id === parseInt(id));
    if (idx === -1) return sendError(res, 'Tashxis topilmadi', 404);
    data.diagnoses.splice(idx, 1);
    writeJSON('diagnoses.json', data);
    sendSuccess(res, { message: "Tashxis o'chirildi" });
  } catch(e) { sendError(res, e.message, 500); }
}

async function getAllAppointments(req, res) {
  const user = authMiddleware(req, res, ADMIN); if (!user) return;
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
      bemor:    patients.find(p => p.id === a.patientId) || null,
      shifokor: a.shifokorTuri === 'mahalliy_shifokor'
        ? mahalliy.find(d => d.id === a.shifokorId) || null
        : tor.find(d => d.id === a.shifokorId) || null
    })).sort((a, b) => (a.sana + a.vaqt).localeCompare(b.sana + b.vaqt));
    sendSuccess(res, result);
  } catch(e) { sendError(res, e.message, 500); }
}

module.exports = {
  getStats,
  getUsers, getUserById, createUser, updateUser, deleteUser, toggleUserStatus,
  getAllDoctors,
  getAllPatients, getPatientById, createPatient, updatePatient, deletePatient,
  getAllDiagnoses, createDiagnosis, updateDiagnosis, deleteDiagnosis,
  getAllAppointments
};
