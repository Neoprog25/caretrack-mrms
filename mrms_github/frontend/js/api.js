// Render.com da deploy bo'lganda relative URL ishlatamiz
// Localhost da to'liq URL ishlatamiz
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api';

async function request(method, endpoint, body = null) {
  const token = localStorage.getItem('mrms_token');
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  if (body)  options.body = JSON.stringify(body);
  try {
    const res  = await fetch(`${BASE_URL}${endpoint}`, options);
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/index.html';
      return null;
    }
    const data = await res.json();
    return data;
  } catch(err) {
    console.error('API xatosi:', err);
    return { success: false, message: "Server bilan aloqa yo'q" };
  }
}

const api = {
  login:               (u, p)        => request('POST', '/auth/login', { username: u, password: p }),
  getSecurityQuestion: (username)    => request('GET',  `/auth/security-question?username=${encodeURIComponent(username)}`),
  resetPassword:       (u, j, p)    => request('POST', '/auth/reset-password', { username: u, javob: j, yangiParol: p }),
  adminResetPassword:  (userId, p)  => request('POST', '/auth/admin-reset', { userId, yangiParol: p }),
  changeMyPassword:    (eski, yangi) => request('POST', '/auth/change-password', { eskiParol: eski, yangiParol: yangi }),

  getStats:            ()            => request('GET',  '/admin/stats'),
  getUsers:            ()            => request('GET',  '/admin/users'),
  getUserById:         (id)          => request('GET',  `/admin/users/${id}`),
  createUser:          (d)           => request('POST', '/admin/users', d),
  updateUser:          (id, d)       => request('PUT',  `/admin/users/${id}`, d),
  deleteUser:          (id)          => request('DELETE',`/admin/users/${id}`),
  toggleUserStatus:    (id)          => request('PUT',  `/admin/users/${id}/toggle`),
  adminGetDoctors:     ()            => request('GET',  '/admin/doctors'),
  adminGetPatients:    (q = '')      => request('GET',  `/admin/patients${q}`),
  adminGetPatient:     (id)          => request('GET',  `/admin/patients/${id}`),
  adminCreatePatient:  (d)           => request('POST', '/admin/patients', d),
  adminUpdatePatient:  (id, d)       => request('PUT',  `/admin/patients/${id}`, d),
  adminDeletePatient:  (id)          => request('DELETE',`/admin/patients/${id}`),
  adminGetDiagnoses:   (q = '')      => request('GET',  `/admin/diagnoses${q}`),
  adminCreateDiag:     (d)           => request('POST', '/admin/diagnoses', d),
  adminUpdateDiag:     (id, d)       => request('PUT',  `/admin/diagnoses/${id}`, d),
  adminDeleteDiag:     (id)          => request('DELETE',`/admin/diagnoses/${id}`),
  adminGetApps:        (q = '')      => request('GET',  `/admin/appointments${q}`),

  boshDashboard:       ()            => request('GET',  '/bosh-shifokor/dashboard'),
  boshGetProfile:      ()            => request('GET',  '/bosh-shifokor/profile'),
  boshGetPatients:     ()            => request('GET',  '/bosh-shifokor/patients'),
  boshGetPatient:      (id)          => request('GET',  `/bosh-shifokor/patients/${id}`),
  boshTransfer:        (id, d)       => request('PUT',  `/bosh-shifokor/patients/${id}/transfer`, d),
  boshGetReferrals:    ()            => request('GET',  '/bosh-shifokor/referrals'),
  boshGetDiagnoses:    ()            => request('GET',  '/bosh-shifokor/diagnoses'),
  boshGetApps:         ()            => request('GET',  '/bosh-shifokor/appointments'),

  mahalliyProfile:     ()            => request('GET',  '/mahalliy-shifokor/profile'),
  mahalliyPatients:    ()            => request('GET',  '/mahalliy-shifokor/my-patients'),
  mahalliyPatient:     (id)          => request('GET',  `/mahalliy-shifokor/patients/${id}`),
  mahalliyAddDiag:     (d)           => request('POST', '/mahalliy-shifokor/diagnoses', d),
  mahalliyUpdateDiag:  (id, d)       => request('PUT',  `/mahalliy-shifokor/diagnoses/${id}`, d),
  mahalliyCreateRef:   (d)           => request('POST', '/mahalliy-shifokor/referrals', d),
  mahalliyGetTorlar:   ()            => request('GET',  '/mahalliy-shifokor/tor-shifokorlar'),
  mahalliyGetApps:     ()            => request('GET',  '/mahalliy-shifokor/appointments'),
  mahalliyUpdateApp:   (id, d)       => request('PUT',  `/mahalliy-shifokor/appointments/${id}`, d),

  torProfile:          ()            => request('GET',  '/tor-shifokor/profile'),
  torUpdateProfile:    (d)           => request('PUT',  '/tor-shifokor/profile', d),
  torReferrals:        ()            => request('GET',  '/tor-shifokor/referrals'),
  torUpdateRef:        (id, d)       => request('PUT',  `/tor-shifokor/referrals/${id}`, d),
  torPatient:          (id)          => request('GET',  `/tor-shifokor/patients/${id}`),
  torAddConsult:       (d)           => request('POST', '/tor-shifokor/consultation', d),
  torGetApps:          (q = '')      => request('GET',  `/tor-shifokor/appointments${q}`),
  torUpdateApp:        (id, d)       => request('PUT',  `/tor-shifokor/appointments/${id}`, d),

  qabulDoctors:        ()            => request('GET',  '/qabulxona/doctors'),
  qabulPatients:       (q = '')      => request('GET',  `/qabulxona/patients${q}`),
  qabulRegister:       (d)           => request('POST', '/qabulxona/patients', d),
  qabulAssign:         (id, d)       => request('PUT',  `/qabulxona/patients/${id}/assign`, d),
  qabulUpdate:         (id, d)       => request('PUT',  `/qabulxona/patients/${id}`, d),
  qabulGetApps:        (q = '')      => request('GET',  `/qabulxona/appointments${q}`),
  qabulCreateApp:      (d)           => request('POST', '/qabulxona/appointments', d),
  qabulCancelApp:      (id)          => request('DELETE',`/qabulxona/appointments/${id}`),
  qabulGetSchedule:    (id, turi, sana) => request('GET', `/qabulxona/schedule?shifokorId=${id}&shifokorTuri=${turi}&sana=${sana}`),

  bemorProfile:        ()            => request('GET',  '/bemor/profile'),
  bemorUpdate:         (d)           => request('PUT',  '/bemor/profile', d),
  bemorGetShifokors:   ()            => request('GET',  '/bemor/shifokors'),
  bemorGetApps:        ()            => request('GET',  '/bemor/appointments'),
  bemorCreateApp:      (d)           => request('POST', '/bemor/appointments', d),
  bemorCancelApp:      (id)          => request('DELETE',`/bemor/appointments/${id}`),
  bemorGetSchedule:    (id, turi, sana) => request('GET', `/bemor/schedule?shifokorId=${id}&shifokorTuri=${turi}&sana=${sana}`),
};
