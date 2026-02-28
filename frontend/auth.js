import { CONFIG } from './config.js';

const TOKEN_KEY = 'auth_token';

/**
 * Initialise auth by checking for a token in the URL fragment.
 * Called once on page load.
 */
export function initAuth() {
  const hash = window.location.hash;
  if (hash.startsWith('#token=')) {
    const token = hash.slice('#token='.length);
    localStorage.setItem(TOKEN_KEY, token);
    // Clean the URL so the token isn't visible or bookmarkable
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

/**
 * Redirect to the backend OAuth endpoint for the given provider.
 * @param {'github'|'google'|'microsoft'|'apple'} provider
 */
export function login(provider) {
  const redirectUri = encodeURIComponent(window.location.origin);
  window.location.href = `${CONFIG.apiUrl}/auth/${provider}?redirect_uri=${redirectUri}`;
}

/** Clear the stored token and reload. */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.reload();
}

/** Return the stored JWT, or null. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Check whether a non-expired JWT is stored. */
export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = parseJwtPayload(token);
    // exp is in seconds
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/** Decode the JWT payload (no signature verification — that's the backend's job). */
export function getUser() {
  const token = getToken();
  if (!token) return null;
  try {
    return parseJwtPayload(token);
  } catch {
    return null;
  }
}

function parseJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload));
}
