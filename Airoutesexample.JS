/**
 * AI EDUCATION ASSISTANT — BACKEND ROUTES (misol)
 * ================================================
 * Bu fayl Texnoo platformasining mavjud backendiga (Node/Express deb
 * taxmin qilindi, chunki frontend allaqachon /api/data, /api/upload,
 * /api/ai/chat kabi endpointlarga murojaat qiladi) QO'SHILADIGAN qism.
 *
 * MUHIM XAVFSIZLIK QOIDASI:
 *  - AI API kaliti HECH QACHON frontendga (index.html/JS) yozilmaydi.
 *  - Kalit faqat serverdagi environment variable orqali o'qiladi:
 *        ANTHROPIC_API_KEY=sk-ant-...   (.env faylida, .gitignore'da)
 *  - Frontend faqat shu quyidagi 4 ta endpointga fetch() yuboradi,
 *    kalitni hech qachon ko'rmaydi.
 *
 * O'RNATISH:
 *   npm install @anthropic-ai/sdk
 *   .env fayliga: ANTHROPIC_API_KEY=sizning_kalitingiz
 *   Bu faylni serverga (masalan server.js) import qiling:
 *       require('dotenv').config();
 *       const registerAiRoutes = require('./ai-routes-example');
 *       registerAiRoutes(app);
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // <-- kalit FAQAT shu yerda, serverda
});

const MODEL = 'claude-sonnet-4-6';

// Oddiy himoya: har bir foydalanuvchi/IP uchun daqiqasiga cheklov
// (production'da redis yoki shunga o'xshash narsa bilan almashtiring).
const rateMap = new Map();
function rateLimited(key, limit = 15, windowMs = 60000) {
  const now = Date.now();
  const rec = rateMap.get(key) || { count: 0, start: now };
  if (now - rec.start > windowMs) { rec.count = 0; rec.start = now; }
  rec.count++;
  rateMap.set(key, rec);
  return rec.count > limit;
}

async function askClaude(system, userText, maxTokens = 1500) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userText }],
  });
  return msg.content.map(b => (b.type === 'text' ? b.text : '')).join('\n').trim();
}

module.exports = function registerAiRoutes(app) {

  // ─────────────────────────────────────────────
  // 1) AI TUTOR (Repetitor) — talaba bilan suhbat
  // POST /api/ai/tutor  { message, studentName, studentGroup, history }
  // → { reply }
  // ─────────────────────────────────────────────
  app.post('/api/ai/tutor', async (req, res) => {
    try {
      if (rateLimited('tutor:' + (req.ip || 'anon'))) {
        return res.status(429).json({ message: "Juda ko'p so'rov. Biroz kuting." });
      }
      const { message, studentName, history } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'message majburiy' });
      }

      const system = [
        "Sen Texnoo platformasidagi 'AI Repetitor' — IT/dasturlash o'qituvchisisan.",
        "Har javobingda quyidagi tuzilishga rioya qil (lekin sarlavhalarni tabiiy uslubda yoz, robotcha bo'lmasin):",
        "1) Oddiy va qisqa tushuntirish (talaba darajasiga mos, murakkab atamalarni oddiy tilda tushuntir).",
        "2) Aniq bitta misol (kod yoki hayotiy misol).",
        "3) Talabani mustahkamlash uchun bitta tekshiruv savoli.",
        "4) Kichik amaliy mashq (talaba o'zi bajarishi uchun).",
        "Agar talaba oldingi mashqqa/savolga javob yozgan bo'lsa — avval javobini tekshir (to'g'ri/xato, nega), keyin darajasiga qarab keyingi bosqichga o't (agar to'g'ri bo'lsa — chuqurroq, xato bo'lsa — soddaroq tushuntir).",
        "Javoblaring o'zbek tilida, qisqa va do'stona bo'lsin. Kod misollarini ``` bilan formatlab yoz.",
      ].join('\n');

      const historyText = Array.isArray(history)
        ? history.map(h => `${h.role === 'user' ? 'Talaba' : 'AI'}: ${h.content}`).join('\n')
        : '';
      const userText = `${historyText ? historyText + '\n\n' : ''}Talaba (${studentName || 'anonim'}): ${message}`;

      const reply = await askClaude(system, userText, 900);
      res.json({ reply });
    } catch (e) {
      console.error('AI tutor error:', e);
      res.status(500).json({ message: 'AI xatolik yuz berdi' });
    }
  });

  // ─────────────────────────────────────────────
  // 2) AI TEST GENERATOR (faqat o'qituvchi uchun!)
  // POST /api/ai/generate-test  { topic, count, level }
  // → { text }  — frontenddagi import formatiga mos matn:
  //     Savol?
  //     A) ...
  //     B) ...
  //     C) ...
  //     D) ...
  //     Javob: A
  //     (bo'sh qator, keyingi savol)
  // ─────────────────────────────────────────────
  app.post('/api/ai/generate-test', async (req, res) => {
    try {
      // TODO: bu yerda req orqali kelgan foydalanuvchi ROLE = teacher ekanini
      // sessiya/JWT orqali tekshiring — faqat o'qituvchilar chaqira olishi kerak.
      if (rateLimited('gentest:' + (req.ip || 'anon'), 10)) {
        return res.status(429).json({ message: "Juda ko'p so'rov. Biroz kuting." });
      }
      const { topic, count, level } = req.body || {};
      if (!topic) return res.status(400).json({ message: 'topic majburiy' });
      const n = Math.min(50, Math.max(1, parseInt(count) || 20));

      const system = [
        "Sen o'qituvchilar uchun test savollari generatoridasan.",
        "Faqat quyidagi FORMATDA, boshqa hech qanday izohsiz javob ber:",
        "Savol matni?",
        "A) variant 1",
        "B) variant 2",
        "C) variant 3",
        "D) variant 4",
        "Javob: A",
        "(har savoldan keyin bitta bo'sh qator qoldir, boshqa hech narsa yozma — sarlavha, raqamlash, izoh kerak emas)",
      ].join('\n');

      const userText = `Mavzu: ${topic}\nDaraja: ${level || "o'rta"}\nSavollar soni: ${n}\nO'zbek tilida ${n} ta test savoli tuz, yuqoridagi formatga qat'iy amal qil.`;

      const text = await askClaude(system, userText, 4000);
      res.json({ text });
    } catch (e) {
      console.error('AI generate-test error:', e);
      res.status(500).json({ message: 'AI xatolik yuz berdi' });
    }
  });

  // ─────────────────────────────────────────────
  // 3) AI HOMEWORK GENERATOR (faqat o'qituvchi uchun!)
  // POST /api/ai/generate-homework  { topic, level }
  // → { title, desc }
  // ─────────────────────────────────────────────
  app.post('/api/ai/generate-homework', async (req, res) => {
    try {
      if (rateLimited('genhw:' + (req.ip || 'anon'), 15)) {
        return res.status(429).json({ message: "Juda ko'p so'rov. Biroz kuting." });
      }
      const { topic, level } = req.body || {};
      if (!topic) return res.status(400).json({ message: 'topic majburiy' });

      const system = [
        "Sen o'qituvchilar uchun uy vazifasi generatoridasan.",
        'Faqat quyidagi JSON formatida javob ber (boshqa matn yozma):',
        '{"title": "qisqa sarlavha", "desc": "vazifa tafsiloti, 3-6 gap, aniq topshiriqlar bilan"}',
      ].join('\n');

      const userText = `Mavzu: ${topic}\nDaraja: ${level || "o'rta"}`;
      const raw = await askClaude(system, userText, 600);
      let parsed;
      try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
      catch { parsed = { title: topic, desc: raw }; }
      res.json(parsed);
    } catch (e) {
      console.error('AI generate-homework error:', e);
      res.status(500).json({ message: 'AI xatolik yuz berdi' });
    }
  });

  // ─────────────────────────────────────────────
  // 4) AI LESSON PLANNER (faqat o'qituvchi uchun!)
  // POST /api/ai/generate-lesson  { topic, subject }
  // → { topic, goal, hw }
  // ─────────────────────────────────────────────
  app.post('/api/ai/generate-lesson', async (req, res) => {
    try {
      if (rateLimited('genlp:' + (req.ip || 'anon'), 15)) {
        return res.status(429).json({ message: "Juda ko'p so'rov. Biroz kuting." });
      }
      const { topic, subject } = req.body || {};
      if (!topic) return res.status(400).json({ message: 'topic majburiy' });

      const system = [
        "Sen o'qituvchilar uchun dars rejasi generatoridasan.",
        'Faqat quyidagi JSON formatida javob ber (boshqa matn yozma):',
        '{"topic": "aniqlashtirilgan mavzu nomi", "goal": "dars maqsadi, 1 gap", "hw": "uyga vazifa, 1 gap"}',
      ].join('\n');

      const userText = `Mavzu: ${topic}\nFan: ${subject || '—'}`;
      const raw = await askClaude(system, userText, 500);
      let parsed;
      try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
      catch { parsed = { topic, goal: '', hw: '' }; }
      res.json(parsed);
    } catch (e) {
      console.error('AI generate-lesson error:', e);
      res.status(500).json({ message: 'AI xatolik yuz berdi' });
    }
  });
};