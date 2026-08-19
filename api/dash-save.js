// POST { password, data } -> commits the given object as
// content/data.json on GH_BRANCH via the GitHub Contents API.
const { checkConfig, checkPassword, putFile } = require('./_lib/github');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { password, data } = body || {};

  if (!checkPassword(password)) return res.status(401).json({ error: 'Wrong password' });

  const configError = checkConfig();
  if (configError) return res.status(500).json({ error: configError });

  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Missing data' });

  try {
    const json = JSON.stringify(data, null, 2) + '\n';
    const base64 = Buffer.from(json, 'utf-8').toString('base64');
    await putFile('content/data.json', base64, 'dash: update content/data.json');
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Save failed' });
  }
};
