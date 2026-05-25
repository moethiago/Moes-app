// ============================================================
// api/deploy.js — secure file deployment to GitHub
// Protected by DEPLOY_SECRET env var
// Usage: POST /api/deploy with { secret, path, content }
// ============================================================

const REPO_OWNER = 'moethiago';
const REPO_NAME  = 'Moes-app';
const BRANCH     = 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret      = process.env.DEPLOY_SECRET;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!secret || !githubToken) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Auth check
  if (!body.secret || body.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filePath = body.path;
  const content  = body.content;
  const message  = body.message || ('Update ' + filePath);

  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content required' });
  }

  try {
    const apiBase = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + filePath;

    // Get current file SHA (needed for updates)
    const getRes = await fetch(apiBase + '?ref=' + BRANCH, {
      headers: {
        'Authorization': 'token ' + githubToken,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    let sha = null;
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    }

    // Write the file
    const putBody = {
      message: message,
      content: Buffer.from(content).toString('base64'),
      branch:  BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + githubToken,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(500).json({ error: 'GitHub write failed: ' + err.slice(0, 200) });
    }

    const putData = await putRes.json();
    return res.status(200).json({
      ok:      true,
      path:    filePath,
      sha:     putData.content && putData.content.sha,
      commit:  putData.commit && putData.commit.sha,
      message: message,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
