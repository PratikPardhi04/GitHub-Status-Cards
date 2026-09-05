export const theme = {
  card: '#1a1b27', border: '#555148', text: '#d9e2ee', dim: '#8f96a3',
  faint: '#626a75', blue: '#4ba7f8', purple: '#bf5fff', lavender: '#bf91f3',
};
export const FONT = `'JetBrains Mono','SF Mono','Fira Code',ui-monospace,Consolas,monospace`;

export function escapeXml(value = '') {
  return String(value).replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[character]));
}

export function isValidUsername(username) {
  return /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(username);
}

export function cardFrame({ width, height, body, radius = 10 }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs><linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${theme.lavender}" /><stop offset="100%" stop-color="${theme.purple}" /></linearGradient><style>.fade{animation:fadeIn .45s ease-out both}.d1{animation-delay:.03s}.d2{animation-delay:.08s}.d3{animation-delay:.13s}.d4{animation-delay:.18s}.d5{animation-delay:.23s}.d6{animation-delay:.28s}@keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}</style></defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" fill="${theme.card}" stroke="${theme.border}" />${body}</svg>`;
}

export function errorCard(message, title = 'GitHub Card') {
  const width = 520, height = 110;
  return cardFrame({ width, height, body: `<text x="24" y="32" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.text}">${escapeXml(title)}</text><line x1="0" y1="47" x2="${width}" y2="47" stroke="${theme.border}" /><text x="${width / 2}" y="78" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${theme.dim}">${escapeXml(message)}</text>` });
}

export async function ghREST(path) {
  const headers = { 'User-Agent': 'github-card-generator', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) { const error = new Error(`GitHub REST ${response.status}`); error.status = response.status === 404 ? 404 : response.status === 403 ? 429 : 502; throw error; }
  return response.json();
}

export async function fetchAllRepos(username, maxPages = 3) {
  let repos = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await ghREST(`/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&type=owner&sort=updated`);
    repos = repos.concat(batch);
    if (batch.length < 100) break;
  }
  return repos;
}

export function startResponse(req, res, title) {
  const username = String(req.query.username || '').trim();
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  if (!username) { res.status(400); return { username, card: errorCard('Add ?username=your-github-handle to the URL', title) }; }
  if (!isValidUsername(username)) { res.status(400); return { username, card: errorCard(`"${username}" is not a valid GitHub username`, title) }; }
  return { username };
}

export function sendError(res, error, username, title, fallback) {
  const message = error.status === 404 ? `User "${username}" not found` : fallback;
  res.status(error.status && error.status < 500 ? error.status : 502);
  return res.send(errorCard(message, title));
}