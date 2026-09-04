// ═══════════════════════════════════════════════════════════════════
// EDU-CRM BACKEND SERVER (Express + Node.js built-in SQLite node:sqlite)
// Railway uchun: data.db /app/data papkasida saqlanadi (persist)
// Lokal ishlatishda: ./data/data.db
// ═══════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const session = require('express-session');
const passport = require('passport');
let GoogleStrategy;
try { GoogleStrategy = require('passport-google-oauth20').Strategy; } catch(e) {}
const jwt = require('jsonwebtoken');

try {
  require('dotenv').config();
} catch(e) {}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
  secret: process.env.JWT_SECRET || 'super_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GOOGLE_CLIENT_ID && GoogleStrategy) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.APP_URL || 'https://texnoo.com'}/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }));
} else {
  console.log("⚠️ GOOGLE_CLIENT_ID kiritilmagan yoki kutubxonalar o'rnatilmagan. Google Login ishlamaydi.");
}

// ───────── DATA FOLDER (Railway /app/data | lokal ./data) ─────────
function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    '/app/data',
    path.join(__dirname, 'data')
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      const testFile = path.join(p, '.write_test_' + Date.now());
      fs.writeFileSync(testFile, 'ok'); fs.unlinkSync(testFile);
      return p;
    } catch (e) { /* keyingisiga o't */ }
  }
  const fallback = path.join(__dirname, 'data');
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}
const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'data.db');
console.log('[DB] Ma\'lumotlar bazasi:', DB_PATH);
const db = new DatabaseSync(DB_PATH);
try { db.exec('PRAGMA journal_mode = WAL'); } catch(e){}
try { db.exec('PRAGMA foreign_keys = ON'); } catch(e){}

// ───────────────────────── TABLELARNI YARATAMIZ ────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS typing_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default-center',
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  wpm INTEGER DEFAULT 0,
  cpm INTEGER DEFAULT 0,
  accuracy INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  elapsed_sec REAL DEFAULT 0,
  completed INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  best_wpm INTEGER DEFAULT 0,
  best_cpm INTEGER DEFAULT 0,
  best_accuracy INTEGER DEFAULT 0,
  attempted_at INTEGER NOT NULL,
  UNIQUE(tenant, user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS typing_unlocked (
  tenant TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  next_unlocked INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(tenant, user_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  wpm INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  center_name TEXT NOT NULL,
  issued_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups_kv (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS homework_kv (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS races_kv (
  code TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS google_links (
  google_id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  email TEXT,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tp_u ON typing_progress(tenant, user_id);
CREATE INDEX IF NOT EXISTS idx_certs_u ON certificates(tenant, user_id);
CREATE INDEX IF NOT EXISTS idx_grp_t ON groups_kv(tenant);
CREATE INDEX IF NOT EXISTS idx_hw_t ON homework_kv(tenant);
`);

// ───────────────────────── KV HELPERS ───────────────────────────
const getKV = db.prepare('SELECT payload_json FROM app_state WHERE key=?');
const setKV = db.prepare('INSERT INTO app_state(key,payload_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at');

function now() { return Date.now(); }
function readState() {
  const row = getKV.get('main');
  if (!row) return null;
  try { return JSON.parse(row.payload_json); } catch(e){ return null; }
}
function writeState(state) {
  setKV.run('main', JSON.stringify(state), now());
}

// ───────────────────────── UMBRELLA /api/data (FE legacy support) ─────
app.get('/api/data', (req, res) => {
  const data = readState();
  if (!data) return res.json({ seedVersion: 1, students:[], teachers:[], admins:[] });
  res.json(data);
});

app.post('/api/data', (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ ok:false, err:'bad payload' });
  writeState(data);
  res.json({ ok: true, savedAt: now() });
});

// ───────────────────────── TENANT HELPER ─────────────────────────
function tenantOf(req) { return (req.query.tenant || req.body?.tenant || 'default-center').toString().slice(0,64); }

// ════════════════════════════════════════════════════════════════════════
// TYPING PROGRESS
// ════════════════════════════════════════════════════════════════════════
const stGetAll = db.prepare(`SELECT lesson_id, wpm, cpm, accuracy, errors, elapsed_sec, completed, passed, best_wpm, best_cpm, best_accuracy, attempted_at FROM typing_progress WHERE tenant=? AND user_id=?`);
const stUnlockGet = db.prepare(`SELECT next_unlocked FROM typing_unlocked WHERE tenant=? AND user_id=?`);
const stUpsert = db.prepare(`
INSERT INTO typing_progress(tenant,user_id,lesson_id,wpm,cpm,accuracy,errors,elapsed_sec,completed,passed,best_wpm,best_cpm,best_accuracy,attempted_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(tenant,user_id,lesson_id) DO UPDATE SET
  wpm=excluded.wpm, cpm=excluded.cpm, accuracy=excluded.accuracy, errors=excluded.errors, elapsed_sec=excluded.elapsed_sec,
  completed=excluded.completed, passed=excluded.passed, attempted_at=excluded.attempted_at,
  best_wpm=CASE WHEN excluded.best_wpm>typing_progress.best_wpm THEN excluded.best_wpm ELSE typing_progress.best_wpm END,
  best_cpm=CASE WHEN excluded.best_cpm>typing_progress.best_cpm THEN excluded.best_cpm ELSE typing_progress.best_cpm END,
  best_accuracy=CASE WHEN excluded.best_accuracy>typing_progress.best_accuracy THEN excluded.best_accuracy ELSE typing_progress.best_accuracy END`);
const stUnlockUpsert = db.prepare(`INSERT INTO typing_unlocked(tenant,user_id,next_unlocked) VALUES(?,?,?) ON CONFLICT(tenant,user_id) DO UPDATE SET next_unlocked=CASE WHEN excluded.next_unlocked>typing_unlocked.next_unlocked THEN excluded.next_unlocked ELSE typing_unlocked.next_unlocked END`);

app.get('/api/typing/progress', (req, res) => {
  const userId = Number(req.query.userId||0);
  if (!userId) return res.status(400).json({ ok:false, err:'userId required' });
  const tenant = tenantOf(req);
  const out = { userId, tenant, nextUnlockedLesson: 1 };
  for (const r of stGetAll.iterate(tenant, userId)) {
    out[String(r.lesson_id)] = {
      lessonId: r.lesson_id, wpm: r.wpm, cpm: r.cpm, accuracy: r.accuracy, errors: r.errors,
      elapsedSec: r.elapsed_sec, completed: !!r.completed, passed: !!r.passed,
      bestWpm: r.best_wpm||0, bestCpm: r.best_cpm||0, bestAcc: r.best_accuracy||0,
      attemptedAt: r.attempted_at
    };
  }
  const un = stUnlockGet.get(tenant, userId);
  out.nextUnlockedLesson = un?.next_unlocked || 1;
  res.json({ ok:true, data: out });
});

app.post('/api/typing/progress', (req, res) => {
  const { userId, lessonId, record } = req.body || {};
  if (!userId || !lessonId || !record) return res.status(400).json({ ok:false, err:'missing fields' });
  const tenant = tenantOf(req);
  const passed = !!record.passed;
  const bestWpm = Math.max(0, Number(record.wpm||0));
  const bestCpm = Math.max(0, Number(record.cpm||0));
  const bestAcc = Math.max(0, Math.min(100, Number(record.accuracy||0)));
  stUpsert.run(
    tenant, userId, lessonId,
    Number(record.wpm||0), Number(record.cpm||0), Number(record.accuracy||0), Number(record.errors||0),
    Number(record.elapsedSec||0),
    record.completed?1:0, passed?1:0,
    bestWpm, bestCpm, bestAcc,
    record.attemptedAt || now()
  );
  if (passed) stUnlockUpsert.run(tenant, userId, Number(lessonId) + 1);
  const full = {};
  for (const r of stGetAll.iterate(tenant, userId)) full[String(r.lesson_id)] = {
    lessonId: r.lesson_id, wpm:r.wpm, cpm:r.cpm, accuracy:r.accuracy, errors:r.errors,
    elapsedSec:r.elapsed_sec, completed:!!r.completed, passed:!!r.passed,
    bestWpm: r.best_wpm||0, bestCpm: r.best_cpm||0, bestAcc: r.best_accuracy||0, attemptedAt:r.attempted_at
  };
  const un = stUnlockGet.get(tenant, userId);
  full.userId = userId; full.tenant = tenant; full.nextUnlockedLesson = un?.next_unlocked || 1;
  res.json({ ok:true, data: full });
});

// ════════════════════════════════════════════════════════════════════════
// CERTIFICATES
// ════════════════════════════════════════════════════════════════════════
const certListStmt = db.prepare(`SELECT id, student_name, course_name, wpm, accuracy, center_name, issued_at FROM certificates WHERE tenant=? AND user_id=? ORDER BY issued_at DESC`);
const certInsertStmt = db.prepare(`INSERT INTO certificates(id,tenant,user_id,student_name,course_name,wpm,accuracy,center_name,issued_at) VALUES(?,?,?,?,?,?,?,?,?)`);

app.get('/api/certificates', (req, res) => {
  const userId = Number(req.query.userId||0); if (!userId) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  res.json({ ok:true, data: certListStmt.all(tenant, userId).map(r => ({
    id: r.id, studentName: r.student_name, courseName: r.course_name,
    wpm: r.wpm, accuracy: r.accuracy, centerName: r.center_name, issuedAt: r.issued_at
  }))});
});
app.post('/api/certificates', (req, res) => {
  const { userId, certificate } = req.body || {};
  if (!userId || !certificate) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const id = certificate.id || ('CERT-' + Date.now() + '-' + Math.floor(Math.random()*10000));
  certInsertStmt.run(
    id, tenant, userId,
    certificate.studentName || certificate.student_name || 'Talaba',
    certificate.courseName || certificate.course_name || 'Kurs',
    Number(certificate.wpm||0), Number(certificate.accuracy||0),
    certificate.centerName || certificate.center_name || "Texno O'quv Markazi",
    certificate.issuedAt || now()
  );
  res.json({ ok:true, data: { id, tenant, userId, ...certificate, id, issuedAt: certificate.issuedAt || now() } });
});

// ════════════════════════════════════════════════════════════════════════
// GROUPS
// ════════════════════════════════════════════════════════════════════════
const grpAllStmt = db.prepare(`SELECT id, payload_json FROM groups_kv WHERE tenant=?`);
const grpUpsertStmt = db.prepare(`INSERT INTO groups_kv(id,tenant,payload_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json`);
app.get('/api/groups', (req, res) => {
  const tenant = tenantOf(req);
  const tid = req.query.teacherId ? Number(req.query.teacherId) : null;
  const all = grpAllStmt.all(tenant).map(r => { try { return { id:r.id, ...JSON.parse(r.payload_json) }; } catch(e){ return null; } }).filter(Boolean);
  const out = tid ? all.filter(g => Number(g.teacherId) === tid || (Array.isArray(g.teacherIds) && g.teacherIds.includes(tid))) : all;
  res.json({ ok:true, data: out });
});
app.post('/api/groups', (req, res) => {
  const { group } = req.body || {}; if (!group?.id) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  group.tenant = group.tenant || tenant;
  grpUpsertStmt.run(group.id, tenant, JSON.stringify(group));
  res.json({ ok:true, data: group });
});

// ════════════════════════════════════════════════════════════════════════
// HOMEWORK / VAZIFA
// ════════════════════════════════════════════════════════════════════════
const hwAllStmt = db.prepare(`SELECT id, payload_json FROM homework_kv WHERE tenant=?`);
const hwUpsertStmt = db.prepare(`INSERT INTO homework_kv(id,tenant,payload_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json`);
app.get('/api/homework', (req, res) => {
  const tenant = tenantOf(req);
  const sid = req.query.studentId ? String(req.query.studentId) : null;
  const gid = req.query.groupId ? String(req.query.groupId) : null;
  const list = hwAllStmt.all(tenant).map(r => { try { return { id:r.id, ...JSON.parse(r.payload_json) }; } catch(e){ return null; } }).filter(Boolean);
  const out = list.filter(h => {
    const matchesStudent = !sid || (Array.isArray(h.studentIds) && h.studentIds.map(String).includes(sid)) || String(h.studentId) === sid;
    const matchesGroup   = !gid || String(h.groupId) === gid;
    return matchesStudent && matchesGroup;
  });
  res.json({ ok:true, data: out });
});
app.post('/api/homework', (req, res) => {
  const { homework } = req.body || {}; if (!homework?.id) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  homework.tenant = homework.tenant || tenant;
  hwUpsertStmt.run(homework.id, tenant, JSON.stringify(homework));
  res.json({ ok:true, data: homework });
});
app.post('/api/homework/submit', (req, res) => {
  const { homeworkId, studentId, submission } = req.body || {};
  if (!homeworkId || !studentId) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const rows = hwAllStmt.all(tenant);
  const found = rows.find(r => { try { return JSON.parse(r.payload_json).id === homeworkId; } catch(e){ return false; }});
  if (!found) return res.status(404).json({ ok:false });
  const obj = { id: found.id, ...JSON.parse(found.payload_json) };
  obj.submissions = obj.submissions || {};
  obj.submissions[String(studentId)] = { submittedAt: Date.now(), ...(submission || {}) };
  hwUpsertStmt.run(obj.id, tenant, JSON.stringify(obj));
  res.json({ ok:true, data: obj });
});

// ════════════════════════════════════════════════════════════════════════
// TYPING RACE
// ════════════════════════════════════════════════════════════════════════
const raceGetStmt = db.prepare(`SELECT payload_json FROM races_kv WHERE code=? AND tenant=?`);
const raceUpsertStmt = db.prepare(`INSERT INTO races_kv(code,tenant,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(code) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`);
function getRace(code, tenant){ const r = raceGetStmt.get(code, tenant); if (!r) return null; try { return JSON.parse(r.payload_json); } catch(e){ return null; } }
function saveRace(race){ raceUpsertStmt.run(race.code, race.tenant||'default-center', JSON.stringify(race), now()); return race; }

app.get('/api/race', (req, res) => {
  const code = (req.query.code||'').toString().slice(0,16);
  if (!code) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  res.json({ ok:true, data: getRace(code, tenant) });
});
app.post('/api/race/create', (req, res) => {
  const { race } = req.body || {}; if (!race?.code) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  race.tenant = tenant;
  saveRace(race);
  res.json({ ok:true, data: race });
});
app.post('/api/race/join', (req, res) => {
  const { code, player } = req.body || {};
  if (!code || !player?.id) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const race = getRace(code, tenant);
  if (!race) return res.status(404).json({ ok:false });
  if (!race.players.find(p => String(p.id) === String(player.id))) {
    race.players.push({ ...player, progress:0, wpm:0, accuracy:100, done:false, finishedAt:null });
    saveRace(race);
  }
  res.json({ ok:true, data: race });
});
app.post('/api/race/start', (req, res) => {
  const { code } = req.body || {}; if (!code) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const race = getRace(code, tenant); if (!race) return res.status(404).json({ ok:false });
  race.status = 'running'; race.startedAt = now(); saveRace(race);
  res.json({ ok:true, data: race });
});
app.post('/api/race/progress', (req, res) => {
  const { code, playerId, progress } = req.body || {};
  if (!code || !playerId) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const race = getRace(code, tenant); if (!race) return res.status(404).json({ ok:false });
  const pl = race.players.find(p => String(p.id) === String(playerId));
  if (pl) { Object.assign(pl, progress || {}); saveRace(race); }
  res.json({ ok:true, data: race });
});

// ════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH ROUTES
// ════════════════════════════════════════════════════════════════════════
app.get('/auth/google', (req, res, next) => {
  req.session.oauthAction = req.query.action || 'login';
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/callback.html?error=auth_failed' }), (req, res) => {
  const profile = req.user;
  const action = req.session.oauthAction;
  const token = jwt.sign({ googleId: profile.id, email: profile.emails?.[0]?.value, name: profile.displayName }, process.env.JWT_SECRET || 'super_secret', { expiresIn: '1h' });
  res.redirect(`/callback.html?token=${token}&action=${action}`);
});

app.post('/api/auth/google-link', (req, res) => {
  const { token, userType, userId } = req.body;
  if (!token || !userType || !userId) return res.status(400).json({ ok: false, err: 'Missing parameters' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret');
    db.prepare(`INSERT INTO google_links (google_id, user_type, user_id, email, name, created_at) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(google_id) DO UPDATE SET user_type=excluded.user_type, user_id=excluded.user_id, email=excluded.email, name=excluded.name`)
      .run(decoded.googleId, userType, userId, decoded.email, decoded.name, now());
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, err: 'Invalid token' });
  }
});

app.post('/api/auth/google-unlink', (req, res) => {
  const { userType, userId } = req.body;
  if (!userType || !userId) return res.status(400).json({ ok: false });
  db.prepare(`DELETE FROM google_links WHERE user_type=? AND user_id=?`).run(userType, userId);
  res.json({ ok: true });
});

app.post('/api/auth/google-login', (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret');
    const link = db.prepare(`SELECT user_type, user_id FROM google_links WHERE google_id=?`).get(decoded.googleId);
    if (!link) return res.status(404).json({ ok: false, err: 'Bunday profil bog\\'lanmagan' });
    res.json({ ok: true, data: { type: link.user_type, id: link.user_id } });
  } catch (e) {
    res.status(400).json({ ok: false, err: 'Invalid token' });
  }
});

app.get('/api/auth/google-status', (req, res) => {
  const { userType, userId } = req.query;
  const link = db.prepare(`SELECT email FROM google_links WHERE user_type=? AND user_id=?`).get(userType, userId);
  res.json({ ok: true, linked: !!link, email: link?.email });
});

// ════════════════════════════════════════════════════════════════════════
// TELEGRAM PHOTO PROXY
// ════════════════════════════════════════════════════════════════════════
app.post('/api/upload-photo', async (req, res) => {
  const { base64 } = req.body;
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.PHOTO_CHAT_ID;
  if (!botToken || !chatId || !base64) return res.status(400).json({ ok: false, err: 'Configuration or image missing' });

  try {
    const base64Data = base64.replace(/^data:image\\/\\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', blob, 'photo.jpg');

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    const data = await tgRes.json();
    if (!data.ok) return res.status(400).json({ ok: false, err: data.description });
    
    // Eng katta rasmni tanlash
    const photos = data.result.photo;
    const fileId = photos[photos.length - 1].file_id;
    res.json({ ok: true, file_id: fileId });
  } catch (e) {
    console.error('Photo upload error:', e);
    res.status(500).json({ ok: false, err: e.message });
  }
});

app.get('/api/photo/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return res.status(404).end();
  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) return res.status(404).end();
    
    const filePath = fileData.result.file_path;
    const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Keshda 1 yil
    imgRes.body.pipe(res);
  } catch (e) {
    res.status(500).end();
  }
});

// ════════════════════════════════════════════════════════════════════════
// STATIC + SPA FALLBACK
// ════════════════════════════════════════════════════════════════════════
app.use(express.static(__dirname, { index: ['index.html'] }));

app.get('/callback', (req, res) => res.sendFile(path.join(__dirname, 'callback.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ───────────────────────── SERVER START ─────────────────────────
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[EDU-CRM] Server ishlayapti → http://localhost:${PORT}`);
  console.log(`[EDU-CRM] SQLite DB → ${DB_PATH}`);
  console.log(`[EDU-CRM] DATA_DIR   → ${DATA_DIR}`);
  console.log(`[EDU-CRM] Backend ishlayapti · Ma'lumotlar data.db'ga yoziladi (local/localStorage emas!)`);
});
