// Minimal session handling for the single-admin-user prototype.
// Sessions live in memory, so restarting the server logs everyone out —
// that's fine for a local prototype.

const crypto = require("crypto");

const sessions = new Map(); // token -> expiry timestamp
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function createSession() {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  const expiry = sessions.get(token);
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(token) {
  sessions.delete(token);
}

function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_session;
  if (isValidSession(token)) {
    return next();
  }
  return res.redirect("/admin/login");
}

module.exports = { createSession, isValidSession, destroySession, requireAdmin };
