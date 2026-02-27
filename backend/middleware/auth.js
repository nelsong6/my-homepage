import { auth } from 'express-oauth2-jwt-bearer';

/**
 * Creates Auth0 JWT validation middleware that accepts tokens issued by
 * either the custom domain or the canonical tenant domain. This is needed
 * because corporate firewalls may block the custom domain, forcing the
 * frontend to authenticate via the canonical Auth0 URL instead.
 *
 * @param {{ auth0Domain: string, auth0CanonicalDomain: string, auth0Audience: string }} config
 * @returns {import('express').RequestHandler}
 */
export function createRequireAuth({ auth0Domain, auth0CanonicalDomain, auth0Audience }) {
  const customDomainAuth = auth({
    audience: auth0Audience,
    issuerBaseURL: `https://${auth0Domain}/`,
    tokenSigningAlg: 'RS256',
  });

  const canonicalDomainAuth = auth({
    audience: auth0Audience,
    issuerBaseURL: `https://${auth0CanonicalDomain}/`,
    tokenSigningAlg: 'RS256',
  });

  return (req, res, next) => {
    customDomainAuth(req, res, (err) => {
      if (err) {
        canonicalDomainAuth(req, res, next);
      } else {
        next();
      }
    });
  };
}
