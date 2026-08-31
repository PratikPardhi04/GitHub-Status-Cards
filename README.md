# GitHub card generator

Self-hosted replacement for `github-readme-stats` / `streak-stats` — same idea
(you embed an `<img>` in your profile `README.md` and it renders live GitHub
data as an SVG), but it's your own Vercel deployment instead of a third-party
service, styled to match your portfolio site (dark background, violet →
magenta gradient, JetBrains Mono).

Four endpoints, each a Vercel serverless function:

| Endpoint | Shows | Needs `GITHUB_TOKEN`? |
|---|---|---|
| `/api/stats?username=you` | repos, stars, forks, followers, following, top language | No (works unauthenticated, but rate-limited) |
| `/api/langs?username=you` | your top 6 languages by repo count | No |
| `/api/streak?username=you` | total contributions, current streak, longest streak | **Yes** — contribution data is available via GraphQL |
| `/api/graph?username=you` | profile information + contribution activity graph for the past year | **Yes** — contribution data is available via GraphQL |

## 1. Deploy to Vercel

```bash
npm i -g vercel   # if you don't have it
cd github-card-api
vercel            # deploy a preview
vercel --prod     # promote to production
<img src="https://git-hub-status-cards.vercel.app/api/stats?username=PratikPardhi04" width="48%" />
<img src="https://git-hub-status-cards.vercel.app/api/streak?username=PratikPardhi04" width="48%" />

<br/><br/>

<img src="https://git-hub-status-cards.vercel.app/api/graph?username=PratikPardhi04" width="90%" />

<br/><br/>

<img src="https://git-hub-status-cards.vercel.app/api/langs?username=PratikPardhi04" width="48%" />
