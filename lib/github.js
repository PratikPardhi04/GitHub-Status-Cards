const REST_BASE = 'https://api.github.com';
const GRAPHQL_URL = 'https://api.github.com/graphql';
const UA = 'github-card-generator';

function authHeaders(extra = {}) {
  const headers = { 'User-Agent': UA, ...extra };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// Basic GitHub username validation: 1-39 chars, alphanumeric or single hyphens.
export function isValidUsername(username) {
  return /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(username);
}

export async function ghREST(path) {
  const res = await fetch(`${REST_BASE}${path}`, {
    headers: authHeaders({ Accept: 'application/vnd.github+json' }),
  });
  if (!res.ok) {
    const err = new Error(`GitHub REST ${res.status} for ${path}`);
    err.status = res.status === 404 ? 404 : res.status === 403 ? 429 : 502;
    throw err;
  }
  return res.json();
}

export async function ghGraphQL(query, variables) {
  if (!process.env.GITHUB_TOKEN) {
    const err = new Error('This card needs a GITHUB_TOKEN set on the server.');
    err.status = 401;
    throw err;
  }
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    const notFound = json.errors.some(e => /could not resolve to a user/i.test(e.message));
    const err = new Error(json.errors.map(e => e.message).join('; '));
    err.status = notFound ? 404 : 502;
    throw err;
  }
  return json.data;
}

// Fetch every owned repo for a user (paginated, capped to keep serverless calls bounded).
export async function fetchAllRepos(username, maxPages = 3) {
  let repos = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await ghREST(
      `/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&type=owner&sort=updated`
    );
    repos = repos.concat(batch);
    if (batch.length < 100) break;
  }
  return repos;
}
