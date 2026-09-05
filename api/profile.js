import { cardFrame, escapeXml, FONT, ghREST, sendError, startResponse, theme } from '../lib/cards.js';

function render(username, user) {
  const width = 520, height = 210;
  const stats = [['Public repos', user.public_repos], ['Followers', user.followers], ['Following', user.following]].map(([label, value], index) => { const x = 110 + index * 155; return `<g class="fade d${index + 1}"><text x="${x}" y="165" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="url(#accent)">${value}</text><text x="${x}" y="185" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${theme.dim}">${label}</text></g>`; }).join('');
  const location = user.location ? ` · ${user.location}` : '';
  const body = `<text x="24" y="32" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.text}">GitHub Profile</text><text x="496" y="32" text-anchor="end" font-family="${FONT}" font-size="11" fill="${theme.blue}">@${escapeXml(username)}</text><line x1="0" y1="47" x2="520" y2="47" stroke="${theme.border}" /><text x="38" y="88" font-family="${FONT}" font-size="22" font-weight="800" fill="${theme.text}">${escapeXml(user.name || user.login)}</text><text x="38" y="112" font-family="${FONT}" font-size="12" fill="${theme.blue}">${escapeXml(`@${user.login}${location}`)}</text><text x="38" y="137" font-family="${FONT}" font-size="11" fill="${theme.dim}">${escapeXml((user.bio || 'Building in public').slice(0, 68))}</text>${stats}`;
  return cardFrame({ width, height, body });
}

export default async function handler(req, res) {
  const result = startResponse(req, res, 'GitHub Profile');
  if (result.card) return res.send(result.card);
  try { return res.status(200).send(render(result.username, await ghREST(`/users/${encodeURIComponent(result.username)}`))); }
  catch (error) { return sendError(res, error, result.username, 'GitHub Profile', 'Could not load profile data right now'); }
}