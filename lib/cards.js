import { theme, escapeXml, cardFrame, FONT } from './theme.js';

// Rough color map for common languages — falls back to violet for anything unlisted.
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', C: '#555555', 'C#': '#178600', HTML: '#e34c26', CSS: '#563d7c',
  Go: '#00ADD8', Rust: '#dea584', PHP: '#4F5D95', Ruby: '#701516', Swift: '#F05138',
  Kotlin: '#A97BFF', Shell: '#89e051', Vue: '#41b883', Dart: '#00B4AB', Jupyter: '#DA5B0B',
};
const langColor = (lang) => LANG_COLORS[lang] || theme.violet;

// ---------------------------------------------------------------- stats card
export function renderStatsCard({ username, name, stats }) {
  const width = 480;
  const cols = 3;
  const rows = Math.ceil(stats.length / cols);
  const cellW = (width - 40) / cols;
  const cellH = 62;
  const top = 56;
  const height = top + rows * cellH + 20;

  const cells = stats
    .map((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 20 + col * cellW;
      const y = top + row * cellH;
      return `
      <g class="fade d${i + 1}">
        <text x="${x}" y="${y + 16}" font-family="${FONT}" font-size="11" fill="${theme.dim}">${escapeXml(s.label)}</text>
        <text x="${x}" y="${y + 38}" font-family="${FONT}" font-size="20" font-weight="700" fill="url(#accent)">${escapeXml(String(s.value))}</text>
      </g>`;
    })
    .join('');

  const body = `
    <text x="20" y="${top - 18}" font-family="${FONT}" font-size="13" fill="${theme.text}" font-weight="700">${escapeXml(name || username)}</text>
    <text x="${width - 20}" y="${top - 18}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.faint}">@${escapeXml(username)}</text>
    ${cells}`;

  return cardFrame({ width, height, title: `github-stats/${username}`, body });
}

// ------------------------------------------------------------- langs card
export function renderLangsCard({ username, languages }) {
  const width = 480;
  const barX = 20;
  const barW = width - 40;
  const rowH = 30;
  const top = 56;
  const height = top + languages.length * rowH + 20;

  const total = languages.reduce((s, l) => s + l.count, 0) || 1;

  const rows = languages
    .map((l, i) => {
      const y = top + i * rowH;
      const pct = Math.round((l.count / total) * 100);
      const fillW = Math.max(4, (barW * l.count) / total);
      return `
      <g class="fade d${Math.min(i + 1, 6)}">
        <text x="${barX}" y="${y - 4}" font-family="${FONT}" font-size="11" fill="${theme.text}">${escapeXml(l.name)}</text>
        <text x="${barX + barW}" y="${y - 4}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.faint}">${pct}%</text>
        <rect x="${barX}" y="${y}" width="${barW}" height="8" rx="4" fill="${theme.border}" />
        <rect x="${barX}" y="${y}" width="${fillW}" height="8" rx="4" fill="${langColor(l.name)}" />
      </g>`;
    })
    .join('');

  return cardFrame({ width, height, title: `top-langs/${username}`, body: rows });
}

// ------------------------------------------------------------ streak card
export function renderStreakCard({ username, total, current, longest, currentRangeLabel, longestRangeLabel }) {
  const width = 480;
  const height = 140;
  const colW = width / 3;
  const cols = [
    { label: 'Total contributions', value: total, sub: 'past year' },
    { label: 'Current streak', value: current, sub: currentRangeLabel || '—', accent: true },
    { label: 'Longest streak', value: longest, sub: longestRangeLabel || '—' },
  ];

  const groups = cols
    .map((c, i) => {
      const cx = colW * i + colW / 2;
      return `
      <g class="fade d${i + 2}">
        <text x="${cx}" y="70" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="800" fill="${c.accent ? 'url(#accent)' : theme.text}">${escapeXml(String(c.value))}</text>
        <text x="${cx}" y="92" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${theme.dim}">${escapeXml(c.label)}</text>
        <text x="${cx}" y="108" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${theme.faint}">${escapeXml(c.sub)}</text>
      </g>
      ${i > 0 ? `<line x1="${colW * i}" y1="50" x2="${colW * i}" y2="118" stroke="${theme.border}" />` : ''}`;
    })
    .join('');

  return cardFrame({ width, height, title: `streak/${username}`, body: groups });
}
