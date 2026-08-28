const theme = {
  bg: '#0a0e12', card: '#1a1b27', cardAlt: '#11161c', border: '#555148',
  text: '#d9e2ee', dim: '#8f96a3', faint: '#626a75', blue: '#4ba7f8',
  purple: '#bf5fff', lavender: '#bf91f3', magenta: '#ff5fd1', red: '#ff5f57',
};
const FONT = `'JetBrains Mono','SF Mono','Fira Code',ui-monospace,Consolas,monospace`;

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
    <text x="28" y="39" font-family="${FONT}" font-size="16" font-weight="800" fill="${theme.text}">GitHub Stats</text>
    <line x1="0" y1="61" x2="${width}" y2="61" stroke="${theme.border}" />
    <text x="${width / 2}" y="78" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${theme.dim}">⚠ ${escapeXml(message)}</text>`;
  return cardFrame({ width, height, title: '', body });
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
  const width = 648, height = 234, colW = width / 3;
  const headerY = 39, dividerY = 61;
  const valueY = 114, labelY = 163, subY = 181;
  const circleCy = 112, circleR = 40;
  const cols = [
    { label: 'Total contributions', value: total, sub: 'past year' },
    { label: 'Current streak', value: current, sub: currentRangeLabel || '—' },
    { label: 'Longest streak', value: longest, sub: longestRangeLabel || '—' },
  ];

  const groups = cols.map((c, i) => {
    const cx = colW * i + colW / 2;
    return `
      <g class="fade d${i + 1}">
        ${i === 1 ? `<circle cx="${cx}" cy="${circleCy}" r="${circleR}" fill="none" stroke="${theme.purple}" stroke-width="5" opacity=".95" />` : ''}
        <text x="${cx}" y="${valueY}" text-anchor="middle" font-family="${FONT}" font-size="28" font-weight="800" fill="${i === 1 ? 'url(#accent)' : theme.text}">${escapeXml(String(c.value))}</text>
        <text x="${cx}" y="${labelY}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="${theme.dim}">${escapeXml(c.label)}</text>
        <text x="${cx}" y="${subY}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${theme.faint}">${escapeXml(c.sub)}</text>
      </g>
      ${i > 0 ? `<line x1="${colW * i}" y1="78" x2="${colW * i}" y2="196" stroke="${theme.border}" />` : ''}`;
  }).join('');

  const body = `
    <text x="28" y="39" font-family="${FONT}" font-size="16" font-weight="800" fill="${theme.text}">GitHub Streak</text>
    <text x="${width - 28}" y="39" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.blue}">@${escapeXml(username)}</text>
    <line x1="0" y1="61" x2="${width}" y2="61" stroke="${theme.border}" />
    ${groups}`;

  return cardFrame({ width, height, title: '', body });
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
