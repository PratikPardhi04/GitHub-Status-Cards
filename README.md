# GitHub card generator

Self-hosted replacement for `github-readme-stats` / `streak-stats` — same idea
(you embed an `<img>` in your profile `README.md` and it renders live GitHub
data as an SVG), but it's your own Vercel deployment instead of a third-party
service, styled to match your portfolio site (dark background, violet →
magenta gradient, JetBrains Mono).

Three endpoints, each a Vercel serverless function:

| Endpoint | Shows | Needs `GITHUB_TOKEN`? |
|---|---|---|
| `/api/stats?username=you` | repos, stars, forks, followers, following, top language | No (works unauthenticated, but rate-limited) |
| `/api/langs?username=you` | your top 6 languages by repo count | No |
| `/api/streak?username=you` | total contributions, current streak, longest streak | **Yes** — contribution data is only available via GraphQL |

## 1. Deploy to Vercel

```bash
npm i -g vercel   # if you don't have it
cd github-card-api
vercel            # deploy a preview
vercel --prod     # promote to production
```

Or push this folder to a GitHub repo and import it at vercel.com/new —
no build command needed, it's picked up automatically as serverless functions.

## 2. Add a GITHUB_TOKEN (recommended for all cards, required for streak)

Unauthenticated GitHub API calls are capped at 60 requests/hour **per IP**,
and Vercel functions share IPs across a lot of traffic — so without a token
you'll get rate-limited fast and see the "could not load" error card.

1. Create a token: https://github.com/settings/tokens → "Generate new token
   (classic)" → no scopes needed for public data, just create it.
2. In your Vercel project: **Settings → Environment Variables** → add
   `GITHUB_TOKEN` with that value → redeploy.

The token never needs to touch your README or client-side code — it's read
server-side only, inside the function.

## 3. Embed the cards in your profile README

Once deployed you'll have a URL like `https://your-project.vercel.app`.
Replace the old third-party image links with:

```md
<img src="https://your-project.vercel.app/api/stats?username=PratikPardhi04" width="48%" />
<img src="https://your-project.vercel.app/api/streak?username=PratikPardhi04" width="48%" />
<img src="https://your-project.vercel.app/api/langs?username=PratikPardhi04" width="45%" />
```

Any GitHub username works as the query param — so this same deployment can
generate a card for anyone, not just you (that's what "using GitHub data for
the requesting user" means here: the card is built at request time from
whatever `?username=` is passed in).

## Notes / limitations

- **Top language** is approximated by number of repos per language, not
  bytes of code — a byte-accurate version needs one extra API call per repo,
  which isn't worth the added rate-limit cost for a personal card.
- Cards are cached for an hour (`Cache-Control: s-maxage=3600`) so repeat
  views don't re-hit the GitHub API every time your README is loaded.
- If a username doesn't exist or the API call fails, the endpoint still
  returns a valid SVG (a small error card) instead of a broken image, so
  your README never shows a broken-image icon.
