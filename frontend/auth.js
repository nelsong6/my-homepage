/* global auth0 */
import { CONFIG } from './config.js';

let auth0Client = null;

export async function initAuth() {
  auth0Client = await auth0.createAuth0Client({
    domain: CONFIG.auth0Domain,
    clientId: CONFIG.auth0ClientId,
    cacheLocation: "localstorage",
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: CONFIG.auth0Audience,
    },
  });

  // Handle redirect callback
  const query = window.location.search;
  if (query.includes("code=") && query.includes("state=")) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  return auth0Client;
}

export async function login() {
  await auth0Client.loginWithRedirect();
}

export async function logout() {
  await auth0Client.logout({
    logoutParams: { returnTo: window.location.origin },
  });
}

export async function getToken() {
  return auth0Client.getTokenSilently({
    authorizationParams: { audience: CONFIG.auth0Audience },
  });
}

export async function isAuthenticated() {
  return auth0Client.isAuthenticated();
}

export async function getUser() {
  return auth0Client.getUser();
}
