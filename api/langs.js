import { fetchAllRepos, isValidUsername } from '../lib/github.js';
import { errorCard } from '../lib/theme.js';
import { renderLangsCard } from '../lib/cards.js';

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
    const repos = await fetchAllRepos(username);
    const owned = repos.filter((r) => !r.fork);

    // Approximate by repo count per language (byte-accurate would need one
    // extra API call per repo, which isn't worth the rate-limit cost here).
    const counts = {};
    for (const r of owned) if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;

    const languages = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

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
