/* global auth0, CONFIG */

let auth0Client = null;

async function initAuth() {
  auth0Client = await auth0.createAuth0Client({
    domain: CONFIG.auth0Domain,
    clientId: CONFIG.auth0ClientId,
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

async function login() {
  await auth0Client.loginWithRedirect();
}

async function logout() {
  await auth0Client.logout({
    logoutParams: { returnTo: window.location.origin },
  });
}

async function getToken() {
  return auth0Client.getTokenSilently({
    authorizationParams: { audience: CONFIG.auth0Audience },
  });
}

async function isAuthenticated() {
  return auth0Client.isAuthenticated();
}

async function getUser() {
  return auth0Client.getUser();
}
