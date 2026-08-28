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

async function ghGraphQL(query, variables) {
  if (!process.env.GITHUB_TOKEN) {
    const err = new Error('This card needs a GITHUB_TOKEN set on the server.');
    err.status = 401;
    throw err;
  }
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'User-Agent': 'github-card-generator',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    const notFound = json.errors.some((e) => /could not resolve to a user/i.test(e.message));
    const err = new Error(json.errors.map((e) => e.message).join('; '));
    err.status = notFound ? 404 : 502;
    throw err;
  }
  return json.data;
}

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeStreaks(days) {
  let longest = 0, run = 0, longestEnd = null, longestStart = null, runStart = null;
  for (const d of days) {
    if (d.contributionCount > 0) {
      if (run === 0) runStart = d.date;
      run++;
      if (run > longest) { longest = run; longestStart = runStart; longestEnd = d.date; }
    } else run = 0;
  }

  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  let current = 0;
  let currentEnd = i >= 0 ? days[i].date : null;
  let currentStart = currentEnd;
  while (i >= 0 && days[i].contributionCount > 0) { current++; currentStart = days[i].date; i--; }

  return {
    current,
    longest,
    currentRangeLabel: current > 0 ? `${formatDate(currentStart)} – ${formatDate(currentEnd)}` : 'no active streak',
    longestRangeLabel: longest > 0 ? `${formatDate(longestStart)} – ${formatDate(longestEnd)}` : '—',
  };
}

function renderStreakCard({ username, total, current, longest, currentRangeLabel, longestRangeLabel }) {
  const width = 480, height = 140, colW = width / 3;
  const cols = [
    { label: 'Total contributions', value: total, sub: 'past year' },
    { label: 'Current streak', value: current, sub: currentRangeLabel || '—', accent: true },
    { label: 'Longest streak', value: longest, sub: longestRangeLabel || '—' },
  ];

  const groups = cols.map((c, i) => {
    const cx = colW * i + colW / 2;
    return `
      <g class="fade d${i + 2}">
        <text x="${cx}" y="70" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="800" fill="${c.accent ? 'url(#accent)' : theme.text}">${escapeXml(String(c.value))}</text>
        <text x="${cx}" y="92" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${theme.dim}">${escapeXml(c.label)}</text>
        <text x="${cx}" y="108" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${theme.faint}">${escapeXml(c.sub)}</text>
      </g>
      ${i > 0 ? `<line x1="${colW * i}" y1="50" x2="${colW * i}" y2="118" stroke="${theme.border}" />` : ''}`;
  }).join('');

  return cardFrame({ width, height, title: `streak/${username}`, body: groups });
}

export default async function handler(req, res) {
  const username = String(req.query.username || '').trim();
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');

  if (!username) { res.status(400); return res.send(errorCard('Add ?username=your-github-handle to the URL')); }
  if (!isValidUsername(username)) { res.status(400); return res.send(errorCard(`"${username}" is not a valid GitHub username`)); }

  try {
    const data = await ghGraphQL(QUERY, { login: username });
    const calendar = data.user.contributionsCollection.contributionCalendar;
    const days = calendar.weeks.flatMap((w) => w.contributionDays);
    const { current, longest, currentRangeLabel, longestRangeLabel } = computeStreaks(days);

    res.status(200);
    return res.send(renderStreakCard({ username, total: calendar.totalContributions, current, longest, currentRangeLabel, longestRangeLabel }));
  } catch (err) {
    const message = err.status === 401
      ? 'Streak card needs a GITHUB_TOKEN set in the project environment'
      : err.status === 404
      ? `User "${username}" not found`
      : 'Could not load contribution data right now';
    res.status(err.status && err.status < 500 ? err.status : 502);
    return res.send(errorCard(message));
  }
}
