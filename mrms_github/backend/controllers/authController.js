const bcrypt = require('bcryptjs');
const { readJSON, writeJSON, sendSuccess, sendError, parseBody } = require('../utils/helpers');

const ROLE_REDIRECT = {
  admin:             'admin.html',
  bosh_shifokor:     'bosh-shifokor.html',
  mahalliy_shifokor: 'mahalliy-shifokor.html',
  tor_shifokor:      'tor-shifokor.html',
  qabulxona:         'qabulxona.html',
  bemor:             'bemor.html',
};

// Login
async function login(req, res) {
  try {
    const { username, password } = await parseBody(req);
    if (!username || !password)
      return sendError(res, 'Username va parol kiritilishi shart', 400);

    const { users } = readJSON('users.json');
    const user = users.find(u => u.username === username);

    if (!user) return sendError(res, "Username yoki parol noto'g'ri", 401);
    if (!user.faol) return sendError(res, "Hisobingiz bloklangan. Adminga murojaat qiling", 403);

    const parolTogri = bcrypt.compareSync(password, user.password);
    if (!parolTogri) return sendError(res, "Username yoki parol noto'g'ri", 401);

    const tokenPayload = { id: user.id, username: user.username, role: user.role, refId: user.refId };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    sendSuccess(res, {
      token,
      redirect: ROLE_REDIRECT[user.role] || 'index.html',
      user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName, refId: user.refId }
    });
  } catch(e) { sendError(res, e.message, 500); }
}

// Xavfsizlik savolini olish (username bo'yicha)
async function getSecurityQuestion(req, res) {
  try {
    const { username } = require('../utils/helpers').getQueryParams(req.url);
    if (!username) return sendError(res, 'Username kiritilmadi', 400);

    const { users } = readJSON('users.json');
    const user = users.find(u => u.username === username);
    if (!user) return sendError(res, 'Foydalanuvchi topilmadi', 404);

    sendSuccess(res, { savol: user.xavfsizlikSavoli });
  } catch(e) { sendError(res, e.message, 500); }
}

// Xavfsizlik savoli orqali parolni tiklash
async function resetPasswordBySecurity(req, res) {
  try {
    const { username, javob, yangiParol } = await parseBody(req);
    if (!username || !javob || !yangiParol)
      return sendError(res, 'Barcha maydonlar kiritilishi shart', 400);
    if (yangiParol.length < 6)
      return sendError(res, "Parol kamida 6 ta belgidan iborat bo'lishi kerak", 400);

    const data = readJSON('users.json');
    const idx  = data.users.findIndex(u => u.username === username);
    if (idx === -1) return sendError(res, 'Foydalanuvchi topilmadi', 404);

    const javobTogri = javob.toLowerCase().trim() === data.users[idx].xavfsizlikJavobi.toLowerCase().trim();
    if (!javobTogri) return sendError(res, "Xavfsizlik savoli javobi noto'g'ri", 401);

    data.users[idx].password = bcrypt.hashSync(yangiParol, 10);
    writeJSON('users.json', data);
    sendSuccess(res, { message: 'Parol muvaffaqiyatli yangilandi' });
  } catch(e) { sendError(res, e.message, 500); }
}

// Admin tomonidan parolni tiklash
async function adminResetPassword(req, res) {
  try {
    const { authMiddleware } = require('../middleware/auth');
    const admin = authMiddleware(req, res, ['admin']);
    if (!admin) return;

    const { userId, yangiParol } = await parseBody(req);
    if (!userId || !yangiParol)
      return sendError(res, 'userId va yangiParol kiritilishi shart', 400);
    if (yangiParol.length < 6)
      return sendError(res, "Parol kamida 6 ta belgidan iborat bo'lishi kerak", 400);

    const data = readJSON('users.json');
    const idx  = data.users.findIndex(u => u.id === parseInt(userId));
    if (idx === -1) return sendError(res, 'Foydalanuvchi topilmadi', 404);

    data.users[idx].password = bcrypt.hashSync(yangiParol, 10);
    writeJSON('users.json', data);
    sendSuccess(res, { message: `${data.users[idx].fullName} uchun parol yangilandi` });
  } catch(e) { sendError(res, e.message, 500); }
}

// O'z parolini o'zgartirish
async function changeMyPassword(req, res) {
  try {
    const { authMiddleware } = require('../middleware/auth');
    const user = authMiddleware(req, res, []);
    if (!user) return;

    const { eskiParol, yangiParol } = await parseBody(req);
    if (!eskiParol || !yangiParol)
      return sendError(res, 'Eski va yangi parol kiritilishi shart', 400);
    if (yangiParol.length < 6)
      return sendError(res, "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak", 400);

    const data = readJSON('users.json');
    const idx  = data.users.findIndex(u => u.id === user.id);
    if (idx === -1) return sendError(res, 'Foydalanuvchi topilmadi', 404);

    if (!bcrypt.compareSync(eskiParol, data.users[idx].password))
      return sendError(res, "Eski parol noto'g'ri", 401);

    data.users[idx].password = bcrypt.hashSync(yangiParol, 10);
    writeJSON('users.json', data);
    sendSuccess(res, { message: 'Parol muvaffaqiyatli o\'zgartirildi' });
  } catch(e) { sendError(res, e.message, 500); }
}

module.exports = { login, getSecurityQuestion, resetPasswordBySecurity, adminResetPassword, changeMyPassword };
