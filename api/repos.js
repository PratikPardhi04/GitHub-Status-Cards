import { cardFrame, escapeXml, fetchAllRepos, FONT, sendError, startResponse, theme } from '../lib/cards.js';

function render(username, repos) {
  const width = 520, rowH = 43, height = 72 + repos.length * rowH;
  const rows = repos.map((repo, index) => { const y = 78 + index * rowH; return `<g class="fade d${Math.min(index + 1, 6)}"><text x="24" y="${y}" font-family="${FONT}" font-size="12" font-weight="700" fill="${theme.text}">${escapeXml(repo.name.slice(0, 32))}</text><text x="24" y="${y + 17}" font-family="${FONT}" font-size="10" fill="${theme.dim}">${escapeXml((repo.description || 'No description').slice(0, 58))}</text><text x="496" y="${y}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.blue}">★ ${repo.stargazers_count} ⑂ ${repo.forks_count}</text></g>`; }).join('');
  return cardFrame({ width, height, body: `<text x="24" y="32" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.text}">Popular Repositories</text><text x="496" y="32" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.blue}">@${escapeXml(username)}</text><line x1="0" y1="47" x2="520" y2="47" stroke="${theme.border}" />${rows}` });
}

export default async function handler(req, res) {
  const result = startResponse(req, res, 'Popular Repositories');
  if (result.card) return res.send(result.card);
  try { const repos = (await fetchAllRepos(result.username)).filter((repo) => !repo.fork).sort((a, b) => (b.stargazers_count - a.stargazers_count) || (b.forks_count - a.forks_count)).slice(0, 3); return res.status(200).send(render(result.username, repos)); }
  catch (error) { return sendError(res, error, result.username, 'Popular Repositories', 'Could not load repositories right now'); }
}