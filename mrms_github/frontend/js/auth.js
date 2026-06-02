function saveSession(token, user) {
  localStorage.setItem('mrms_token', token);
  localStorage.setItem('mrms_user', JSON.stringify(user));
}

// ── DARK/LIGHT MODE ──
function initTheme() {
  const saved = localStorage.getItem('mrms_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateToggleIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mrms_theme', next);
  updateToggleIcon(next);
}

function updateToggleIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Sahifa yuklanganda themeni qo'llamiz
document.addEventListener('DOMContentLoaded', initTheme);

function getUser() {
  const raw = localStorage.getItem('mrms_user');
  return raw ? JSON.parse(raw) : null;
}

function getRole() {
  const user = getUser();
  return user ? user.role : null;
}

function requireAuth(allowedRole) {
  const token = localStorage.getItem('mrms_token');
  const user  = getUser();
  if (!token || !user) {
    window.location.href = '/index.html';
    return false;
  }
  if (allowedRole && user.role !== allowedRole) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}

function renderUserInfo() {
  const user = getUser();
  if (!user) return;

  const rolLabels = {
    admin:             'Administrator',
    bosh_shifokor:     'Bosh shifokor',
    mahalliy_shifokor: 'Mahalliy shifokor',
    tor_shifokor:      'Tor shifokor',
    qabulxona:         'Qabulxona xodimi',
    bemor:             'Bemor',
  };

  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl)   nameEl.textContent   = user.fullName || user.username;
  if (roleEl)   roleEl.textContent   = rolLabels[user.role] || user.role;
  if (avatarEl) avatarEl.textContent = (user.fullName || user.username).charAt(0).toUpperCase();
}

function highlightNav() {
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === page || href.includes(page)) {
      link.classList.add('active');
    }
  });
}

function showToast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function setLoading(tbodyId, colspan) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${colspan}" class="table-empty"><div class="loading"><div class="spinner"></div> Yuklanmoqda...</div></td></tr>`;
}

function setEmpty(tbodyId, colspan, msg = 'Ma\'lumot topilmadi') {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${colspan}" class="table-empty">${msg}</td></tr>`;
}
