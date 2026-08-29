const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

// ── ACCESS TOKEN — qisqa muddatli, har so'rovda Authorization header orqali yuboriladi
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role?.name || user.roleName,
      username: user.username,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret); // muddati o'tsa yoki noto'g'ri bo'lsa throw qiladi
}

// ── REFRESH TOKEN — uzoq muddatli, faqat httpOnly cookie orqali yuriladi.
// DB'da faqat HASH saqlanadi (RefreshToken.tokenHash), shuning uchun token
// o'g'irlansa ham DB dump orqali qayta ishlatib bo'lmaydi; revoke qilish mumkin.
function signRefreshToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user.id, jti }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
  return { token, jti };
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
};