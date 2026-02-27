resource "azurerm_static_web_app" "homepage" {
  name                = "homepage-app"
  resource_group_name = azurerm_resource_group.homepage.name
  location            = azurerm_resource_group.homepage.location
  sku_tier            = "Free"
  sku_size            = "Free"
  lifecycle {
    ignore_changes = [
      repository_url,
      repository_branch
    ]
  }
}

locals {
  front_app_dns_name = "homepage"
}

resource "azurerm_dns_cname_record" "homepage" {
  name                = local.front_app_dns_name
  zone_name           = local.infra.dns_zone_name
  resource_group_name = local.infra.resource_group_name
  ttl                 = 3600
  record              = azurerm_static_web_app.homepage.default_host_name
}

resource "azurerm_static_web_app_custom_domain" "homepage" {
  static_web_app_id = azurerm_static_web_app.homepage.id
  domain_name       = "${local.front_app_dns_name}.${local.infra.dns_zone_name}"
  validation_type   = "cname-delegation"
  depends_on        = [azurerm_dns_cname_record.homepage]
}

resource "azapi_update_resource" "homepage_default_domain" {
  type        = "Microsoft.Web/staticSites/customDomains@2024-04-01"
  resource_id = azurerm_static_web_app_custom_domain.homepage.id

  body = {
    properties = {
      isDefault = true
    }
  }
}

# ============================================================================
# Auth0 Social Connection Links
# ============================================================================
# Link tenant-level social connections (from infra-bootstrap) to this SPA.
# This makes the login buttons appear on the Universal Login page.

resource "auth0_connection_clients" "github_spa" {
  connection_id   = local.infra.auth0_connection_github_id
  enabled_clients = [auth0_client.frontend_spa.id]
}

resource "auth0_connection_clients" "google_spa" {
  connection_id   = local.infra.auth0_connection_google_id
  enabled_clients = [auth0_client.frontend_spa.id]
}

import {
  to = auth0_connection_clients.google_spa
  id = "con_kZUpzua9TliVC2QK"
}

resource "auth0_connection_clients" "apple_spa" {
  connection_id   = local.infra.auth0_connection_apple_id
  enabled_clients = [auth0_client.frontend_spa.id]
}

resource "auth0_connection_clients" "microsoft_spa" {
  connection_id   = local.infra.auth0_connection_microsoft_id
  enabled_clients = [auth0_client.frontend_spa.id]
}

# ============================================================================
# Auth0 Frontend SPA Client
# ============================================================================

resource "auth0_client" "frontend_spa" {
  name           = "homepage.romaine.life"
  app_type       = "spa"
  is_first_party = true
  callbacks = [
    "http://localhost:3000",
    "http://localhost:5500",
    "https://${local.front_app_dns_name}.${local.infra.dns_zone_name}"
  ]
  allowed_logout_urls = [
    "http://localhost:3000",
    "http://localhost:5500",
    "https://${local.front_app_dns_name}.${local.infra.dns_zone_name}"
  ]
  web_origins = [
    "http://localhost:3000",
    "http://localhost:5500",
    "https://${local.front_app_dns_name}.${local.infra.dns_zone_name}"
  ]
  jwt_configuration {
    alg = "RS256"
  }
  grant_types = [
    "authorization_code",
    "implicit",
    "refresh_token"
  ]
}
