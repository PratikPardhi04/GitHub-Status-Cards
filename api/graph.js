const theme = {
  bg: '#0a0e12', card: '#1a1b27', border: '#555148',
  text: '#d9e2ee', dim: '#8f96a3', faint: '#626a75', blue: '#4ba7f8',
  purple1: '#2a1736', purple2: '#59308a', purple3: '#8e4bd8', purple4: '#bf5fff',
};
const FONT = `'JetBrains Mono','SF Mono','Fira Code',ui-monospace,Consolas,monospace`;

function escapeXml(str = '') {
  return String(str).replace(/[<>&'\"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function cardFrame({ width, height, body, radius = 10 }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <style>
      .fade { animation: fadeIn .45s ease-out both; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
    </style>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" fill="${theme.card}" stroke="${theme.border}" />
  ${body}
</svg>`;
}

function errorCard(message, { width = 520, height = 120 } = {}) {
  const body = `
    <text x="24" y="32" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.text}">GitHub Contributions</text>
    <line x1="0" y1="47" x2="${width}" y2="47" stroke="${theme.border}" />
    <text x="${width / 2}" y="80" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${theme.dim}">⚠ ${escapeXml(message)}</text>`;
  return cardFrame({ width, height, body });
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
          weeks {
            firstDay
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

function contributionLevel(count, max) {
  if (count <= 0) return 0;
  if (count >= max * 0.75) return 4;
  if (count >= max * 0.5) return 3;
  if (count >= max * 0.25) return 2;
  return 1;
}

function renderGraphCard({ username, total, weeks }) {
  const width = 520;
  const height = 210;
  const x0 = 32;
  const y0 = 92;
  const cell = 8;
  const gap = 3;
  const step = cell + gap;
  const maxCount = Math.max(1, ...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));

  const months = [];
  let lastMonth = '';
  weeks.forEach((week, i) => {
    const date = new Date(`${week.firstDay}T00:00:00Z`);
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    if (month !== lastMonth) {
      months.push({ label: month, index: i });
      lastMonth = month;
    }
  });

  const monthLabels = months.map(({ label, index }) => `
    <text x="${x0 + index * step}" y="77" font-family="${FONT}" font-size="9" fill="${theme.faint}">${label}</text>`).join('');

  const dayLabels = [
    { label: 'Mon', row: 1 },
    { label: 'Wed', row: 3 },
    { label: 'Fri', row: 5 },
  ].map(({ label, row }) => `
    <text x="6" y="${y0 + row * step + 7}" font-family="${FONT}" font-size="8" fill="${theme.faint}">${label}</text>`).join('');

  const cells = weeks.map((week, col) => week.contributionDays.map((day, row) => {
    const level = contributionLevel(day.contributionCount, maxCount);
    const fill = [theme.cardAlt || '#11161c', theme.purple1, theme.purple2, theme.purple3, theme.purple4][level];
    const x = x0 + col * step;
    const y = y0 + row * step;
    return `<rect class="fade" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}" opacity=".98" />`;
  }).join('')).join('');

  const legendY = 180;
  const legend = [0, 1, 2, 3, 4].map((level) => {
    const fill = [theme.cardAlt || '#11161c', theme.purple1, theme.purple2, theme.purple3, theme.purple4][level];
    return `<rect x="${368 + level * 11}" y="${legendY}" width="8" height="8" rx="2" fill="${fill}" />`;
  }).join('');

  const body = `
    <text x="24" y="32" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.text}">GitHub Contributions</text>
    <text x="${width - 24}" y="32" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.blue}">@${escapeXml(username)}</text>
    <line x1="0" y1="47" x2="${width}" y2="47" stroke="${theme.border}" />
    <text x="24" y="68" font-family="${FONT}" font-size="11" fill="${theme.dim}">${escapeXml(String(total))} contributions in the last year</text>
    ${monthLabels}
    ${dayLabels}
    ${cells}
    <text x="24" y="188" font-family="${FONT}" font-size="9" fill="${theme.faint}">Less</text>
    ${legend}
    <text x="429" y="188" font-family="${FONT}" font-size="9" fill="${theme.faint}">More</text>`;

  return cardFrame({ width, height, body });
}

export default async function handler(req, res) {
  const username = String(req.query.username || '').trim();
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');

  if (!username) {
    res.status(400);
    return res.send(errorCard('Add ?username=your-github-handle to the URL'));
  }
  if (!isValidUsername(username)) {
    res.status(400);
    return res.send(errorCard(`"${username}" is not a valid GitHub username`));
  }

  try {
    const data = await ghGraphQL(QUERY, { login: username });
    const calendar = data.user.contributionsCollection.contributionCalendar;
    res.status(200);
    return res.send(renderGraphCard({
      username,
      total: calendar.totalContributions,
      weeks: calendar.weeks,
    }));
  } catch (err) {
    const message = err.status === 401
      ? 'Contribution graph needs a GITHUB_TOKEN set in the project environment'
      : err.status === 404
      ? `User "${username}" not found`
      : 'Could not load contribution data right now';
    res.status(err.status && err.status < 500 ? err.status : 502);
    return res.send(errorCard(message));
  }
}
