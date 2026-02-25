import { auth } from 'express-oauth2-jwt-bearer';

/**
 * Creates the Auth0 JWT validation middleware.
 *
 * Must be called after Azure App Configuration values are fetched,
 * because auth() is a synchronous factory that reads its arguments immediately.
 *
 * @param {{ auth0Domain: string, auth0Audience: string }} config
 * @returns {import('express').RequestHandler}
 */
export function createRequireAuth({ auth0Domain, auth0Audience }) {
  return auth({
    audience: auth0Audience,
    issuerBaseURL: `https://${auth0Domain}/`,
    tokenSigningAlg: 'RS256',
  });
}
