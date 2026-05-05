
const NAMES = ["Bahodirjonov Sardor", "Bahodirov Asadbek", "Farangiz", "Farxodjon 08", "Ibrohim", "Muhiddinov Nurillo", "Dadajonova Munavvara", "Og'abek", "Omonov Alisher", "Shavkatova Fotima", "Shaxboz", "Tojaliyev G'ayratjon", "Tolipjonov Asadbek", "Tursunaliyev Abdulaziz", "Umaraliyev Ozodbek", "Abdurazoqova Ra'noxon", "Abdulhakimov Sardorbek", "Ahmadjonova Shodiyona", "Hamidov Abdulahat", "Abdumo'minov Muhammadmuhtor", "Hoshimov Abdulhafiz", "Hasanboyev Muhamqodir", "Nurmuhamadov Diyorbek", "Mahamadov Ozodbek", "Shavkatov Abdulatif"];
const SK = "texno_v5";
const DEFAULT_SUPER_ADMIN_PASSWORD = "Admin2026";
const SECURITY_LOCK_MINUTES = 1;

let teachers = [];
let students = [];
let txs = [];
let admins = [];
let adminRequests = [];
let messages = [];
let telegramProfiles = {};
let nid = 1;
let ntid = 1;
let naid = 1;
let nrid = 1;
let curType = null;
let curId = null;
let curTeacherId = null;
let curAdminId = null;
let lbM = "overall", lbM2 = "overall", chart = null;
let _refreshTimer = null;
const medals = ['🥇', '🥈', '🥉'];
const authState = {};

function nNum(v) { return Number(v); }
function escHtml(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function el(id) { return document.getElementById(id); }
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return Promise.resolve();
}
function genP(seed) { const safe = (seed || '').replace(/[^a-zA-Z0-9]/g, ''); return (safe.slice(0, 3).toUpperCase() || "USR") + (~~(Math.random() * 900) + 100); }
function genCode(prefix = 'ADM') { return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }
function normRefCode(v) { return String(v || '').trim().toUpperCase(); }
function makeRefCode(id) { return `REF${id}${~~(Math.random() * 100)}`; }
function uniqueRefCode(id, used) { let c = makeRefCode(id); while (used.has(c)) { c = makeRefCode(id); } return c; }
function validStrongPassword(p) { return typeof p === 'string' && p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p); }
function maskPhone(phone) { const raw = String(phone || '').replace(/\D/g, ''); if (!raw) return '-'; if (raw.length <= 4) return raw; return '****' + raw.slice(-4); }
async function sendSmsNotification(phone, message) { if (!phone) return false; try { const res = await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, message }) }); const data = await res.json(); if (res.ok) { return true; } console.warn('SMS xato', data); return false; } catch (e) { console.warn('SMS fetch xato', e); return false; } }
function profileTelegramText(profile) { if (!profile || !profile.telegramId) return 'Telegram ulanmagan'; const name = profile.telegramName || 'Telegram foydalanuvchi'; const username = profile.telegramUsername ? ` (@${profile.telegramUsername})` : ''; return `${name}${username} · ID ${profile.telegramId}`; }
function applyTelegramProfile(target, profile) { target.telegramId = nNum(profile.telegramId); target.telegramName = profile.telegramName || ''; target.telegramUsername = profile.telegramUsername || ''; target.telegramPhotoFileId = profile.telegramPhotoFileId || ''; target.telegramPhotoUrl = profile.telegramPhotoUrl || ''; if (target.telegramId) telegramProfiles[String(target.telegramId)] = { ...profile }; }
async function fetchTelegramProfileById(telegramId) {
  try {
    const res = await fetch(`/api/telegram/profile/${encodeURIComponent(telegramId)}?refresh=1`);
    const data = await res.json();
    if (res.ok && data.ok && data.profile) return data.profile;
  } catch (e) {
    console.warn('Telegram profil olinmadi', e);
  }
  return { telegramId: nNum(telegramId), telegramName: '', telegramUsername: '', telegramPhotoFileId: '', telegramPhotoUrl: '' };
}
function renderTelegramLinkBox(prefix, target) { const info = document.getElementById(`${prefix}TgInfo`); const input = document.getElementById(`${prefix}TgId`); const img = document.getElementById(`${prefix}TgPhoto`); if (input) input.value = target && target.telegramId ? target.telegramId : ''; if (info) info.textContent = profileTelegramText(target); if (img) { const photoUrl = target && target.telegramPhotoUrl ? target.telegramPhotoUrl : ''; img.style.backgroundImage = photoUrl ? `url("${photoUrl}")` : ''; img.textContent = photoUrl ? '' : 'TG'; } }
async function linkTelegramForCurrentProfile(prefix) {
  const input = document.getElementById(`${prefix}TgId`);
  const telegramId = String(input ? input.value : '').replace(/\D/g, '').trim();
  if (!telegramId || !/^\d+$/.test(telegramId)) { toast('Telegram ID faqat raqam bo'lishi kerak', 'error'); return; }
  let target = null;
  if (prefix === 'pr') target = getStudentById(curId);
  if (prefix === 'tp' && curType === 'teacher') target = getTeacherById(curTeacherId);
  if (prefix === 'tp' && curType === 'admin') target = getAdminById(curAdminId);
  if (!target) { toast('Profil topilmadi', 'error'); return; }
  try {
    const profile = await fetchTelegramProfileById(telegramId);
    applyTelegramProfile(target, profile);
    await save();
    renderTelegramLinkBox(prefix, target);
    toast('Telegram profil ulandi', 'success');
  } catch (e) {
    target.telegramId = nNum(telegramId);
    await save();
    renderTelegramLinkBox(prefix, target);
    toast('ID saqlandi. Botga /start bosilganda ism va rasm yangilanadi.', 'info');
  }
}

function getTeacherById(id) { return teachers.find(t => t.id === nNum(id)); }
function getStudentById(id) { return students.find(s => s.id === nNum(id)); }
function getAdminById(id) { return admins.find(a => a.id === nNum(id)); }
function getSuperAdmin() { return admins.find(a => a.role === 'super'); }
function isAdmin() { return curType === 'admin'; }
function isSuperAdmin() { const a = getAdminById(curAdminId); return !!(a && a.role === 'super' && a.status === 'active'); }
function isTeacherMode() { return curType === 'teacher' || curType === 'admin'; }
function activeAdmins() { return admins.filter(a => a.status === 'active'); }
function activeSubAdmins() { return admins.filter(a => a.status === 'active' && a.role === 'admin'); }
function pendingAdmins() { return admins.filter(a => a.status === 'pending'); }
function adminLabel(a) { return a.role === 'super' ? 'Super Admin' : 'Admin'; }

function scopeStudents() {
  if (curType === 'student') {
    const s = getStudentById(curId);
    if (!s) return [];
    return students.filter(x => x.teacherId === s.teacherId);
  }
  if (curType === 'teacher') return students.filter(x => x.teacherId === curTeacherId);
  return students;
}
function manageStudents() {
  if (curType === 'teacher') return students.filter(x => x.teacherId === curTeacherId);
  if (curType === 'admin') return students;
  return [];
}
function canManageStudent(s) { if (!s) return false; return curType === 'admin' || (curType === 'teacher' && s.teacherId === curTeacherId); }
function byModeValue(sid, mode) {
  if (mode === "weekly") { const w = Date.now() - 7 * 864e5; return txs.filter(t => t.studentId === sid && t.timestamp >= w).reduce((a, b) => a + b.amount, 0); }
  if (mode === "monthly") { const m = Date.now() - 30 * 864e5; return txs.filter(t => t.studentId === sid && t.timestamp >= m).reduce((a, b) => a + b.amount, 0); }
  return getStudentById(sid)?.totalCoins || 0;
}
function sorted(mode) { return [...scopeStudents()].map(s => ({ ...s, score: byModeValue(s.id, mode) })).sort((a, b) => b.score - a.score); }
function rank(sid, mode) { const numSid = nNum(sid); return sorted(mode).findIndex(s => s.id === numSid) + 1; }

function canAttempt(key) {
  const now = Date.now();
  const st = authState[key] || { fails: 0, lockUntil: 0 };
  authState[key] = st;
  if (st.lockUntil > now) {
    const sec = Math.ceil((st.lockUntil - now) / 1000);
    toast(`Ko'p urinish. ${sec}s kuting.`, 'error');
    return false;
  }
  return true;
}
function markFail(key) {
  const st = authState[key] || { fails: 0, lockUntil: 0 };
  st.fails += 1;
  if (st.fails >= 5) { st.lockUntil = Date.now() + SECURITY_LOCK_MINUTES * 60 * 1000; st.fails = 0; }
  authState[key] = st;
}
function clearFail(key) { authState[key] = { fails: 0, lockUntil: 0 }; }

function mkDef() {
  teachers = [{ id: 1, name: "IT O'qituvchi", subject: "IT", group: "Barcha", password: genP("UST"), resetCode: genCode('TCH'), isMain: false }];
  admins = [{ id: 1, name: 'Super Admin', role: 'super', status: 'active', password: DEFAULT_SUPER_ADMIN_PASSWORD, adminCode: genCode('SPR'), linkedTeacherId: null, createdByAdminId: null, createdAt: Date.now() }];
  adminRequests = [];
  messages = [];
  telegramProfiles = {};
  students = [];
  let id = 1;
  const usedRef = new Set();
  const defaultStudents = [
    { name: 'Bahodirjonov Sardor', coins: 100, group: 'D2' },
    { name: 'Bahodirov Asadbek', coins: 0, group: 'D1' },
    { name: 'Farangiz', coins: 25, group: 'D1' },
    { name: 'Farxodjon 08', coins: 0, group: 'D1' },
    { name: 'Ibrohim', coins: 65, group: 'D1' },
    { name: 'Muhiddinov Nurillo', coins: 0, group: 'D1' },
    { name: 'Dadajonova Munavvara', coins: 15, group: 'D1' },
    { name: 'Og\'abek', coins: 0, group: 'D1' },
    { name: 'Omonov Alisher', coins: 50, group: 'D1' },
    { name: 'Shavkatova Fotima', coins: 50, group: 'D1' },
    { name: 'Shaxboz', coins: 25, group: 'D1' },
    { name: 'Tojaliyev G\'ayratjon', coins: 0, group: 'D1' },
    { name: 'Tolipjonov Asadbek', coins: 26, group: 'D1' },
    { name: 'Tursunaliyev Abdulaziz', coins: 5, group: 'D1' },
    { name: 'Umaraliyev Ozodbek', coins: 50, group: 'D1' },
    { name: 'Abdurazoqova Ra\'noxon', coins: 15, group: 'D1' },
    { name: 'Abdulhakimov Sardorbek', coins: 35, group: 'D1' },
    { name: 'Ahmadjonova Shodiyona', coins: 45, group: 'D1' },
    { name: 'Hamidov Abdulahat', coins: 24, group: 'D1' },
    { name: 'Abdumo\'minov Muhammadmuhtor', coins: 10, group: 'D1' },
    { name: 'Hoshimov Abdulhafiz', coins: 0, group: 'D1' },
    { name: 'Hasanboyev Muhamqodir', coins: 5, group: 'D1' },
    { name: 'Nurmuhamadov Diyorbek', coins: 10, group: 'D1' },
    { name: 'Mahamadov Ozodbek', coins: 5, group: 'D1' },
    { name: 'Shavkatov Abdulatif', coins: 5, group: 'D1' }
  ];
  for (const student of defaultStudents) {
    const curId = id++;
    const p = genP(student.name);
    const refCode = uniqueRefCode(curId, usedRef);
    usedRef.add(refCode);
    students.push({ id: curId, teacherId: 1, name: student.name, refCode, password: p, phone: '', totalCoins: student.coins, streak: 0, lastDailyDate: null, level: 1, badge: 'Starter', group: student.group });
  }
  nid = id; ntid = 2; naid = 2; nrid = 1; txs = [];
}

function normalizeData(d) {
  teachers = (Array.isArray(d?.teachers) ? d.teachers : []).map(t => ({ ...t, id: nNum(t.id), name: t.name || "O'qituvchi", subject: t.subject || "Fan", group: String(t.group || 'Barcha'), password: String(t.password || genP(t.name)), resetCode: String(t.resetCode || genCode('TCH')), isMain: false }));
  if (!teachers.length) { teachers = [{ id: 1, name: "IT O'qituvchi", subject: "IT", group: "Barcha", password: genP("UST"), resetCode: genCode('TCH'), isMain: false }]; }

  admins = (Array.isArray(d?.admins) ? d.admins : []).map(a => ({ ...a, id: nNum(a.id), name: a.name || 'Admin', role: (a.role === 'super' ? 'super' : 'admin'), status: (a.status === 'pending' ? 'pending' : 'active'), password: String(a.password || genP(a.name)), adminCode: String(a.adminCode || genCode('ADM')), linkedTeacherId: a.linkedTeacherId ? nNum(a.linkedTeacherId) : null, createdByAdminId: a.createdByAdminId ? nNum(a.createdByAdminId) : null, createdAt: nNum(a.createdAt) || Date.now() }));
  if (!admins.length) { const legacyPwd = String(d?.adminPassword || DEFAULT_SUPER_ADMIN_PASSWORD); admins = [{ id: 1, name: 'Super Admin', role: 'super', status: 'active', password: legacyPwd, adminCode: genCode('SPR'), linkedTeacherId: null, createdByAdminId: null, createdAt: Date.now() }]; }
  if (!admins.some(a => a.role === 'super')) { const max = Math.max(...admins.map(a => a.id), 0) + 1; admins.push({ id: max, name: 'Super Admin', role: 'super', status: 'active', password: DEFAULT_SUPER_ADMIN_PASSWORD, adminCode: genCode('SPR'), linkedTeacherId: null, createdByAdminId: null, createdAt: Date.now() }); }

  adminRequests = (Array.isArray(d?.adminRequests) ? d.adminRequests : []).map(r => ({ id: nNum(r.id), requesterAdminId: nNum(r.requesterAdminId), candidateAdminId: nNum(r.candidateAdminId), teacherName: r.teacherName || '', createdAt: nNum(r.createdAt) || Date.now(), status: 'pending' })).filter(r => r.candidateAdminId);

  const fallbackTeacherId = teachers[0].id;
  students = (Array.isArray(d?.students) ? d.students : []).map(s => ({ ...s, id: nNum(s.id), teacherId: nNum(s.teacherId) || fallbackTeacherId, phone: String(s.phone || ''), totalCoins: nNum(s.totalCoins) || 0, streak: nNum(s.streak) || 0, level: nNum(s.level) || 1, refCode: normRefCode(s.refCode), group: String(s.group || 'D1') }));
  const usedRef = new Set();
  students = students.map(s => { let ref = s.refCode; if (!ref || usedRef.has(ref)) { ref = uniqueRefCode(s.id, usedRef); } usedRef.add(ref); return { ...s, refCode: ref }; });
  messages = (Array.isArray(d?.messages) ? d.messages : []).map(m => {
    const toType = String(m.toType || '');
    return {
      id: m.id,
      fromType: String(m.fromType || ''),
      fromId: nNum(m.fromId),
      toType,
      toId: toType === 'group' ? String(m.toId || '') : nNum(m.toId),
      text: String(m.text || ''),
      timestamp: nNum(m.timestamp) || Date.now()
    };
  });
  telegramProfiles = (d && typeof d.telegramProfiles === 'object' && !Array.isArray(d.telegramProfiles)) ? d.telegramProfiles : {};
  txs = (Array.isArray(d?.transactions) ? d.transactions : []).map(t => ({ ...t, studentId: nNum(t.studentId), amount: nNum(t.amount) || 0, timestamp: nNum(t.timestamp) || Date.now(), teacherId: t.teacherId ? nNum(t.teacherId) : null, adminId: t.adminId ? nNum(t.adminId) : null }));

  nid = Math.max(nNum(d?.nextStudentId) || 1, (students.length ? Math.max(...students.map(s => s.id)) + 1 : 1));
  ntid = Math.max(nNum(d?.nextTeacherId) || 1, (teachers.length ? Math.max(...teachers.map(t => t.id)) + 1 : 1));
  naid = Math.max(nNum(d?.nextAdminId) || 1, (admins.length ? Math.max(...admins.map(a => a.id)) + 1 : 1));
  nrid = Math.max(nNum(d?.nextRequestId) || 1, (adminRequests.length ? Math.max(...adminRequests.map(r => r.id)) + 1 : 1));
  updBadges();
}

async function save() {
  const d = { students, transactions: txs, nextStudentId: nid, teachers, nextTeacherId: ntid, admins, nextAdminId: naid, adminRequests, nextRequestId: nrid, messages, telegramProfiles };
  try { await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); } catch (e) { }
  try { localStorage.setItem(SK, JSON.stringify(d)); } catch (e) { }
}
async function load() {
  try { const res = await fetch('/api/data'); if (res.ok) { const d = await res.json(); if (d && Array.isArray(d.students) && Array.isArray(d.transactions)) return d; } } catch (e) { }
  try { const r = localStorage.getItem(SK); if (r) return JSON.parse(r); } catch (e) { }
  return null;
}

function updBadges() { for (const s of students) { s.level = Math.max(1, ~~(s.totalCoins / 100) + 1); s.badge = s.totalCoins < 100 ? "Starter" : s.totalCoins < 300 ? "Active" : s.totalCoins < 600 ? "Pro" : "Elite"; } }
function updTeacherLoginOptions() {
  const tOps = teachers.map(t => `<option value="${t.id}">${escHtml(t.name)} (${escHtml(t.subject)}${t.group ? ` / ${escHtml(t.group)}` : ''})</option>`).join('');
  document.getElementById('sTeacherSel').innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  document.getElementById('tLoginSel').innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  document.getElementById('naTeacher').innerHTML = `<option value="">-- O'qituvchi --</option>${tOps}`;
  const fpTeacher = document.getElementById('fpTeacherSel');
  if (fpTeacher) fpTeacher.innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  const ftTeacher = document.getElementById('ftTeacherSel');
  if (ftTeacher) ftTeacher.innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  const regTeacher = document.getElementById('regTeacherSel');
  if (regTeacher) regTeacher.innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
}
function updAdminLoginOptions() {
  const opts = activeSubAdmins().map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
  const el = document.getElementById('aAdminSel');
  if (el) el.innerHTML = `<option value="">-- Admin tanlang --</option>${opts}`;
  const fa = document.getElementById('faAdminSel');
  if (fa) fa.innerHTML = `<option value="">-- Admin tanlang --</option>${opts}`;
}
function toggleAdminLoginType() {
  const type = document.getElementById('aLoginType').value;
  const showAdmin = (type === 'admin');
  document.getElementById('aAdminSelWrap').style.display = showAdmin ? 'block' : 'none';
  document.getElementById('aCodeWrap').style.display = showAdmin ? 'block' : 'none';
}
function updStudentLoginOptions() {
  const tid = nNum(document.getElementById('sTeacherSel').value);
  const list = students.filter(s => s.teacherId === tid);
  const o = list.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  document.getElementById('sLoginSel').innerHTML = `<option value="">-- Talaba tanlang --</option>${o}`;
}
function updForgotStudentOptions() {
  const teacherEl = document.getElementById('fpTeacherSel');
  const studentEl = document.getElementById('fpStudentSel');
  if (!teacherEl || !studentEl) return;
  const tid = nNum(teacherEl.value);
  const list = students.filter(s => s.teacherId === tid);
  const opts = list.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  studentEl.innerHTML = `<option value="">-- Talaba tanlang --</option>${opts}`;
}
function updSels() {
  const vis = manageStudents();
  const stOps = vis.map(s => `<option value="${s.id}">${escHtml(s.name)} (${s.totalCoins}🪙)</option>`).join('');
  ['aSt', 'hSt', 'pSt', 'rSt', 'mSt', 'dSt'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = stOps; });

  const nsTeacher = document.getElementById('nsTeacher');
  if (isAdmin()) {
    nsTeacher.style.display = 'block';
    nsTeacher.innerHTML = `<option value="">-- O'qituvchi --</option>` + teachers.map(t => `<option value="${t.id}">${escHtml(t.name)} (${escHtml(t.subject)}${t.group ? ` / ${escHtml(t.group)}` : ''})</option>`).join('');
  } else {
    nsTeacher.style.display = 'none';
    nsTeacher.innerHTML = '';
  }
}

function swTab(t) {
  document.getElementById('sLoginForm').style.display = t === 'student' ? 'block' : 'none';
  document.getElementById('tLoginForm').style.display = t === 'teacher' ? 'block' : 'none';
  document.getElementById('aLoginForm').style.display = t === 'admin' ? 'block' : 'none';
  document.getElementById('tabSBtn').classList.toggle('active', t === 'student');
  document.getElementById('tabTBtn').classList.toggle('active', t === 'teacher');
  document.getElementById('tabABtn').classList.toggle('active', t === 'admin');
}

function doSLogin() {
  if (!canAttempt('student')) return;
  const sid = nNum(document.getElementById('sLoginSel').value);
  const pwd = document.getElementById('sPwdIn').value;
  if (!sid) { toast('Talabani tanlang!', 'error'); return; }
  const s = getStudentById(sid);
  if (!s || s.password !== pwd) { markFail('student'); toast('Parol xato!', 'error'); return; }
  clearFail('student');
  curType = 'student'; curId = sid; curTeacherId = s.teacherId; curAdminId = null; enterS();
}
function doTLogin() {
  if (!canAttempt('teacher')) return;
  const tid = nNum(document.getElementById('tLoginSel').value);
  const pwd = document.getElementById('tPwdIn').value;
  const t = getTeacherById(tid);
  if (!t || t.password !== pwd) { markFail('teacher'); toast("O'qituvchi yoki parol xato", 'error'); return; }
  clearFail('teacher');
  curType = 'teacher'; curTeacherId = t.id; curId = null; curAdminId = null; enterT();
}
function doALogin() {
  if (!canAttempt('admin')) return;
  const type = document.getElementById('aLoginType').value;
  const pwd = document.getElementById('aPwdIn').value;
  if (type === 'super') {
    const s = getSuperAdmin();
    if (!s || s.password !== pwd) { markFail('admin'); toast('Super admin paroli xato!', 'error'); return; }
    clearFail('admin');
    curType = 'admin'; curAdminId = s.id; curId = null; curTeacherId = null; enterT();
    return;
  }
  const aid = nNum(document.getElementById('aAdminSel').value);
  const code = String(document.getElementById('aCodeIn').value || '').trim().toUpperCase();
  const a = getAdminById(aid);
  if (!a || a.role !== 'admin' || a.status !== 'active') { markFail('admin'); toast('Admin topilmadi yoki aktiv emas', 'error'); return; }
  if (a.password !== pwd || String(a.adminCode).toUpperCase() !== code) { markFail('admin'); toast('Maxsus kod yoki parol xato', 'error'); return; }
  clearFail('admin');
  curType = 'admin'; curAdminId = a.id; curId = null; curTeacherId = null; enterT();
}
function openTeacherForgotModal() {
  const ft = document.getElementById('ftTeacherSel');
  const tSel = document.getElementById('tLoginSel');
  if (ft && tSel && tSel.value) ft.value = tSel.value;
  ['ftCodeIn', 'ftNewIn', 'ftCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openModal('ftModal');
}
async function doTeacherForgotReset() {
  const tid = nNum(document.getElementById('ftTeacherSel')?.value);
  const code = String(document.getElementById('ftCodeIn')?.value || '').trim().toUpperCase();
  const np = String(document.getElementById('ftNewIn')?.value || '');
  const cp = String(document.getElementById('ftCnfIn')?.value || '');

  if (!tid) { toast("O'qituvchini tanlang", 'error'); return; }
  const t = getTeacherById(tid);
  if (!t) { toast("O'qituvchi topilmadi", 'error'); return; }
  if (!code) { toast("Maxsus kodni kiriting", 'error'); return; }
  if (String(t.resetCode || '').toUpperCase() !== code) { toast("Maxsus kod noto'g'ri", 'error'); return; }
  if (!validStrongPassword(np)) { toast('Yangi parol kuchsiz (kamida 8, katta-kichik harf va raqam)', 'error'); return; }
  if (np !== cp) { toast('Parollar mos emas', 'error'); return; }

  t.password = np;
  await save();
  closeModal('ftModal');
  const tLoginSel = document.getElementById('tLoginSel');
  if (tLoginSel) tLoginSel.value = String(tid);
  document.getElementById('tPwdIn').value = np;
  toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
}
function toggleAdminForgotType() {
  const type = document.getElementById('faTypeSel')?.value || 'super';
  const showAdmin = (type === 'admin');
  const adminWrap = document.getElementById('faAdminSelWrap');
  if (adminWrap) adminWrap.style.display = showAdmin ? 'block' : 'none';
}
function openAdminForgotModal() {
  const type = document.getElementById('aLoginType')?.value || 'super';
  const faType = document.getElementById('faTypeSel');
  if (faType) faType.value = type;
  const faAdmin = document.getElementById('faAdminSel');
  const aAdmin = document.getElementById('aAdminSel');
  if (faAdmin && aAdmin && aAdmin.value) faAdmin.value = aAdmin.value;
  toggleAdminForgotType();
  ['faCodeIn', 'faNewIn', 'faCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openModal('faModal');
}
async function doAdminForgotReset() {
  const type = document.getElementById('faTypeSel')?.value || 'super';
  const code = String(document.getElementById('faCodeIn')?.value || '').trim().toUpperCase();
  const np = String(document.getElementById('faNewIn')?.value || '');
  const cp = String(document.getElementById('faCnfIn')?.value || '');

  if (!code) { toast("Maxsus kodni kiriting", 'error'); return; }
  if (!validStrongPassword(np)) { toast('Yangi parol kuchsiz (kamida 8, katta-kichik harf va raqam)', 'error'); return; }
  if (np !== cp) { toast('Parollar mos emas', 'error'); return; }

  if (type === 'super') {
    const s = getSuperAdmin();
    if (!s) { toast('Super admin topilmadi', 'error'); return; }
    if (String(s.adminCode || '').toUpperCase() !== code) { toast("Super admin kodi noto'g'ri", 'error'); return; }
    s.password = np;
    await save();
    closeModal('faModal');
    const aType = document.getElementById('aLoginType');
    if (aType) { aType.value = 'super'; toggleAdminLoginType(); }
    document.getElementById('aPwdIn').value = np;
    toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
    return;
  }

  const aid = nNum(document.getElementById('faAdminSel')?.value);
  if (!aid) { toast('Adminni tanlang', 'error'); return; }
  const a = getAdminById(aid);
  if (!a || a.role !== 'admin' || a.status !== 'active') { toast('Admin topilmadi yoki aktiv emas', 'error'); return; }
  if (String(a.adminCode || '').toUpperCase() !== code) { toast("Admin kodi noto'g'ri", 'error'); return; }
  a.password = np;
  await save();
  closeModal('faModal');
  const aType = document.getElementById('aLoginType');
  if (aType) { aType.value = 'admin'; toggleAdminLoginType(); }
  const aSel = document.getElementById('aAdminSel');
  if (aSel) aSel.value = String(aid);
  document.getElementById('aCodeIn').value = code;
  document.getElementById('aPwdIn').value = np;
  toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
}
function openForgotPasswordModal() {
  const teacherEl = document.getElementById('fpTeacherSel');
  const sourceTeacher = document.getElementById('sTeacherSel');
  if (teacherEl && sourceTeacher && sourceTeacher.value) { teacherEl.value = sourceTeacher.value; }
  updForgotStudentOptions();
  ['fpRefIn', 'fpNewIn', 'fpCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openModal('fpModal');
}
async function doForgotPasswordReset() {
  const tid = nNum(document.getElementById('fpTeacherSel')?.value);
  const sid = nNum(document.getElementById('fpStudentSel')?.value);
  const ref = normRefCode(document.getElementById('fpRefIn')?.value);
  const np = String(document.getElementById('fpNewIn')?.value || '');
  const cp = String(document.getElementById('fpCnfIn')?.value || '');

  if (!tid || !sid) { toast("O'qituvchi va talabani tanlang", 'error'); return; }
  const s = getStudentById(sid);
  if (!s || s.teacherId !== tid) { toast("Talaba topilmadi", 'error'); return; }
  if (!ref) { toast("Referral kod kiriting", 'error'); return; }
  if (normRefCode(s.refCode) !== ref) { toast("Referral kod noto'g'ri", 'error'); return; }
  if (!validStrongPassword(np)) { toast('Yangi parol kuchsiz (kamida 8, katta-kichik harf va raqam)', 'error'); return; }
  if (np !== cp) { toast('Parollar mos emas', 'error'); return; }

  s.password = np;
  await save();
  closeModal('fpModal');
  const sTeacherSel = document.getElementById('sTeacherSel');
  const sLoginSel = document.getElementById('sLoginSel');
  if (sTeacherSel && sLoginSel) {
    sTeacherSel.value = String(tid);
    updStudentLoginOptions();
    sLoginSel.value = String(sid);
  }
  document.getElementById('sPwdIn').value = np;
  toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
}

function enterS() {
  const s = getStudentById(curId); if (!s) return;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('sbAv').textContent = s.name.slice(0, 2).toUpperCase();
  document.getElementById('sbNm').textContent = s.name;
  document.getElementById('sbRl').textContent = `${s.badge} · D${s.level}`;
  document.getElementById('sNav').style.display = '';
  document.getElementById('tNav').style.display = 'none';
  document.getElementById('tbRight').innerHTML = '';
  renderLb(); renderFLb(); renderHist(); renderProf();
  showPage('dpg', document.querySelector('#sNav .nav-item'));
  startAutoRefresh();
}
function enterT() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';

  if (curType === 'teacher') {
    const t = getTeacherById(curTeacherId);
    document.getElementById('sbAv').textContent = (t?.name || 'OQ').slice(0, 2).toUpperCase();
    document.getElementById('sbNm').textContent = t?.name || "O'qituvchi";
    document.getElementById('sbRl').textContent = t?.subject || "O'qituvchi";
  } else {
    const a = getAdminById(curAdminId);
    document.getElementById('sbAv').textContent = (a?.name || 'AD').slice(0, 2).toUpperCase();
    document.getElementById('sbNm').textContent = a?.name || 'Admin';
    document.getElementById('sbRl').textContent = isSuperAdmin() ? 'Super Admin' : 'Admin';
  }

  document.getElementById('sNav').style.display = 'none';
  document.getElementById('tNav').style.display = '';
  document.getElementById('tNavTeachers').style.display = isAdmin() ? '' : 'none';
  document.getElementById('tbRight').innerHTML = '';
  renderAD(); renderSTbl(); renderTeachersPage(); renderAdminTable(); renderAdminRequests(); renderTeacherProfilePage(); updSels();
  showPage('adpg', document.querySelector('#tNav .nav-item'));
  startAutoRefresh();
}
function doLogout() {
  stopAutoRefresh();
  curType = null; curId = null; curTeacherId = null; curAdminId = null;
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  ['sPwdIn', 'tPwdIn', 'aPwdIn', 'aCodeIn', 'fpRefIn', 'fpNewIn', 'fpCnfIn', 'ftCodeIn', 'ftNewIn', 'ftCnfIn', 'faCodeIn', 'faNewIn', 'faCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function startAutoRefresh() {
  stopAutoRefresh();
  _refreshTimer = setInterval(async () => {
    if (!curType) return;
    try {
      const d = await load(); if (!d) return;
      normalizeData(d);
      if (curType === 'student' && !getStudentById(curId)) { toast('Hisobingiz topilmadi.', 'error'); doLogout(); return; }
      if (curType === 'teacher' && !getTeacherById(curTeacherId)) { toast("O'qituvchi hisobi topilmadi.", 'error'); doLogout(); return; }
      if (curType === 'admin') { const a = getAdminById(curAdminId); if (!a || a.status !== 'active') { toast('Admin hisobi faol emas', 'error'); doLogout(); return; } }
      refreshCurrentPage();
      updTeacherLoginOptions(); updAdminLoginOptions(); updStudentLoginOptions(); updSels();
    } catch (e) { }
  }, 30000);
}
function stopAutoRefresh() { if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; } }

function refreshCurrentPage() {
  const activePage = document.querySelector('.page.active')?.id;
  if (activePage === 'dpg') renderSD();
  else if (activePage === 'rpg') { renderLb(); renderFLb(); }
  else if (activePage === 'hpg') renderHist();
  else if (activePage === 'ppg') renderProf();
  else if (activePage === 'adpg') renderAD();
  else if (activePage === 'stpg') renderSTbl();
  else if (activePage === 'tpg') { renderTeachersPage(); renderAdminTable(); renderAdminRequests(); }
  else if (activePage === 'tapg') renderTeacherProfilePage();
}

function showPage(pid, el) {
  if (pid === 'tpg' && !isAdmin()) { toast('Bu sahifa faqat adminlar uchun.', 'error'); return; }
  if (pid === 'tapg' && curType === 'student') { toast('Bu sahifa faqat o\'qituvchi/admin uchun.', 'error'); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pid)?.classList.add('active');
  const tmap = { dpg: 'Bosh sahifa', rpg: 'Reyting', hpg: 'Faollik tarixi', ppg: 'Profilim', adpg: 'Statistika', stpg: 'Talabalar', cpg: 'Tanga boshqaruvi', tpg: "O'qituvchilar va Adminlar", tapg: 'Profil va Xavfsizlik' };
  document.getElementById('tbTitle').textContent = tmap[pid] || '';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  if (pid === 'dpg') renderSD();
  if (pid === 'rpg') renderFLb();
  if (pid === 'hpg') renderHist();
  if (pid === 'ppg') renderProf();
  if (pid === 'stpg') renderSTbl();
  if (pid === 'adpg') renderAD();
  if (pid === 'tpg') { renderTeachersPage(); renderAdminTable(); renderAdminRequests(); }
  if (pid === 'tapg') renderTeacherProfilePage();
  if (pid === 'cpg') updSels();
  closeSB();
}
function renderSD() {
  if (!curId) return;
  const s = getStudentById(curId); if (!s) return;
  const peers = scopeStudents();
  document.getElementById('st_c').textContent = s.totalCoins;
  document.getElementById('st_l').textContent = s.level;
  document.getElementById('st_b').textContent = s.badge;
  document.getElementById('st_s').textContent = s.streak || 0;
  document.getElementById('st_r').textContent = `#${rank(curId, 'overall')}`;
  document.getElementById('st_rs').textContent = `${peers.length} talabadan`;
  const wk = byModeValue(curId, 'weekly');
  document.getElementById('wkf').style.width = Math.min(100, Math.max(0, wk)) + '%';
  document.getElementById('wkt').textContent = `${wk}/100`;
  const l7 = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); l7.push(txs.filter(t => t.studentId === curId && t.timestamp >= d.getTime() && t.timestamp < d.getTime() + 86400000).reduce((a, b) => a + b.amount, 0)); }
  const canvas = document.getElementById('wkChart');
  if (canvas && window.Chart) {
    const ctx = canvas.getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, { type: 'bar', data: { labels: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'Kecha', 'Bugun'], datasets: [{ label: 'Tanga', data: l7, backgroundColor: 'rgba(43,125,233,.6)', borderColor: '#2b7de9', borderWidth: 1, borderRadius: 5 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#4a5878', font: { size: 11 } } }, y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#4a5878', font: { size: 11 } } } } } });
  }
  const ut = txs.filter(t => t.studentId === curId).slice(0, 8);
  document.getElementById('actList').innerHTML = ut.length ? ut.map(t => `<div class="ai"><span class="at">${escHtml(t.details || 'Faollik')}</span><span class="ac">${t.amount >= 0 ? '+' : ''}${t.amount} 🪙</span></div>`).join('') : '<p style="color:var(--text-dim);text-align:center;padding:14px;font-size:13px;">Hozircha faollik yo\'q</p>';
  document.getElementById('tbRight').innerHTML = `<div class="top-badge tb-gold">🪙 ${s.totalCoins}</div><div class="top-badge tb-blue">🔥 ${s.streak || 0}</div>`;
}
function renderLb() { const s2 = sorted(lbM); document.getElementById('lbList').innerHTML = s2.slice(0, 10).map((s, i) => `<div class="lb-item ${s.id === curId ? 'me' : ''}"><div class="lb-rank">${medals[i] || i + 1}</div><div class="lb-name">${escHtml(s.name)}${s.id === curId ? ' <span style="font-size:10px;color:var(--blue-light)">(Siz)</span>' : ''}</div><div class="lb-score">${s.score}🪙</div></div>`).join(''); }
function setLb(mode, btn) { lbM = mode; document.querySelectorAll('.lb1').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderLb(); }
function renderFLb() { const s2 = sorted(lbM2); document.getElementById('flb').innerHTML = `<table style="width:100%"><thead><tr><th>#</th><th>Ism</th><th>Tanga</th><th>Daraja</th><th>Nishon</th></tr></thead><tbody>` + s2.map((s, i) => `<tr style="${s.id === curId ? 'background:rgba(43,125,233,.08);' : ''}"><td style="font-family:Rajdhani,sans-serif;font-weight:700;color:var(--text-muted);">${medals[i] || i + 1}</td><td style="font-weight:${s.id === curId ? 700 : 400};color:${s.id === curId ? 'var(--blue-light)' : 'var(--text)'};">${escHtml(s.name)}${s.id === curId ? ' ✓' : ''}</td><td style="font-family:Rajdhani,sans-serif;font-weight:700;color:var(--gold-mid);">${s.score}</td><td><span class="badge bb">D${s.level}</span></td><td><span class="badge bg">${s.badge}</span></td></tr>`).join('') + `</tbody></table>`; }
function setLb2(mode, btn) { lbM2 = mode; document.querySelectorAll('.lb2').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderFLb(); }
function renderHist() { if (!curId) return; const ut = txs.filter(t => t.studentId === curId); const c = document.getElementById('fhist'); if (!ut.length) { c.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">Faollik yo\'q</p>'; return; } c.innerHTML = ut.map(t => { const dt = new Date(t.timestamp).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }); return `<div class="ai"><div><div class="at">${escHtml(t.details || 'Faollik')}</div><div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${dt}</div></div><span class="ac">${t.amount >= 0 ? '+' : ''}${t.amount} 🪙</span></div>`; }).join(''); }
function renderProf() { if (!curId) return; const s = getStudentById(curId); if (!s) return; document.getElementById('pr_n').textContent = s.name; document.getElementById('pr_l').innerHTML = `<span class="badge bb">Daraja ${s.level}</span>`; document.getElementById('pr_b').innerHTML = `<span class="badge bg">${s.badge}</span>`; document.getElementById('pr_c').textContent = s.totalCoins + ' 🪙'; document.getElementById('pr_s').textContent = `🔥 ${s.streak || 0} kun`; document.getElementById('pr_w').textContent = byModeValue(curId, 'weekly') + ' 🪙'; document.getElementById('pr_m').textContent = byModeValue(curId, 'monthly') + ' 🪙'; document.getElementById('pr_r').textContent = `#${rank(curId, 'overall')} / ${scopeStudents().length}`; document.getElementById('pr_rc').textContent = s.refCode || `REF${s.id}`; document.getElementById('pr_phone').textContent = maskPhone(s.phone); document.getElementById('pr_group').textContent = s.group || getTeacherById(s.teacherId)?.group || 'D1'; document.getElementById('sbRl').textContent = `${s.badge} · D${s.level}`; if (document.getElementById('prNameEdit')) document.getElementById('prNameEdit').value = s.name; if (document.getElementById('prPhoneEdit')) document.getElementById('prPhoneEdit').value = s.phone || ''; renderTelegramLinkBox('pr', s); renderStudentChat(); }
function cpRef() { const c = el('pr_rc') ? el('pr_rc').textContent : ''; copyText(c).then(() => toast('Nusxalandi: ' + c, 'success')).catch(() => toast('Nusxalashda xato', 'error')); }

async function saveProfileInfo() {
  if (curType === 'student') {
    const s = getStudentById(curId); if (!s) return;
    const name = document.getElementById('prNameEdit')?.value.trim();
    const phone = String(document.getElementById('prPhoneEdit')?.value || '').trim();
    if (!name) { toast('Ismingizni kiriting', 'error'); return; }
    s.name = name; s.phone = phone;
    await save(); renderProf(); renderSTbl(); updStudentLoginOptions(); toast('Profil ma\'lumotlari saqlandi', 'success');
    return;
  }
  if (curType === 'teacher' || curType === 'admin') {
    const name = document.getElementById('tpNameEdit')?.value.trim();
    const group = document.getElementById('tpGroupEdit')?.value.trim();
    if (!name) { toast('Ismingizni kiriting', 'error'); return; }
    if (curType === 'teacher') {
      const t = getTeacherById(curTeacherId); if (!t) return;
      t.name = name; if (group) t.group = group;
      await save(); renderTeacherProfilePage(); renderTeachersPage(); updTeacherLoginOptions(); toast('Profil ma\'lumotlari saqlandi', 'success');
      return;
    }
    const a = getAdminById(curAdminId); if (!a) return;
    a.name = name;
    await save(); renderTeacherProfilePage(); renderAdminTable(); updAdminLoginOptions(); toast('Profil ma\'lumotlari saqlandi', 'success');
    return;
  }
  toast('Avval tizimga kiring', 'error');
}

function formatChatMessage(m, currentType, currentId) {
  const fromLabel = m.fromType === 'student' ? 'Talaba' : m.fromType === 'teacher' ? 'O\'qituvchi' : m.fromType === 'admin' ? 'Admin' : escHtml(m.fromType);
  const isMine = m.fromType === currentType && nNum(m.fromId) === nNum(currentId);
  return `<div style="margin-bottom:10px;text-align:${isMine ? 'right' : 'left'}"><div style="display:inline-block;padding:10px;border-radius:12px;background:${isMine ? 'rgba(43,125,233,.9)' : 'rgba(255,255,255,.08)'};color:${isMine ? '#fff' : '#e6eafc'};max-width:85%;line-height:1.4;"><strong style="font-size:12px;display:block;margin-bottom:4px;">${escHtml(fromLabel)}</strong>${escHtml(m.text)}<div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,.65);">${new Date(m.timestamp).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div></div></div>`;
}

function renderStudentChat() {
  if (curType !== 'student') return;
  const s = getStudentById(curId); if (!s) return;
  const msgs = messages.filter(m => {
    if (m.fromType !== 'teacher' && m.fromType !== 'admin') return false;
    if (m.toType === 'student' && nNum(m.toId) === s.id) return true;
    if (m.toType === 'group' && String(m.toId) === String(s.group)) return true;
    if (m.toType === 'all') return true;
    return false;
  }).sort((a, b) => a.timestamp - b.timestamp);
  const box = document.getElementById('studentChatBox'); if (!box) return;
  box.innerHTML = msgs.length ? msgs.map(m => formatChatMessage(m, 'student', s.id)).join('') : '<p style="color:var(--text-dim);padding:12px;">O\'qituvchingizdan xabar yo\'q. Guruh va umumiy xabarlarni tekshiring.</p>';
}

function syncTeacherChatControls() {
  const mode = document.getElementById('tpChatMode')?.value;
  const groupSel = document.getElementById('tpChatGroupSel');
  const studentSel = document.getElementById('tpChatStudentSel');
  if (!groupSel || !studentSel) return;
  groupSel.style.display = mode === 'group' ? '' : 'none';
  studentSel.style.display = mode === 'student' ? '' : 'none';
}

function updateTeacherChatSelect() {
  const studentSel = document.getElementById('tpChatStudentSel');
  const groupSel = document.getElementById('tpChatGroupSel');
  const modeSel = document.getElementById('tpChatMode');
  if (!studentSel || !groupSel || !modeSel) return;
  const list = manageStudents();
  studentSel.innerHTML = list.length ? list.map(s => `<option value="${s.id}">${escHtml(s.name)}${s.group ? ` / ${escHtml(s.group)}` : ''}</option>`).join('') : '<option value="">Talabalar yo\'q</option>';
  const groupNames = Array.from(new Set(list.map(s => String(s.group || '')))).filter(g => g);
  if (curType === 'teacher') {
    const teacher = getTeacherById(curTeacherId);
    if (teacher && teacher.group && !groupNames.includes(teacher.group)) groupNames.unshift(teacher.group);
  }
  groupSel.innerHTML = groupNames.length ? groupNames.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('') : '<option value="">Guruh yo\'q</option>';
  syncTeacherChatControls();
}

function renderTeacherChat() {
  const mode = document.getElementById('tpChatMode')?.value || 'all';
  const studentSel = document.getElementById('tpChatStudentSel');
  const groupSel = document.getElementById('tpChatGroupSel');
  const box = document.getElementById('teacherChatBox');
  if (!studentSel || !groupSel || !box) return;
  const senderType = curType === 'admin' ? 'admin' : 'teacher';
  const senderId = curType === 'admin' ? curAdminId : curTeacherId;
  let targetLabel = 'Barcha talabalar';
  let msgs = [];
  if (mode === 'student') {
    const sid = nNum(studentSel.value) || manageStudents()[0]?.id;
    if (!sid) { box.innerHTML = '<p style="color:var(--text-dim);padding:12px;">Talaba tanlang</p>'; return; }
    studentSel.value = sid;
    const s = getStudentById(sid);
    if (!s) { box.innerHTML = '<p style="color:var(--text-dim);padding:12px;">Talaba topilmadi</p>'; return; }
    targetLabel = `${escHtml(s.name)}`;
    msgs = messages.filter(m => m.fromType === senderType && nNum(m.fromId) === senderId && m.toType === 'student' && nNum(m.toId) === s.id);
  } else if (mode === 'group') {
    const group = String(groupSel.value || getTeacherById(curTeacherId)?.group || '');
    if (!group) { box.innerHTML = '<p style="color:var(--text-dim);padding:12px;">Guruh tanlang</p>'; return; }
    targetLabel = `Guruh: ${escHtml(group)}`;
    msgs = messages.filter(m => m.fromType === senderType && nNum(m.fromId) === senderId && m.toType === 'group' && String(m.toId) === group);
  } else {
    msgs = messages.filter(m => m.fromType === senderType && nNum(m.fromId) === senderId && m.toType === 'all');
  }
  box.innerHTML = `<div style="margin-bottom:12px;color:var(--text-dim);font-size:13px;">${targetLabel}</div>` + (msgs.length ? msgs.map(m => formatChatMessage(m, senderType, senderId)).join('') : '<p style="color:var(--text-dim);padding:12px;">Xabar yo\'q. Yangi xabar yuboring.</p>');
}

async function sendStudentMessage() {
  toast('Faqat o\'qituvchilar xabar yuborishi mumkin.', 'error');
}

async function sendTeacherMessage() {
  if (!isTeacherMode()) { toast('Faqat o\'qituvchi yoki admin xabar yuborishi mumkin.', 'error'); return; }
  const mode = document.getElementById('tpChatMode')?.value || 'all';
  const text = document.getElementById('tpMsgText').value.trim();
  if (!text) { toast('Xabar yozing', 'error'); return; }
  const senderType = curType === 'admin' ? 'admin' : 'teacher';
  const senderId = curType === 'admin' ? curAdminId : curTeacherId;
  let messageRecord = null;
  if (mode === 'student') {
    const sel = document.getElementById('tpChatStudentSel'); if (!sel) return;
    const sid = nNum(sel.value);
    const s = getStudentById(sid);
    if (!s) { toast('Talaba tanlang', 'error'); return; }
    messageRecord = { toType: 'student', toId: s.id };
  } else if (mode === 'group') {
    const sel = document.getElementById('tpChatGroupSel'); if (!sel) return;
    const group = String(sel.value || getTeacherById(curTeacherId)?.group || '');
    if (!group) { toast('Guruh tanlang', 'error'); return; }
    messageRecord = { toType: 'group', toId: group };
  } else {
    messageRecord = { toType: 'all', toId: 0 };
  }
  messages.push({ id: Date.now() + Math.random(), fromType: senderType, fromId: senderId, text, timestamp: Date.now(), ...messageRecord });
  await save(); document.getElementById('tpMsgText').value = ''; renderTeacherChat(); toast('Xabar yuborildi', 'success');
}

function renderAD() {
  const vis = manageStudents();
  const visSet = new Set(vis.map(s => s.id));
  const tc = txs.filter(t => visSet.has(t.studentId)).reduce((a, b) => a + b.amount, 0);
  const ac = vis.filter(s => s.lastDailyDate && ((new Date() - new Date(s.lastDailyDate)) / 864e5 <= 7)).length;
  const rc = txs.filter(t => t.reason === 'referral' && visSet.has(t.studentId)).length;
  document.getElementById('ad_t').textContent = vis.length;
  document.getElementById('ad_c').textContent = tc;
  document.getElementById('ad_a').textContent = ac;
  document.getElementById('ad_r').textContent = rc;
  const ranked = sorted('overall');
  document.getElementById('atop').innerHTML = ranked.slice(0, 18).map((s, i) => `<div class="lb-item"><div class="lb-rank">${medals[i] || i + 1}</div><div class="lb-name">${escHtml(s.name)}</div><div class="lb-score">${s.totalCoins}🪙</div></div>`).join('');
  document.getElementById('adRankList').innerHTML = ranked.length ? `<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">#</th><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">Ism</th><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">Guruh</th><th style="text-align:right;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">Tanga</th></tr></thead><tbody>${ranked.map((s, i) => `<tr style="border-bottom:1px solid rgba(255,255,255,.05);"><td style="padding:8px;">${i + 1}</td><td style="padding:8px;">${escHtml(s.name)}</td><td style="padding:8px;">${escHtml(s.group || getTeacherById(s.teacherId)?.group || 'D1')}</td><td style="padding:8px;text-align:right;">${s.totalCoins} 🪙</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--text-dim);">Talabalar roʻyxati yoʻq</p>';
  if (curType === 'admin') { const me = getAdminById(curAdminId); if (me) { const el = document.getElementById('adSelfPass'); el.dataset.real = me.password; el.textContent = '******'; el.dataset.visible = '0'; } }
  else if (curType === 'teacher') { const me = getTeacherById(curTeacherId); if (me) { const el = document.getElementById('adSelfPass'); el.dataset.real = me.password; el.textContent = '******'; el.dataset.visible = '0'; } }
}

function renderSTbl() {
  const vis = manageStudents();
  let h = '';
  vis.forEach((s, i) => { const t = getTeacherById(s.teacherId); h += `<tr><td>${i + 1}</td><td style="font-weight:600;">${escHtml(s.name)}</td><td>${escHtml(t?.name || '-')}</td><td style="font-family:Rajdhani,sans-serif;font-weight:700;color:var(--gold-mid);">${s.totalCoins}</td><td><span class="badge bb">D${s.level}</span></td><td><code class="pwd-mask" data-real="${escHtml(s.password)}">******</code> <button onclick="toggleRowPassword(this)" class="btn btn-outline btn-sm" style="padding:3px 7px;margin-left:4px;"><i class="fas fa-eye"></i></button></td><td><button onclick="resetStudentPwd(${s.id})" class="btn btn-outline btn-sm" title="Parolni qayta yaratish"><i class="fas fa-key"></i></button> <button onclick="delSt(${s.id})" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button></td></tr>`; });
  document.getElementById('stBody').innerHTML = h || '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:18px;">Talabalar yo\'q</td></tr>';
  renderNewStudents();
}
function renderNewStudents() { const list = manageStudents().slice().sort((a, b) => b.id - a.id).slice(0, 5); const container = document.getElementById('newStudentsList'); if (!container) return; if (!list.length) { container.innerHTML = '<p style="color:var(--text-dim);text-align:center;">Yangi talaba yo\'q</p>'; return; } container.innerHTML = list.map(s => { const t = getTeacherById(s.teacherId); return `<div class="ai" style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);"><div><div class="lb-name" style="font-weight:600;">${escHtml(s.name)}</div><div style="font-size:12px;color:var(--text-dim);">${escHtml(t?.name || '')}${t?.group ? ` / ${escHtml(t.group)}` : ''}</div></div><span class="ac">${s.totalCoins}🪙</span></div>`; }).join(''); }
async function resetStudentPwd(id) {
  const s = getStudentById(id);
  if (!s) { toast('Talaba topilmadi!', 'error'); return; }
  if (!canManageStudent(s)) { toast("Bu talabaga amalingiz yo'q", 'error'); return; }
  const p = genP(s.name);
  s.password = p;
  await save();
  renderSTbl();
  renderTeacherProfilePage();
  updStudentLoginOptions();
  toast(`${s.name} uchun yangi parol: ${p}`, 'success');
}

function renderTeacherProfilePage() {
  if (curType === 'student') return;
  let role = '-', name = '-', code = '-', pwd = '';
  let myStudents = [];
  if (curType === 'teacher') {
    const t = getTeacherById(curTeacherId); if (!t) return;
    role = "O'qituvchi"; name = t.name; pwd = t.password;
    code = t.resetCode || '-';
    myStudents = students.filter(s => s.teacherId === t.id);
  } else {
    const a = getAdminById(curAdminId); if (!a) return;
    role = adminLabel(a); name = a.name; pwd = a.password; code = a.adminCode;
    myStudents = isSuperAdmin() ? students : students.filter(s => s.teacherId === a.linkedTeacherId);
  }
  document.getElementById('tp_role').textContent = role;
  document.getElementById('tp_name').textContent = name;
  document.getElementById('tp_code').textContent = code;
  const pEl = document.getElementById('tp_pwd'); pEl.dataset.real = pwd; pEl.textContent = '******'; pEl.dataset.visible = '0';
  if (document.getElementById('tpNameEdit')) document.getElementById('tpNameEdit').value = name;
  if (document.getElementById('tpGroupEdit')) document.getElementById('tpGroupEdit').value = curType === 'teacher' ? getTeacherById(curTeacherId)?.group || '' : '';
  renderTelegramLinkBox('tp', curType === 'teacher' ? getTeacherById(curTeacherId) : getAdminById(curAdminId));
  const tbody = document.getElementById('tpStudentsBody');
  tbody.innerHTML = myStudents.length ? myStudents.map((s, i) => { const studentGroup = escHtml(s.group || getTeacherById(s.teacherId)?.group || 'D1'); return `<tr><td>${i + 1}</td><td>${escHtml(s.name)}</td><td>${studentGroup}</td><td><code class="pwd-mask" data-real="${escHtml(s.password)}">******</code> <button onclick="toggleRowPassword(this)" class="btn btn-outline btn-sm" style="padding:3px 7px;"><i class="fas fa-eye"></i></button></td></tr>`; }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:18px;">Talabalar yo\'q</td></tr>';
  updateTeacherChatSelect(); renderTeacherChat();
}

async function addSt() {
  if (!isTeacherMode()) { toast("Ruxsat yo'q", 'error'); return; }
  const n = document.getElementById('nsName').value.trim(); if (!n) { toast('Ism kiriting!', 'error'); return; }
  const phone = String(document.getElementById('nsPhone').value || '').trim();
  const teacherId = (curType === 'admin') ? nNum(document.getElementById('nsTeacher').value) : curTeacherId;
  const group = String(document.getElementById('nsGroup').value || '').trim().toUpperCase() || getTeacherById(teacherId)?.group || 'D1';
  const paid = document.getElementById('nsPaid')?.checked;
  const refInput = normRefCode(document.getElementById('nsRef').value);
  if (!teacherId || !getTeacherById(teacherId)) { toast("O'qituvchini tanlang!", 'error'); return; }
  let inviter = null;
  if (refInput) { inviter = students.find(s => normRefCode(s.refCode) === refInput && s.teacherId === teacherId); if (!inviter) { toast("Referral kod noto'g'ri yoki shu o'qituvchiga tegishli emas", 'error'); return; } }
  const id = nid++; const p = genP(n);
  const usedRef = new Set(students.map(s => normRefCode(s.refCode)));
  const myRef = uniqueRefCode(id, usedRef);
  const newStudent = { id, teacherId, name: n, refCode: myRef, password: p, phone, group: group || getTeacherById(teacherId)?.group || 'D1', totalCoins: 0, streak: 0, lastDailyDate: null, level: 1, badge: 'Starter' };
  if (paid) {
    newStudent.totalCoins = 15;
    txs.unshift({ id: Date.now() + Math.random(), studentId: id, teacherId, adminId: (curType === 'admin' ? curAdminId : null), amount: 15, reason: 'payment', timestamp: Date.now(), details: 'To\'lov qilingan, 15 tanga' });
  }
  students.push(newStudent);
  await save();
  if (inviter) await addCoin(inviter.id, 15, 'referral', `${n} qo'shilgani uchun referral bonus`);
  if (phone) {
    sendSmsNotification(phone, `Salom ${n}! Siz ${getTeacherById(teacherId)?.name || "o'qituvchi"} guruhiga muvaffaqiyatli yozildingiz. Parolingiz: ${p}`);
  }
  document.getElementById('nsName').value = ''; document.getElementById('nsPhone').value = ''; document.getElementById('nsGroup').value = ''; document.getElementById('nsRef').value = ''; if (document.getElementById('nsPaid')) document.getElementById('nsPaid').checked = false;
  renderSTbl(); updSels(); renderAD(); updStudentLoginOptions(); renderTeacherProfilePage();
  toast(`${n} qo'shildi! Talaba paroli: ${p}`, 'success');
}
async function delSt(id) {
  if (!confirm("O'chirilsinmi?")) return;
  const numId = nNum(id); const s = getStudentById(numId); if (!canManageStudent(s)) { toast("Ruxsat yo'q", 'error'); return; }
  students = students.filter(x => x.id !== numId); txs = txs.filter(t => t.studentId !== numId);
  await save(); renderSTbl(); renderAD(); updSels(); updStudentLoginOptions(); renderTeacherProfilePage(); toast("O'chirildi", 'success');
}

async function addCoin(sid, amt, reason, details) {
  const numSid = nNum(sid); const amount = nNum(amt); const s = getStudentById(numSid);
  if (!s) { toast('Talaba topilmadi!', 'error'); return false; }
  if (!canManageStudent(s)) { toast("Bu talabaga amalingiz yo'q", 'error'); return false; }
  if (!Number.isFinite(amount) || amount === 0) { toast("Noto'g'ri miqdor", 'error'); return false; }
  s.totalCoins += amount;
  if (amount > 0) { const td = new Date().toDateString(); if (s.lastDailyDate !== td) { s.streak = (s.streak || 0) + 1; s.lastDailyDate = td; } }
  txs.unshift({ id: Date.now() + Math.random(), studentId: numSid, teacherId: (curType === 'teacher' ? curTeacherId : null), adminId: (curType === 'admin' ? curAdminId : null), amount, reason, timestamp: Date.now(), details: details || `${reason} ${amount}` });
  updBadges(); await save(); return true;
}
async function giveC(reason, selId, rangeId, label) { const sid = nNum(document.getElementById(selId).value); const amt = parseInt(document.getElementById(rangeId).value, 10); if (!sid) { toast('Talabani tanlang!', 'error'); return; } const ok = await addCoin(sid, amt, reason, `${label} uchun ${amt} tanga`); if (!ok) return; renderAD(); updSels(); renderTeacherProfilePage(); toast(`${getStudentById(sid)?.name || 'Talaba'}ga ${amt} tanga berildi!`, 'success'); }
async function giveManual() { const sid = nNum(document.getElementById('mSt').value); const amt = parseInt(document.getElementById('mAmt').value, 10); const r = document.getElementById('mReason').value.trim(); if (!sid || !amt || !r) { toast("To'liq ma'lumot kiriting", 'error'); return; } const ok = await addCoin(sid, amt, 'manual_plus', r); if (!ok) return; renderAD(); updSels(); renderTeacherProfilePage(); document.getElementById('mAmt').value = ''; document.getElementById('mReason').value = ''; toast(`${getStudentById(sid)?.name || 'Talaba'}ga ${amt} tanga berildi!`, 'success'); }
async function deductManual() { const sid = nNum(document.getElementById('dSt').value); const amt = parseInt(document.getElementById('dAmt').value, 10); const r = document.getElementById('dReason').value.trim(); if (!sid || !amt || !r) { toast("To'liq ma'lumot kiriting", 'error'); return; } const ok = await addCoin(sid, -Math.abs(amt), 'manual_minus', `Ayrildi: ${r}`); if (!ok) return; renderAD(); updSels(); renderTeacherProfilePage(); document.getElementById('dAmt').value = ''; document.getElementById('dReason').value = ''; toast(`${getStudentById(sid)?.name || 'Talaba'}dan ${Math.abs(amt)} tanga ayirildi!`, 'success'); }
async function monthlyBonus() { const vis = manageStudents(); if (!vis.length) { toast("Talaba topilmadi", 'error'); return; } const visSet = new Set(vis.map(s => s.id)); const ms = Date.now() - 30 * 864e5; const top = [...vis].map(s => ({ ...s, earn: txs.filter(t => t.studentId === s.id && t.timestamp >= ms && visSet.has(t.studentId)).reduce((a, b) => a + b.amount, 0) })).sort((a, b) => b.earn - a.earn)[0]; if (!top) { toast("Talaba topilmadi", 'error'); return; } const ok = await addCoin(top.id, 50, 'monthly_bonus', 'Oylik eng yaxshi talaba bonusi'); if (!ok) return; renderAD(); updSels(); renderTeacherProfilePage(); toast(`${top.name}ga 50 tanga sovg'a!`, 'success'); }
async function chgTPwd() {
  if (curType === 'teacher') {
    const t = getTeacherById(curTeacherId); if (!t) return;
    const old = prompt("Joriy o'qituvchi paroli:"); if (old === null) return; if (old !== t.password) { toast('Joriy parol xato!', 'error'); return; }
    const np = prompt("Yangi o'qituvchi paroli (kamida 8, harf+raqam):"); if (np === null) return; if (!validStrongPassword(np)) { toast('Parol kuchsiz', 'error'); return; }
    t.password = np; await save(); renderTeacherProfilePage(); renderAD(); toast("O'qituvchi paroli yangilandi!", 'success');
    return;
  }
  if (curType === 'admin') {
    const a = getAdminById(curAdminId); if (!a) return;
    const old = prompt("Joriy parol:"); if (old === null) return; if (old !== a.password) { toast('Joriy parol xato!', 'error'); return; }
    const np = prompt("Yangi parol (kamida 8, harf+raqam):"); if (np === null) return; if (!validStrongPassword(np)) { toast('Parol kuchsiz', 'error'); return; }
    a.password = np; await save(); renderTeacherProfilePage(); renderAD(); toast("Parol yangilandi!", 'success');
    return;
  }
  toast("Avval o'qituvchi/admin sifatida kiring", 'error');
}

async function doChgPwd() {
  const s = getStudentById(curId); if (!s) { toast('Foydalanuvchi topilmadi!', 'error'); return; }
  const o = document.getElementById('oldP').value, n = document.getElementById('newP').value, c = document.getElementById('cnfP').value;
  if (o !== s.password) { toast('Eski parol xato!', 'error'); return; }
  if (!validStrongPassword(n)) { toast('Parol kuchsiz (kamida 8, harf+raqam)', 'error'); return; }
  if (n !== c) { toast('Parollar mos emas', 'error'); return; }
  s.password = n; await save(); closeModal('cpModal'); toast('Parol yangilandi!', 'success');['oldP', 'newP', 'cnfP'].forEach(id => document.getElementById(id).value = '');
}

async function addTeacher() {
  if (!isAdmin()) { toast("Faqat admin qo'sha oladi", 'error'); return; }
  const n = document.getElementById('ntName').value.trim(); const sub = document.getElementById('ntSubj').value.trim(); const group = document.getElementById('ntGroup').value.trim();
  if (!n || !sub) { toast("Ism va fan kiriting", 'error'); return; }
  const p = genP(n); teachers.push({ id: ntid++, name: n, subject: sub, group: group || 'Barcha', password: p, resetCode: genCode('TCH'), isMain: false });
  await save(); document.getElementById('ntName').value = ''; document.getElementById('ntSubj').value = ''; document.getElementById('ntGroup').value = '';
  renderTeachersPage(); updTeacherLoginOptions(); updSels(); toast(`${n} qo'shildi. O'qituvchi paroli: ${p}`, 'success');
}
async function resetTeacherPwd(id) { if (!isAdmin()) { toast("Faqat admin", 'error'); return; } const t = getTeacherById(id); if (!t) { toast("O'qituvchi topilmadi", 'error'); return; } const p = genP(t.name); t.password = p; await save(); renderTeacherProfilePage(); toast(`${t.name} yangi parol: ${p}`, 'success'); }
async function delTeacher(id) { if (!isSuperAdmin()) { toast("Faqat super admin o'chira oladi", 'error'); return; } const t = getTeacherById(id); if (!t) { toast("O'qituvchi topilmadi", 'error'); return; } if (students.some(s => s.teacherId === t.id)) { toast("Avval shu o'qituvchining talabalarini o'tkazing", 'error'); return; } if (admins.some(a => a.linkedTeacherId === t.id && a.status === 'active')) { toast("Bu o'qituvchiga bog'langan admin bor", 'error'); return; } if (!confirm("O'qituvchi o'chirilsinmi?")) return; teachers = teachers.filter(x => x.id !== t.id); await save(); renderTeachersPage(); updTeacherLoginOptions(); updSels(); toast("O'qituvchi o'chirildi", 'success'); }

function createAdminRecord({ name, password, linkedTeacherId, role = 'admin', status = 'active', createdByAdminId }) { return { id: naid++, name, role, status, password, adminCode: genCode('ADM'), linkedTeacherId: linkedTeacherId ? nNum(linkedTeacherId) : null, createdByAdminId: createdByAdminId || null, createdAt: Date.now() }; }

async function submitAdminAction() {
  if (!isAdmin()) { toast("Faqat admin", 'error'); return; }
  const name = document.getElementById('naName').value.trim();
  const pwd = document.getElementById('naPwd').value;
  const linkedTeacherId = nNum(document.getElementById('naTeacher').value);
  if (!name || !pwd || !linkedTeacherId) { toast("Ism, parol va o'qituvchi tanlang", 'error'); return; }
  if (!validStrongPassword(pwd)) { toast("Parol kuchsiz (kamida 8, harf+raqam)", 'error'); return; }
  if (activeAdmins().some(a => a.name.toLowerCase() === name.toLowerCase())) { toast("Bu nomdagi admin bor", 'error'); return; }
  const t = getTeacherById(linkedTeacherId); if (!t) { toast("O'qituvchi topilmadi", 'error'); return; }

  if (isSuperAdmin()) {
    admins.push(createAdminRecord({ name, password: pwd, linkedTeacherId, role: 'admin', status: 'active', createdByAdminId: curAdminId }));
    await save();
    toast(`${name} admin sifatida qo'shildi`, 'success');
  } else {
    const candidate = createAdminRecord({ name, password: pwd, linkedTeacherId, role: 'admin', status: 'pending', createdByAdminId: curAdminId });
    admins.push(candidate);
    adminRequests.push({ id: nrid++, requesterAdminId: curAdminId, candidateAdminId: candidate.id, teacherName: t.name, createdAt: Date.now(), status: 'pending' });
    await save();
    toast(`So'rov super adminga yuborildi`, 'success');
  }

  document.getElementById('naName').value = ''; document.getElementById('naPwd').value = ''; document.getElementById('naTeacher').value = '';
  renderAdminTable(); renderAdminRequests(); renderTeacherProfilePage(); updAdminLoginOptions();
}
async function approveAdminRequest(id) { if (!isSuperAdmin()) { toast("Faqat super admin", 'error'); return; } const req = adminRequests.find(r => r.id === nNum(id)); if (!req) { toast("So'rov topilmadi", 'error'); return; } const cand = getAdminById(req.candidateAdminId); if (!cand) { adminRequests = adminRequests.filter(r => r.id !== req.id); await save(); renderAdminRequests(); return; } cand.status = 'active'; adminRequests = adminRequests.filter(r => r.id !== req.id); await save(); renderAdminTable(); renderAdminRequests(); updAdminLoginOptions(); toast(`${cand.name} tasdiqlandi`, 'success'); }
async function rejectAdminRequest(id) { if (!isSuperAdmin()) { toast("Faqat super admin", 'error'); return; } const req = adminRequests.find(r => r.id === nNum(id)); if (!req) { toast("So'rov topilmadi", 'error'); return; } admins = admins.filter(a => a.id !== req.candidateAdminId); adminRequests = adminRequests.filter(r => r.id !== req.id); await save(); renderAdminTable(); renderAdminRequests(); updAdminLoginOptions(); toast(`So'rov rad etildi`, 'success'); }
async function disableAdmin(id) { if (!isSuperAdmin()) { toast("Faqat super admin", 'error'); return; } const a = getAdminById(id); if (!a || a.role === 'super') { toast("Bu adminni o'chirib bo'lmaydi", 'error'); return; } if (!confirm("Adminlikdan chiqarilsinmi?")) return; admins = admins.filter(x => x.id !== a.id); adminRequests = adminRequests.filter(r => r.requesterAdminId !== a.id && r.candidateAdminId !== a.id); await save(); renderAdminTable(); renderAdminRequests(); updAdminLoginOptions(); toast(`${a.name} adminlikdan chiqarildi`, 'success'); }

function renderAdminTable() {
  const body = document.getElementById('adminBody'); if (!body) return;
  const rows = admins.filter(a => a.role !== 'super').map((a, i) => { const t = getTeacherById(a.linkedTeacherId); const act = isSuperAdmin() ? `<button class="btn btn-danger btn-sm" onclick="disableAdmin(${a.id})"><i class="fas fa-user-slash"></i></button>` : '-'; return `<tr><td>${i + 1}</td><td>${escHtml(a.name)}</td><td>${escHtml(t?.name || '-')}</td><td>${adminLabel(a)}</td><td><span class="badge ${a.status === 'active' ? 'bgg' : 'bg'}">${a.status === 'active' ? 'Aktiv' : 'Kutilmoqda'}</span></td><td>${act}</td></tr>`; }).join('');
  body.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:18px;">Adminlar yo\'q</td></tr>';
}
function renderAdminRequests() {
  const card = document.getElementById('reqCard'); const body = document.getElementById('reqBody'); if (!card || !body) return;
  if (!isSuperAdmin()) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const rows = adminRequests.map((r, i) => { const requester = getAdminById(r.requesterAdminId); const cand = getAdminById(r.candidateAdminId); const created = new Date(r.createdAt).toLocaleString('uz-UZ'); const teacher = getTeacherById(cand?.linkedTeacherId); return `<tr><td>${i + 1}</td><td>${escHtml(requester?.name || '-')}</td><td>${escHtml(cand?.name || '-')}</td><td>${escHtml(teacher?.name || r.teacherName || '-')}</td><td>${created}</td><td><button class="btn btn-success btn-sm" onclick="approveAdminRequest(${r.id})">Tasdiqlash</button> <button class="btn btn-danger btn-sm" onclick="rejectAdminRequest(${r.id})">Rad etish</button></td></tr>`; }).join('');
  body.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:18px;">So\'rovlar yo\'q</td></tr>';
}
function renderTeachersPage() {
  const el = document.getElementById('tBody'); if (!el) return;
  if (!isAdmin()) { el.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:18px;">Faqat admin ko\'ra oladi</td></tr>'; return; }
  const rows = teachers.map((t, i) => { const cnt = students.filter(s => s.teacherId === t.id).length; const act = isSuperAdmin() ? `<button class="btn btn-outline btn-sm" onclick="resetTeacherPwd(${t.id})"><i class="fas fa-key"></i></button> <button class="btn btn-danger btn-sm" onclick="delTeacher(${t.id})"><i class="fas fa-trash"></i></button>` : `<button class="btn btn-outline btn-sm" onclick="resetTeacherPwd(${t.id})"><i class="fas fa-key"></i></button>`; return `<tr><td>${i + 1}</td><td style="font-weight:600;">${escHtml(t.name)}</td><td>${escHtml(t.subject)}${t.group ? ` / ${escHtml(t.group)}` : ''}</td><td>${cnt}</td><td>${act}</td></tr>`; }).join('');
  el.innerHTML = rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:18px;">O\'qituvchilar yo\'q</td></tr>';
}

function toggleSelfPassword(elId, key) { const el = document.getElementById(elId); if (!el) return; const visible = el.dataset.visible === '1'; if (visible) { el.textContent = '******'; el.dataset.visible = '0'; } else { el.textContent = el.dataset.real || '******'; el.dataset.visible = '1'; setTimeout(() => { if (el.dataset.visible === '1') { el.textContent = '******'; el.dataset.visible = '0'; } }, 10000); } }
function toggleRowPassword(btn) { const code = btn.parentElement.querySelector('.pwd-mask'); if (!code) return; const visible = code.dataset.visible === '1'; if (visible) { code.textContent = '******'; code.dataset.visible = '0'; } else { code.textContent = code.dataset.real || '******'; code.dataset.visible = '1'; setTimeout(() => { if (code.dataset.visible === '1') { code.textContent = '******'; code.dataset.visible = '0'; } }, 8000); } }

window.delSt = delSt;
window.updStudentLoginOptions = updStudentLoginOptions;
window.toggleAdminLoginType = toggleAdminLoginType;
window.submitAdminAction = submitAdminAction;
window.approveAdminRequest = approveAdminRequest;
window.rejectAdminRequest = rejectAdminRequest;
window.disableAdmin = disableAdmin;
window.toggleSelfPassword = toggleSelfPassword;
window.toggleRowPassword = toggleRowPassword;
window.addTeacher = addTeacher;
window.resetTeacherPwd = resetTeacherPwd;
window.delTeacher = delTeacher;
window.openForgotPasswordModal = openForgotPasswordModal;
window.updForgotStudentOptions = updForgotStudentOptions;
window.doForgotPasswordReset = doForgotPasswordReset;
window.resetStudentPwd = resetStudentPwd;
window.openTeacherForgotModal = openTeacherForgotModal;
window.doTeacherForgotReset = doTeacherForgotReset;
window.openAdminForgotModal = openAdminForgotModal;
window.toggleAdminForgotType = toggleAdminForgotType;
window.doAdminForgotReset = doAdminForgotReset;
window.sendStudentMessage = sendStudentMessage;
window.sendTeacherMessage = sendTeacherMessage;
window.renderTeacherChat = renderTeacherChat;
window.linkTelegramForCurrentProfile = linkTelegramForCurrentProfile;

async function registerNewStudent() {
  const n = document.getElementById('regName').value.trim();
  const phone = String(document.getElementById('regPhone').value || '').trim();
  const teacherId = nNum(document.getElementById('regTeacherSel').value);
  const group = String(document.getElementById('regGroup').value || '').trim().toUpperCase();
  const refInput = normRefCode(document.getElementById('regRef').value);
  const paid = document.getElementById('regPaid')?.checked;
  if (!n) { toast('Ism kiriting!', 'error'); return; }
  if (!teacherId || !getTeacherById(teacherId)) {
    toast("O'qituvchini tanlang!", 'error'); return;
  }
  let inviter = null;
  if (refInput) {
    inviter = students.find(s => normRefCode(s.refCode) === refInput && s.teacherId === teacherId); if (!inviter) {
      toast("Referral kod noto'g'ri yoki shu o'qituvchiga tegishli emas", 'error'); return;
    }
  }
  const id = nid++; const p = genP(n);
  const usedRef = new Set(students.map(s => normRefCode(s.refCode)));
  const myRef = uniqueRefCode(id, usedRef);
  const newStudent = { id, teacherId, name: n, refCode: myRef, password: p, phone, group: group || getTeacherById(teacherId)?.group || 'D1', totalCoins: 0, streak: 0, lastDailyDate: null, level: 1, badge: 'Starter' };
  if (paid) {
    newStudent.totalCoins = 15;
    txs.unshift({ id: Date.now() + Math.random(), studentId: id, teacherId, adminId: null, amount: 15, reason: 'payment', timestamp: Date.now(), details: 'To\'lov qilingan, 15 tanga' });
  }
  students.push(newStudent);
  if (inviter) await addCoin(inviter.id, 15, 'referral', `${n} qo'shilgani uchun referral bonus`);
  await save();
  if (phone) await sendSmsNotification(phone, `Salom ${n}! Siz ${getTeacherById(teacherId)?.name || "o'qituvchi"} guruhiga muvaffaqiyatli yozildingiz. Parolingiz: ${p}`);
  document.getElementById('regName').value = ''; document.getElementById('regPhone').value = ''; document.getElementById('regGroup').value = ''; document.getElementById('regRef').value = ''; if (document.getElementById('regPaid')) document.getElementById('regPaid').checked = false;
  closeModal('registerModal');
  renderSTbl(); updSels(); renderAD(); updStudentLoginOptions(); renderTeacherProfilePage();
  toast(`${n} ro'yxatdan o'tdi! Parol: ${p}`, 'success');
}

function openModal(id) { const node = el(id); if (node) node.classList.add('open'); }
function closeModal(id) { const node = el(id); if (node) node.classList.remove('open'); }
function toast(msg, type = 'info') {
  let c = document.getElementById('tc');
  if (!c) {
    c = document.createElement('div');
    c.id = 'tc';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function toggleSB() { const sidebar = el('sidebar'); const bg = el('sbBg'); if (sidebar) sidebar.classList.toggle('open'); if (bg) bg.classList.toggle('open'); }
function closeSB() { const sidebar = el('sidebar'); const bg = el('sbBg'); if (sidebar) sidebar.classList.remove('open'); if (bg) bg.classList.remove('open'); }

let dp = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); dp = e; const banner = el('installBanner'); if (banner) banner.classList.add('show'); });
const installBtn = el('installBtn');
if (installBtn) installBtn.addEventListener('click', async () => { if (!dp) return; dp.prompt(); const { outcome } = await dp.userChoice; dp = null; const banner = el('installBanner'); if (banner) banner.classList.remove('show'); if (outcome === 'accepted') toast('Ilova o\'rnatildi!', 'success'); });
const installDismiss = el('installDismiss');
if (installDismiss) installDismiss.addEventListener('click', () => { const banner = el('installBanner'); if (banner) banner.classList.remove('show'); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    .catch(() => { });
}
if ('caches' in window) {
  caches.keys()
    .then(keys => Promise.all(keys.map(key => caches.delete(key))))
    .catch(() => { });
}
const mf = { name: "Teacher_texno", short_name: "T_texno", start_url: "./", display: "standalone", background_color: "#1a2235", theme_color: "#1a2235", orientation: "portrait-primary", icons: [{ src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect fill='%231a2235' width='192' height='192' rx='38'/%3E%3Cpolygon points='96,12 172,52 172,140 96,180 20,140 20,52' fill='none' stroke='%23c8a020' stroke-width='6'/%3E%3Ctext x='96' y='112' font-size='52' font-family='Arial' font-weight='bold' fill='%232b7de9' text-anchor='middle'%3ETT%3C/text%3E%3C/svg%3E", sizes: "192x192", type: "image/svg+xml" }, { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect fill='%231a2235' width='512' height='512' rx='100'/%3E%3Cpolygon points='256,30 460,140 460,372 256,482 52,372 52,140' fill='none' stroke='%23c8a020' stroke-width='12'/%3E%3Ctext x='256' y='296' font-size='130' font-family='Arial' font-weight='bold' fill='%232b7de9' text-anchor='middle'%3ETT%3C/text%3E%3C/svg%3E", sizes: "512x512", type: "image/svg+xml" }] };
const ml = document.createElement('link'); ml.rel = 'manifest'; ml.href = URL.createObjectURL(new Blob([JSON.stringify(mf)], { type: 'application/json' })); document.head.appendChild(ml);

document.addEventListener('keydown', e => { if (e.key !== 'Enter') return; const ls = document.getElementById('loginScreen'); if (!ls || ls.style.display === 'none') return; if (document.getElementById('sLoginForm').style.display !== 'none') doSLogin(); else if (document.getElementById('tLoginForm').style.display !== 'none') doTLogin(); else doALogin(); });

async function init() {
  try {
    await new Promise(r => setTimeout(r, 1200));
    const d = await load();
    if (d) normalizeData(d); else { mkDef(); await save(); }
    updTeacherLoginOptions();
    updAdminLoginOptions();
    updStudentLoginOptions();
    toggleAdminLoginType();
    updSels();
  } catch (error) {
    console.error('Init xatosi', error);
    toast("Sayt yuklashda xato bo'ldi. Sahifani yangilang.", 'error');
  } finally {
    const loading = el('loadingOverlay');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(() => { loading.style.display = 'none'; }, 500);
    }
  }
}
init();
