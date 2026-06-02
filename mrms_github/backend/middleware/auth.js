const { readJSON, sendError } = require('../utils/helpers');

const BARCHA_ROLLAR = ['admin','bosh_shifokor','mahalliy_shifokor','tor_shifokor','qabulxona','bemor'];

function authMiddleware(req, res, allowedRoles = []) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return sendError(res, "Ruxsat yo'q: Token topilmadi", 401), null;

  const token = authHeader.split(' ')[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);

    const { users } = readJSON('users.json');
    const user = users.find(u => u.id === payload.id && u.username === payload.username);

    if (!user) return sendError(res, "Ruxsat yo'q: Token noto'g'ri", 401), null;
    if (!user.faol) return sendError(res, "Hisobingiz bloklangan", 403), null;

    const roles = allowedRoles.length > 0 ? allowedRoles : BARCHA_ROLLAR;
    if (!roles.includes(user.role))
      return sendError(res, "Taqiqlangan: Bu amalni bajarish huquqingiz yo'q", 403), null;

    return user;
  } catch {
    return sendError(res, "Ruxsat yo'q: Token noto'g'ri format", 401), null;
  }
}

module.exports = { authMiddleware };
