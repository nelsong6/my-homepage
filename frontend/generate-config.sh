#!/bin/bash
# Generates frontend/config.js from environment variables.
#
# Usage (local dev):
#   source backend/.env     # or export the vars manually
#   export AUTH0_DOMAIN="auth.yourdomain.com"
#   export AUTH0_CLIENT_ID="<your-client-id>"
#   export AUTH0_AUDIENCE="https://homepage.api.yourdomain.com"
#   export API_URL="https://homepage.api.yourdomain.com"
#   bash frontend/generate-config.sh
#
# Optional bypass variables (set in CI/CD for corporate firewall workaround):
#   export AUTH0_CANONICAL_DOMAIN="dev-xxx.us.auth0.com"
#   export API_BYPASS_URL="https://app.region.azurecontainerapps.io"
#
# In the CI/CD pipeline, these variables should be set from Terraform outputs
# or Azure App Configuration before this script runs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

: "${AUTH0_DOMAIN:?ERROR: AUTH0_DOMAIN is not set}"
: "${AUTH0_CLIENT_ID:?ERROR: AUTH0_CLIENT_ID is not set}"
: "${AUTH0_AUDIENCE:?ERROR: AUTH0_AUDIENCE is not set}"
: "${API_URL:?ERROR: API_URL is not set}"

# Bypass URLs fall back to the primary values when not set (local dev).
BYPASS_AUTH0="${AUTH0_CANONICAL_DOMAIN:-${AUTH0_DOMAIN}}"
BYPASS_API="${API_BYPASS_URL:-${API_URL}}"

cat <<EOF > "$SCRIPT_DIR/config.js"
const _isBypass = window.location.hostname.includes("azurestaticapps.net");

export const CONFIG = {
  auth0Domain: _isBypass ? "${BYPASS_AUTH0}" : "${AUTH0_DOMAIN}",
  auth0ClientId: "${AUTH0_CLIENT_ID}",
  auth0Audience: "${AUTH0_AUDIENCE}",
  apiUrl: _isBypass ? "${BYPASS_API}" : "${API_URL}",
};
EOF

echo "Successfully generated $SCRIPT_DIR/config.js"
