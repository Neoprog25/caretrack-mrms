const http = require('http');
const fs   = require('fs');
const path = require('path');
const { sendError } = require('./utils/helpers');

const { login, getSecurityQuestion, resetPasswordBySecurity, adminResetPassword, changeMyPassword } = require('./controllers/authController');
const { getStats, getUsers, getUserById, createUser, updateUser, deleteUser, toggleUserStatus, getAllDoctors, getAllPatients, getPatientById, createPatient, updatePatient, deletePatient, getAllDiagnoses, createDiagnosis, updateDiagnosis, deleteDiagnosis, getAllAppointments: adminGetApps } = require('./controllers/adminController');
const { getDashboard, getMyProfile: boshProfile, getAllPatients: boshGetPatients, getPatientProfile: boshGetPatient, transferPatient, getReferrals: boshGetReferrals, getAllDiagnoses: boshGetDiagnoses, getAllAppointments: boshGetApps } = require('./controllers/boshShifokorController');
const { getMyProfile: mahalliyProfile, getMyPatients, getPatientProfile: mahalliyPatient, addDiagnosis, updateDiagnosis: mahalliyUpdateDiag, createReferral, getTorShi, getMyAppointments: mahalliyGetApps, updateAppointment: mahalliyUpdateApp } = require('./controllers/mahalliyShifokorController');
const { getMyProfile: torProfile, updateMyProfile: torUpdateProfile, getMyReferrals, updateReferral, getPatientProfile: torPatient, addConsultation, getMyAppointments: torGetApps, updateAppointment: torUpdateApp } = require('./controllers/torShifokorController');
const { getDoctors: qabulDoctors, getPatients: qabulPatients, registerPatient, assignDoctor, updatePatientInfo, createAppointment: qabulCreateApp, cancelAppointment: qabulCancelApp, getShifokorSchedule: qabulGetSchedule, getAllAppointments: qabulGetApps } = require('./controllers/qabulxonaController');
const { getMyProfile: bemorProfile, updateMyInfo, getAvailableShifokors, getMyAppointments: bemorGetApps, createAppointment: bemorCreateApp, cancelAppointment: bemorCancelApp, getShifokorSchedule: bemorGetSchedule } = require('./controllers/bemorController');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function serveStatic(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const urlPath = req.url.split('?')[0];
  const parts   = urlPath.split('/').filter(Boolean);
  const method  = req.method;

  // ── API ROUTES ──────────────────────────────────────────────────────────
  if (urlPath.startsWith('/api/')) {
    try {
      // AUTH
      if (method === 'POST' && urlPath === '/api/auth/login')                    return await login(req, res);
      if (method === 'GET'  && urlPath.startsWith('/api/auth/security-question')) return await getSecurityQuestion(req, res);
      if (method === 'POST' && urlPath === '/api/auth/reset-password')            return await resetPasswordBySecurity(req, res);
      if (method === 'POST' && urlPath === '/api/auth/admin-reset')               return await adminResetPassword(req, res);
      if (method === 'POST' && urlPath === '/api/auth/change-password')           return await changeMyPassword(req, res);

      // ADMIN
      if (parts[1] === 'admin') {
        if (parts[2] === 'stats'        && method === 'GET')  return await getStats(req, res);
        if (parts[2] === 'appointments' && method === 'GET')  return await adminGetApps(req, res);
        if (parts[2] === 'doctors'      && method === 'GET')  return await getAllDoctors(req, res);
        if (parts[2] === 'users') {
          if (method === 'GET'    && !parts[3])                             return await getUsers(req, res);
          if (method === 'GET'    && parts[3])                              return await getUserById(req, res, parts[3]);
          if (method === 'POST')                                            return await createUser(req, res);
          if (method === 'PUT'    && parts[3] && parts[4] === 'toggle')     return await toggleUserStatus(req, res, parts[3]);
          if (method === 'PUT'    && parts[3])                              return await updateUser(req, res, parts[3]);
          if (method === 'DELETE' && parts[3])                              return await deleteUser(req, res, parts[3]);
        }
        if (parts[2] === 'patients') {
          if (method === 'GET'    && !parts[3])                             return await getAllPatients(req, res);
          if (method === 'GET'    && parts[3])                              return await getPatientById(req, res, parts[3]);
          if (method === 'POST')                                            return await createPatient(req, res);
          if (method === 'PUT'    && parts[3])                              return await updatePatient(req, res, parts[3]);
          if (method === 'DELETE' && parts[3])                              return await deletePatient(req, res, parts[3]);
        }
        if (parts[2] === 'diagnoses') {
          if (method === 'GET'    && !parts[3])                             return await getAllDiagnoses(req, res);
          if (method === 'POST')                                            return await createDiagnosis(req, res);
          if (method === 'PUT'    && parts[3])                              return await updateDiagnosis(req, res, parts[3]);
          if (method === 'DELETE' && parts[3])                              return await deleteDiagnosis(req, res, parts[3]);
        }
      }

      // BOSH SHIFOKOR
      if (parts[1] === 'bosh-shifokor') {
        if (parts[2] === 'dashboard'    && method === 'GET')                return await getDashboard(req, res);
        if (parts[2] === 'profile'      && method === 'GET')                return await boshProfile(req, res);
        if (parts[2] === 'patients'     && method === 'GET' && !parts[3])   return await boshGetPatients(req, res);
        if (parts[2] === 'patients'     && method === 'GET' && parts[3])    return await boshGetPatient(req, res, parts[3]);
        if (parts[2] === 'patients'     && method === 'PUT' && parts[4] === 'transfer') return await transferPatient(req, res, parts[3]);
        if (parts[2] === 'referrals'    && method === 'GET')                return await boshGetReferrals(req, res);
        if (parts[2] === 'diagnoses'    && method === 'GET')                return await boshGetDiagnoses(req, res);
        if (parts[2] === 'appointments' && method === 'GET')                return await boshGetApps(req, res);
      }

      // MAHALLIY SHIFOKOR
      if (parts[1] === 'mahalliy-shifokor') {
        if (parts[2] === 'profile'         && method === 'GET')             return await mahalliyProfile(req, res);
        if (parts[2] === 'my-patients'     && method === 'GET')             return await getMyPatients(req, res);
        if (parts[2] === 'patients'        && method === 'GET' && parts[3]) return await mahalliyPatient(req, res, parts[3]);
        if (parts[2] === 'diagnoses'       && method === 'POST')            return await addDiagnosis(req, res);
        if (parts[2] === 'diagnoses'       && method === 'PUT' && parts[3]) return await mahalliyUpdateDiag(req, res, parts[3]);
        if (parts[2] === 'referrals'       && method === 'POST')            return await createReferral(req, res);
        if (parts[2] === 'tor-shifokorlar' && method === 'GET')             return await getTorShi(req, res);
        if (parts[2] === 'appointments'    && method === 'GET')             return await mahalliyGetApps(req, res);
        if (parts[2] === 'appointments'    && method === 'PUT' && parts[3]) return await mahalliyUpdateApp(req, res, parts[3]);
      }

      // TOR SHIFOKOR
      if (parts[1] === 'tor-shifokor') {
        if (parts[2] === 'profile'      && method === 'GET')                return await torProfile(req, res);
        if (parts[2] === 'profile'      && method === 'PUT')                return await torUpdateProfile(req, res);
        if (parts[2] === 'referrals'    && method === 'GET')                return await getMyReferrals(req, res);
        if (parts[2] === 'referrals'    && method === 'PUT' && parts[3])    return await updateReferral(req, res, parts[3]);
        if (parts[2] === 'patients'     && method === 'GET' && parts[3])    return await torPatient(req, res, parts[3]);
        if (parts[2] === 'consultation' && method === 'POST')               return await addConsultation(req, res);
        if (parts[2] === 'appointments' && method === 'GET')                return await torGetApps(req, res);
        if (parts[2] === 'appointments' && method === 'PUT' && parts[3])    return await torUpdateApp(req, res, parts[3]);
      }

      // QABULXONA
      if (parts[1] === 'qabulxona') {
        if (parts[2] === 'doctors'      && method === 'GET')                return await qabulDoctors(req, res);
        if (parts[2] === 'patients'     && method === 'GET')                return await qabulPatients(req, res);
        if (parts[2] === 'patients'     && method === 'POST')               return await registerPatient(req, res);
        if (parts[2] === 'patients'     && method === 'PUT' && parts[4] === 'assign') return await assignDoctor(req, res, parts[3]);
        if (parts[2] === 'patients'     && method === 'PUT' && parts[3])    return await updatePatientInfo(req, res, parts[3]);
        if (parts[2] === 'appointments' && method === 'GET')                return await qabulGetApps(req, res);
        if (parts[2] === 'appointments' && method === 'POST')               return await qabulCreateApp(req, res);
        if (parts[2] === 'appointments' && method === 'DELETE' && parts[3]) return await qabulCancelApp(req, res, parts[3]);
        if (parts[2] === 'schedule'     && method === 'GET')                return await qabulGetSchedule(req, res);
      }

      // BEMOR
      if (parts[1] === 'bemor') {
        if (parts[2] === 'profile'      && method === 'GET')                return await bemorProfile(req, res);
        if (parts[2] === 'profile'      && method === 'PUT')                return await updateMyInfo(req, res);
        if (parts[2] === 'shifokors'    && method === 'GET')                return await getAvailableShifokors(req, res);
        if (parts[2] === 'appointments' && method === 'GET')                return await bemorGetApps(req, res);
        if (parts[2] === 'appointments' && method === 'POST')               return await bemorCreateApp(req, res);
        if (parts[2] === 'appointments' && method === 'DELETE' && parts[3]) return await bemorCancelApp(req, res, parts[3]);
        if (parts[2] === 'schedule'     && method === 'GET')                return await bemorGetSchedule(req, res);
      }

      sendError(res, 'API route topilmadi: ' + urlPath, 404);
    } catch(err) {
      console.error('Server xatosi:', err.message);
      sendError(res, 'Server xatosi: ' + err.message, 500);
    }
    return;
  }

  // ── STATIC FILES (frontend) ──────────────────────────────────────────────
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  // /admin.html → frontend/admin.html
  const fullPath = path.join(FRONTEND_DIR, filePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    serveStatic(res, fullPath);
  } else {
    // SPA fallback → index.html
    serveStatic(res, path.join(FRONTEND_DIR, 'index.html'));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅  CareTrack MRMS ishga tushdi');
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log('  📁  Frontend: ../frontend/');
  console.log('');
});
