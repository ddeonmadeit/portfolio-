// POST { password, filename, base64, contentType } -> commits a new
// file to assets/<filename> and returns the path to reference in
// content/data.json. Vercel's default body-size limit (~4.5MB) caps
// how large a base64 payload this can accept in one call.
const { checkConfig, checkPassword, putFile } = require('./_lib/github');

const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { password, filename, base64 } = body || {};

  if (!checkPassword(password)) return res.status(401).json({ error: 'Wrong password' });

  const configError = checkConfig();
  if (configError) return res.status(500).json({ error: configError });

  if (!filename || !SAFE_NAME.test(filename)) return res.status(400).json({ error: 'Invalid filename' });
  if (!base64) return res.status(400).json({ error: 'Missing file content' });

  const path = `assets/${filename}`;
  try {
    await putFile(path, base64, `dash: upload ${filename}`);
    return res.status(200).json({ ok: true, path });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Upload failed' });
  }
};
