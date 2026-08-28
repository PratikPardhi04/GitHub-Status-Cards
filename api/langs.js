const theme = {
  bg: '#0a0e12', card: '#1a1b27', cardAlt: '#11161c', border: '#555148',
  text: '#d9e2ee', dim: '#8f96a3', faint: '#626a75', blue: '#4ba7f8',
  purple: '#bf5fff', lavender: '#bf91f3', magenta: '#ff5fd1', red: '#ff5f57',
};
const FONT = `'JetBrains Mono','SF Mono','Fira Code',ui-monospace,Consolas,monospace`;
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', C: '#555555', 'C#': '#178600', HTML: '#e34c26', CSS: '#563d7c',
  Go: '#00ADD8', Rust: '#dea584', PHP: '#4F5D95', Ruby: '#701516', Swift: '#F05138',
  Kotlin: '#A97BFF', Shell: '#89e051', Vue: '#41b883', Dart: '#00B4AB', Jupyter: '#DA5B0B',
};
const langColor = (lang) => LANG_COLORS[lang] || theme.violet;

function escapeXml(str = '') {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function cardFrame({ width, height, title, body, radius = 10 }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.lavender}" />
      <stop offset="100%" stop-color="${theme.purple}" />
    </linearGradient>
    <style>
      .fade { animation: fadeIn .45s ease-out both; }
      .d1{animation-delay:.03s}.d2{animation-delay:.08s}.d3{animation-delay:.13s}
      .d4{animation-delay:.18s}.d5{animation-delay:.23s}.d6{animation-delay:.28s}
      @keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
    </style>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" fill="${theme.card}" stroke="${theme.border}" />
  ${body}
</svg>`;
}

function errorCard(message, { width = 520, height = 110 } = {}) {
  const body = `
    <text x="24" y="32" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.text}">GitHub Stats</text>
    <line x1="0" y1="47" x2="${width}" y2="47" stroke="${theme.border}" />
    <text x="${width / 2}" y="78" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${theme.dim}">⚠ ${escapeXml(message)}</text>`;
  return cardFrame({ width, height, title: '', body });
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

function renderLangsCard({ username, languages }) {
  const width = 520;
  const barX = 24, barW = width - 48, rowH = 34, top = 72;
  const height = top + languages.length * rowH + 18;
  const total = languages.reduce((s, l) => s + l.count, 0) || 1;

  const rows = languages.map((l, i) => {
    const y = top + i * rowH;
    const pct = Math.round((l.count / total) * 100);
    const fillW = Math.max(6, (barW * l.count) / total);
    return `
      <g class="fade d${Math.min(i + 1, 6)}">
        <text x="${barX}" y="${y - 5}" font-family="${FONT}" font-size="11" font-weight="700" fill="${theme.text}">${escapeXml(l.name)}</text>
        <text x="${barX + barW}" y="${y - 5}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.dim}">${pct}%</text>
        <rect x="${barX}" y="${y + 4}" width="${barW}" height="8" rx="4" fill="${theme.border}" opacity=".55" />
        <rect x="${barX}" y="${y + 4}" width="${fillW}" height="8" rx="4" fill="${langColor(l.name)}" />
      </g>`;
  }).join('');

  const body = `
    <text x="24" y="32" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.text}">Top Languages</text>
    <text x="${width - 24}" y="32" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.blue}">@${escapeXml(username)}</text>
    <line x1="0" y1="47" x2="${width}" y2="47" stroke="${theme.border}" />
    ${rows}`;

  return cardFrame({ width, height, title: '', body });
}

export default async function handler(req, res) {
  const username = String(req.query.username || '').trim();
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');

  if (!username) { res.status(400); return res.send(errorCard('Add ?username=your-github-handle to the URL')); }
  if (!isValidUsername(username)) { res.status(400); return res.send(errorCard(`"${username}" is not a valid GitHub username`)); }

  try {
    const repos = await fetchAllRepos(username);
    const owned = repos.filter((r) => !r.fork);
    const counts = {};
    for (const r of owned) if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
    const languages = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));

    if (languages.length === 0) {
      res.status(200);
      return res.send(errorCard(`No public repos with a detected language for "${username}"`));
    }

    res.status(200);
    return res.send(renderLangsCard({ username, languages }));
  } catch (err) {
    const message = err.status === 404 ? `User "${username}" not found` : 'Could not load language data right now';
    res.status(err.status && err.status < 500 ? err.status : 502);
    return res.send(errorCard(message));
  }
}