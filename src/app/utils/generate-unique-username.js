// utils/generate-unique-username.js
const User = require('../models/User');

/**
 * Gera um username único e válido (regex do schema: /^[a-zA-Z0-9_]+$/, 3-30 chars)
 * a partir de um nome (ex: vindo do Facebook/Google).
 */
async function generateUniqueUsername(rawName) {
  const base = (rawName || 'user')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9_]/g, '')   // remove tudo que não é letra/número/underscore
    .toLowerCase()
    .slice(0, 20) || 'user';

  const paddedBase = base.length < 3 ? `${base}user` : base;

  let username = paddedBase;
  let attempt = 0;

  // Tenta até achar um username livre
  while (await User.exists({ username })) {
    attempt += 1;
    const suffix = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
    username = `${paddedBase}${suffix}`.slice(0, 30);

    if (attempt > 10) {
      // fallback de segurança para não entrar em loop infinito
      username = `user${Date.now()}`.slice(0, 30);
      break;
    }
  }

  return username;
}

module.exports = generateUniqueUsername;