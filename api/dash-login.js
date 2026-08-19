// POST { password } -> 200 if correct, 401 otherwise.
// Deliberately does NOT require GH_TOKEN/GH_BRANCH — login should
// work (or clearly fail on the password alone) even before the
// GitHub side of the dashboard has been configured.
const { checkPassword } = require('./_lib/github');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { password } = body || {};
  if (!checkPassword(password)) return res.status(401).json({ error: 'Wrong password' });
  return res.status(200).json({ ok: true });
};
