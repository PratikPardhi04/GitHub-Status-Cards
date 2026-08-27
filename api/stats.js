import { ghREST, fetchAllRepos, isValidUsername } from '../lib/github.js';
import { errorCard } from '../lib/theme.js';
import { renderStatsCard } from '../lib/cards.js';

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
    const [user, repos] = await Promise.all([
      ghREST(`/users/${encodeURIComponent(username)}`),
      fetchAllRepos(username),
    ]);

    const owned = repos.filter((r) => !r.fork);
    const totalStars = owned.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const totalForks = owned.reduce((sum, r) => sum + (r.forks_count || 0), 0);

    const langCounts = {};
    for (const r of owned) if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const stats = [
      { label: 'Public repos', value: user.public_repos },
      { label: 'Total stars', value: totalStars },
      { label: 'Total forks', value: totalForks },
      { label: 'Followers', value: user.followers },
      { label: 'Following', value: user.following },
      { label: 'Top language', value: topLang },
    ];

    res.status(200);
    return res.send(renderStatsCard({ username: user.login, name: user.name, stats }));
  } catch (err) {
    const message = err.status === 404 ? `User "${username}" not found` : 'Could not load GitHub stats right now';
    res.status(err.status && err.status < 500 ? err.status : 502);
    return res.send(errorCard(message));
  }
}
