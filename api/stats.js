// Fully self-contained: no imports from a lib/ folder, so there's nothing
// for Vercel's function bundler to miss. Everything this endpoint needs
// lives in this one file.

const theme = {
  bg: '#10121f', border: '#262a45', text: '#e7e7f5', dim: '#8b8fae',
  faint: '#565a78', violet: '#b07bff', magenta: '#ff5fd1', red: '#ff5f57',
};
const FONT = `'JetBrains Mono','SF Mono','Fira Code',ui-monospace,Consolas,monospace`;

function escapeXml(str = '') {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function cardFrame({ width, height, title, body }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.violet}" /><stop offset="100%" stop-color="${theme.magenta}" />
    </linearGradient>
    <style>
      .fade { animation: fadeIn 0.6s ease-out both; }
      .d1{animation-delay:.05s}.d2{animation-delay:.12s}.d3{animation-delay:.19s}
      .d4{animation-delay:.26s}.d5{animation-delay:.33s}.d6{animation-delay:.4s}
      @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
    </style>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${theme.bg}" stroke="${theme.border}" />
  <clipPath id="clip"><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" /></clipPath>
  <g clip-path="url(#clip)">
    <rect x="0" y="0" width="${width}" height="34" fill="#0d0e1c" />
    <line x1="0" y1="34" x2="${width}" y2="34" stroke="${theme.border}" stroke-width="1" />
    <circle cx="18" cy="17" r="5.5" fill="${theme.red}" /><circle cx="36" cy="17" r="5.5" fill="#febc2e" /><circle cx="54" cy="17" r="5.5" fill="#28c840" />
    <text x="${width / 2}" y="21" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${theme.faint}">${escapeXml(title)}</text>
    ${body}
  </g>
</svg>`;
}

function errorCard(message, { width = 480, height = 120 } = {}) {
  const body = `<text x="${width / 2}" y="${height / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${theme.dim}">⚠ ${escapeXml(message)}</text>`;
  return cardFrame({ width, height, title: 'error', body });
}

function isValidUsername(username) {
  return /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(username);
}

async function ghREST(path) {
  const headers = { 'User-Agent': 'github-card-generator', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const err = new Error(`GitHub REST ${res.status}`);
    err.status = res.status === 404 ? 404 : res.status === 403 ? 429 : 502;
    throw err;
  }
  return res.json();
}

async function fetchAllRepos(username, maxPages = 3) {
  let repos = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await ghREST(`/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&type=owner&sort=updated`);
    repos = repos.concat(batch);
    if (batch.length < 100) break;
  }
  return repos;
}

function renderStatsCard({ username, name, stats }) {
  const width = 480;
  const cols = 3;
  const rows = Math.ceil(stats.length / cols);
  const cellW = (width - 40) / cols;
  const cellH = 62;
  const top = 56;
  const height = top + rows * cellH + 20;

  const cells = stats.map((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 20 + col * cellW, y = top + row * cellH;
    return `
      <g class="fade d${i + 1}">
        <text x="${x}" y="${y + 16}" font-family="${FONT}" font-size="11" fill="${theme.dim}">${escapeXml(s.label)}</text>
        <text x="${x}" y="${y + 38}" font-family="${FONT}" font-size="20" font-weight="700" fill="url(#accent)">${escapeXml(String(s.value))}</text>
      </g>`;
  }).join('');

  const body = `
    <text x="20" y="${top - 18}" font-family="${FONT}" font-size="13" fill="${theme.text}" font-weight="700">${escapeXml(name || username)}</text>
    <text x="${width - 20}" y="${top - 18}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.faint}">@${escapeXml(username)}</text>
    ${cells}`;

  return cardFrame({ width, height, title: `github-stats/${username}`, body });
}

export default async function handler(req, res) {
  const username = String(req.query.username || '').trim();
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');

  if (!username) { res.status(400); return res.send(errorCard('Add ?username=your-github-handle to the URL')); }
  if (!isValidUsername(username)) { res.status(400); return res.send(errorCard(`"${username}" is not a valid GitHub username`)); }

  try {
    const [user, repos] = await Promise.all([ghREST(`/users/${encodeURIComponent(username)}`), fetchAllRepos(username)]);
    const owned = repos.filter((r) => !r.fork);
    const totalStars = owned.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const totalForks = owned.reduce((sum, r) => sum + (r.forks_count || 0), 0);
    const langCounts = {};
    for (const r of owned) if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const stats = [
      { label: 'Public repos', value: user.public_repos },
      { label: 'Total stars', value: totalStars },
      { label: 'Total forks', value: totalForks },
      { label: 'Followers', value: user.followers },
      { label: 'Following', value: user.following },
      { label: 'Top language', value: topLang },
    ];

    res.status(200);
    return res.send(renderStatsCard({ username: user.login, name: user.name, stats }));
  } catch (err) {
    const message = err.status === 404 ? `User "${username}" not found` : 'Could not load GitHub stats right now';
    res.status(err.status && err.status < 500 ? err.status : 502);
    return res.send(errorCard(message));
  }
}
