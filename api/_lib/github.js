// ============================================================
//  Shared helpers for the /dash serverless functions.
//  These commit directly to the GitHub repo via the REST Contents
//  API, so Vercel's git integration picks the change up and
//  redeploys automatically — no separate database.
//
//  Required environment variables (set in the Vercel project, not
//  in this repo — see README.md "Dashboard setup"):
//    GH_TOKEN    a GitHub personal access token with Contents:
//                Read and write on this repo
//    GH_BRANCH   the branch Vercel's Production Branch points to
//  Optional:
//    GH_OWNER    defaults to "ddeonmadeit"
//    GH_REPO     defaults to "portfolio-"
//    DASH_PASSWORD  defaults to "v" if unset
// ============================================================

function env() {
  const owner = process.env.GH_OWNER || 'ddeonmadeit';
  const repo = process.env.GH_REPO || 'portfolio-';
  const branch = process.env.GH_BRANCH;
  const token = process.env.GH_TOKEN;
  return { owner, repo, branch, token };
}

function checkConfig() {
  const { branch, token } = env();
  if (!token) return 'Dashboard is not configured: the GH_TOKEN environment variable is missing in the Vercel project.';
  if (!branch) return 'Dashboard is not configured: the GH_BRANCH environment variable is missing in the Vercel project.';
  return null;
}

function checkPassword(password) {
  const expected = process.env.DASH_PASSWORD || 'v';
  return typeof password === 'string' && password === expected;
}

async function ghFetch(path, options = {}) {
  const { token } = env();
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

// GET the current sha of a file, or null if it doesn't exist yet
async function getFileSha(repoPath) {
  const { owner, repo, branch } = env();
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURI(repoPath)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}) for ${repoPath}`);
  const json = await res.json();
  return json.sha;
}

// Create or update a file with base64 content
async function putFile(repoPath, base64Content, message) {
  const { owner, repo, branch } = env();
  const sha = await getFileSha(repoPath);
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURI(repoPath)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: base64Content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub write failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

module.exports = { env, checkConfig, checkPassword, ghFetch, getFileSha, putFile };
