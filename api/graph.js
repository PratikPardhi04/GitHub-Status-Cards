const theme = {
  bg: '#0a0e12',
  card: '#1a1b27',
  border: '#555148',
  text: '#e7edf7',
  dim: '#8f96a3',
  blue: '#4aa8ff',
  cyan: '#1fd6c1',
  violet: '#b37cf0',
  violetDark: '#8f63c6',
};

const FONT = `'JetBrains Mono','SF Mono','Fira Code',ui-monospace,Consolas,monospace`;

function escapeXml(str = '') {
  return String(str).replace(/[<>&'\"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[c]));
}

function safeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return escapeXml(text || fallback);
}

function cardFrame({ width, height, body }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <style>
      .fade { animation: fadeIn .55s ease-out both; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    </style>
    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.violet}" stop-opacity="0.98" />
      <stop offset="100%" stop-color="${theme.violetDark}" stop-opacity="0.88" />
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${theme.card}" stroke="${theme.border}" />
  ${body}
</svg>`;
}

function errorCard(message, { width = 960, height = 270 } = {}) {
  const body = `
    <text x="40" y="58" font-family="${FONT}" font-size="27" font-weight="700" fill="${theme.blue}">GitHub Contributions</text>
    <line x1="0" y1="76" x2="${width}" y2="76" stroke="${theme.border}" />
    <text x="${width / 2}" y="${height / 2 + 8}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="${theme.dim}">⚠ ${escapeXml(message)}</text>`;
  return cardFrame({ width, height, body });
}

function isValidUsername(username) {
  return /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(username);
}

async function ghREST(path) {
  const headers = {
    'User-Agent': 'github-card-generator',
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const err = new Error(`GitHub REST ${res.status}`);
    err.status = res.status === 404 ? 404 : res.status === 403 ? 429 : 502;
    throw err;
  }
  return res.json();
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

const CONTRIBUTIONS_QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
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

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatJoined(createdAt) {
  if (!createdAt) return '—';
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '—';

  const now = new Date();
  let years = now.getUTCFullYear() - created.getUTCFullYear();
  const anniversaryPassed =
    now.getUTCMonth() > created.getUTCMonth() ||
    (now.getUTCMonth() === created.getUTCMonth() && now.getUTCDate() >= created.getUTCDate());
  if (!anniversaryPassed) years -= 1;

  if (years >= 1) return `Joined GitHub ${years} year${years === 1 ? '' : 's'} ago`;

  const months = Math.max(1,
    (now.getUTCFullYear() - created.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - created.getUTCMonth())
  );
  return `Joined GitHub ${months} month${months === 1 ? '' : 's'} ago`;
}

function buildChart(days, x, y, width, height) {
  if (!days.length) {
    return { area: '', line: '', labels: '', max: 0 };
  }

  const bins = 12;
  const chunkSize = Math.ceil(days.length / bins);
  const values = [];

  for (let i = 0; i < bins; i += 1) {
    const chunk = days.slice(i * chunkSize, (i + 1) * chunkSize);
    const total = chunk.reduce((sum, d) => sum + Number(d.contributionCount || 0), 0);
    values.push(total);
  }

  const max = Math.max(1, ...values);
  const points = values.map((value, i) => {
    const px = x + (i / (values.length - 1)) * width;
    const py = y + height - (value / max) * height;
    return [px, py];
  });

  let lineD = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const mid = (x1 + x2) / 2;
    lineD += ` C ${mid.toFixed(1)} ${y1.toFixed(1)}, ${mid.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

  const areaD = `${lineD} L ${(x + width).toFixed(1)} ${(y + height).toFixed(1)} L ${x.toFixed(1)} ${(y + height).toFixed(1)} Z`;

  const lastDay = days[days.length - 1]?.date || '';
  const lastDate = lastDay ? new Date(`${lastDay}T00:00:00Z`) : new Date();
  const startDate = new Date(lastDate);
  startDate.setUTCDate(startDate.getUTCDate() - 365);

  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setUTCDate(startDate.getUTCDate() + Math.round((365 * i) / 6));
    const px = x + (i / 6) * width;
    const label = `${String(d.getUTCFullYear()).slice(2)}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return `<text x="${px.toFixed(1)}" y="${y + height + 21}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${theme.cyan}">${label}</text>`;
  }).join('');

  return {
    area: `<path d="${areaD}" fill="url(#areaFill)" />`,
    line: `<path d="${lineD}" fill="none" stroke="${theme.violet}" stroke-width="1.6" />`,
    labels,
    max,
  };
}

function renderGraphCard({ username, name, total, publicRepos, createdAt, location, days }) {
  const width = 960;
  const height = 314;
  const chartX = 365;
  const chartY = 76;
  const chartW = 565;
  const chartH = 188;
  const chart = buildChart(days, chartX, chartY, chartW, chartH);

  const title = String(name || username).trim();
  const shortUsername = username.length > 16 ? `${username.slice(0, 16)}…` : username;

  const y0 = 133;
  const rowGap = 43;

  const iconGithub = `
    <circle cx="48" cy="${y0 - 5}" r="11" fill="none" stroke="${theme.violet}" stroke-width="2.4" />
    <path d="M42 ${y0 - 7} a7 7 0 1 0 12 0 c0 4-2 7-6 7s-6-3-6-7z" fill="${theme.violet}" />`;
  const iconRepo = `
    <rect x="40" y="${y0 + rowGap - 16}" width="16" height="13" rx="2" fill="none" stroke="${theme.violet}" stroke-width="2" />
    <path d="M44 ${y0 + rowGap - 3} v5 l4-2 4 2 v-5" fill="none" stroke="${theme.violet}" stroke-width="2" />`;
  const iconClock = `
    <circle cx="48" cy="${y0 + rowGap * 2 - 5}" r="10" fill="none" stroke="${theme.violet}" stroke-width="2.4" />
    <path d="M48 ${y0 + rowGap * 2 - 5} v-6 M48 ${y0 + rowGap * 2 - 5} l5 3" stroke="${theme.violet}" stroke-width="2" stroke-linecap="round" />`;
  const iconPin = `
    <path d="M48 ${y0 + rowGap * 3 - 15} c-6 0-10 4.2-10 9 0 6.8 10 15 10 15s10-8.2 10-15c0-4.8-4-9-10-9z" fill="none" stroke="${theme.violet}" stroke-width="2.2" />
    <circle cx="48" cy="${y0 + rowGap * 3 - 6}" r="3" fill="${theme.violet}" />`;

  const body = `
    <g class="fade">
      <text x="48" y="73" font-family="${FONT}" font-size="28" font-weight="700" fill="${theme.blue}">${safeText(title)} <tspan font-weight="700">(${safeText(shortUsername)})</tspan></text>
    </g>

    <g class="fade" style="animation-delay:.08s">
      ${iconGithub}
      <text x="68" y="${y0}" font-family="${FONT}" font-size="18" fill="${theme.cyan}">${safeText(total, '0')} Contributions on GitHub</text>
    </g>
    <g class="fade" style="animation-delay:.15s">
      ${iconRepo}
      <text x="68" y="${y0 + rowGap}" font-family="${FONT}" font-size="18" fill="${theme.cyan}">${safeText(publicRepos, '0')} Public Repos</text>
    </g>
    <g class="fade" style="animation-delay:.22s">
      ${iconClock}
      <text x="68" y="${y0 + rowGap * 2}" font-family="${FONT}" font-size="18" fill="${theme.cyan}">${safeText(formatJoined(createdAt))}</text>
    </g>
    <g class="fade" style="animation-delay:.29s">
      ${iconPin}
      <text x="68" y="${y0 + rowGap * 3}" font-family="${FONT}" font-size="18" fill="${theme.cyan}">${safeText(location, 'Location not set')}</text>
    </g>

    <g class="fade" style="animation-delay:.18s">
      <text x="${chartX + chartW / 2}" y="48" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${theme.cyan}">contributions in the last year</text>
      ${chart.area}
      ${chart.line}
      <line x1="${chartX + chartW}" y1="${chartY}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="${theme.cyan}" stroke-width="1" />
      ${Array.from({ length: 7 }, (_, i) => {
        const tickValue = Math.round((chart.max * i) / 6);
        const ty = chartY + chartH - (chartH * i / 6);
        return `<line x1="${chartX + chartW - 6}" y1="${ty.toFixed(1)}" x2="${chartX + chartW}" y2="${ty.toFixed(1)}" stroke="${theme.cyan}" stroke-width="1" />`
          + `<text x="${chartX + chartW + 12}" y="${(ty + 4).toFixed(1)}" font-family="${FONT}" font-size="11" fill="${theme.cyan}">${tickValue}</text>`;
      }).join('')}
      ${chart.labels}
    </g>`;

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
    const [user, contributionData] = await Promise.all([
      ghREST(`/users/${encodeURIComponent(username)}`),
      ghGraphQL(CONTRIBUTIONS_QUERY, { login: username }),
    ]);

    const calendar = contributionData.user.contributionsCollection.contributionCalendar;
    const days = calendar.weeks.flatMap((week) => week.contributionDays);

    res.status(200);
    return res.send(renderGraphCard({
      username: user.login,
      name: user.name,
      total: calendar.totalContributions,
      publicRepos: user.public_repos,
      createdAt: user.created_at,
      location: user.location,
      days,
    }));
  } catch (err) {
    const message = err.status === 401
      ? 'This card needs a GITHUB_TOKEN set in the project environment'
      : err.status === 404
      ? `User "${username}" not found`
      : 'Could not load GitHub profile data right now';
    res.status(err.status && err.status < 500 ? err.status : 502);
    return res.send(errorCard(message));
  }
}
