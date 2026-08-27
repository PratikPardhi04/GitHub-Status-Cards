import { ghGraphQL, isValidUsername } from '../lib/github.js';
import { errorCard } from '../lib/theme.js';
import { renderStreakCard } from '../lib/cards.js';

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { date contributionCount }
          }
        }
      }
    }
  }
`;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeStreaks(days) {
  // days: ascending [{date, contributionCount}]
  let longest = 0;
  let run = 0;
  let longestEnd = null;
  let longestStart = null;
  let runStart = null;

  for (const d of days) {
    if (d.contributionCount > 0) {
      if (run === 0) runStart = d.date;
      run++;
      if (run > longest) {
        longest = run;
        longestStart = runStart;
        longestEnd = d.date;
      }
    } else {
      run = 0;
    }
  }

  // Current streak: walk backward from the most recent day. A contribution-free
  // "today" doesn't break an in-progress streak, since the day isn't over yet.
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  let current = 0;
  let currentEnd = i >= 0 ? days[i].date : null;
  let currentStart = currentEnd;
  while (i >= 0 && days[i].contributionCount > 0) {
    current++;
    currentStart = days[i].date;
    i--;
  }

  return {
    current,
    longest,
    currentRangeLabel: current > 0 ? `${formatDate(currentStart)} – ${formatDate(currentEnd)}` : 'no active streak',
    longestRangeLabel: longest > 0 ? `${formatDate(longestStart)} – ${formatDate(longestEnd)}` : '—',
  };
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
    const days = calendar.weeks.flatMap((w) => w.contributionDays);
    const { current, longest, currentRangeLabel, longestRangeLabel } = computeStreaks(days);

    res.status(200);
    return res.send(
      renderStreakCard({
        username,
        total: calendar.totalContributions,
        current,
        longest,
        currentRangeLabel,
        longestRangeLabel,
      })
    );
  } catch (err) {
    const message =
      err.status === 401
        ? 'Streak card needs a GITHUB_TOKEN set in the project environment'
        : err.status === 404
        ? `User "${username}" not found`
        : 'Could not load contribution data right now';
    res.status(err.status && err.status < 500 ? err.status : 502);
    return res.send(errorCard(message));
  }
}
