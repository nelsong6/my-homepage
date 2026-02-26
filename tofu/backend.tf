# ============================================================================
# Azure Container Apps (Serverless Container Hosting)
# ============================================================================

locals {
  back_app_dns_name = "${local.front_app_dns_name}.api"
}

# Container App for the backend API
resource "azurerm_container_app" "homepage_api" {
  for_each = toset(["homepage-api"]) # Add more backend APIs here if needed
  name                         = each.key
  resource_group_name          = azurerm_resource_group.homepage.name
  container_app_environment_id = var.container_app_environment_id
  revision_mode                = "Single"

  # Enable system-assigned managed identity
  identity {
    type = "SystemAssigned"
  }

  # Container configuration
  template {
    container {
      name   = each.key
      image  = "ghcr.io/nelsong6/${terraform.workspace}/${each.key}:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "AZURE_APP_CONFIG_ENDPOINT"
        value = var.azure_app_config_endpoint
      }

      env {
        name  = "APP_CONFIG_PREFIX"
        value = local.front_app_dns_name
      }
    }

    min_replicas = 0 # Scale to zero when not in use
    max_replicas = 3
  }

  # Ingress configuration
  ingress {
    external_enabled = true
    target_port      = 3000

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }

    cors {
      allowed_origins = [
        # Production: Default Azure hostname
        "https://${azurerm_static_web_app.homepage.default_host_name}",
        "https://${local.front_app_dns_name}.${var.dns_zone_name}",

        # Development: Localhost
        "http://localhost:3000",
        "http://localhost:5500"
      ]

      allowed_methods           = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
      allowed_headers           = ["*"]
      exposed_headers           = ["*"]
      max_age_in_seconds        = 3600
      allow_credentials_enabled = true
    }
  }
}

# Grant Container App managed identity access to Cosmos DB
resource "azurerm_cosmosdb_sql_role_assignment" "container_app_cosmos" {
  resource_group_name = var.resource_group_name
  account_name        = var.cosmos_db_account_name
  role_definition_id  = "${var.cosmos_db_account_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002" # Built-in Data Contributor
  principal_id        = azurerm_container_app.homepage_api[0].identity[0].principal_id
  scope               = var.cosmos_db_account_id
}

# Grant Container App managed identity read access to Azure App Configuration
resource "azurerm_role_assignment" "container_app_appconfig_reader" {
  scope                = var.azure_app_config_resource_id
  role_definition_name = "App Configuration Data Reader"
  principal_id         = azurerm_container_app.homepage_api[0].identity[0].principal_id
}

# 1. The Verification Record (Proves to Azure you own the domain)
resource "azurerm_dns_txt_record" "homepage_api_verification" {
  name                = "asuid.${local.back_app_dns_name}"
  zone_name           = var.dns_zone_name
  resource_group_name = var.resource_group_name
  ttl                 = 3600

  record {
    value = azurerm_container_app.homepage_api[0].custom_domain_verification_id
  }
}

# 2. The Routing Record (Points to the container ingress)
resource "azurerm_dns_cname_record" "homepage_api" {
  name                = local.back_app_dns_name
  zone_name           = var.dns_zone_name
  resource_group_name = var.resource_group_name
  ttl                 = 3600
  record              = azurerm_container_app.homepage_api[0].ingress[0].fqdn
}

# 3. The Custom Domain (Unsecured initially)
resource "azurerm_container_app_custom_domain" "homepage_api" {
  name             = "${local.back_app_dns_name}.${var.dns_zone_name}"
  container_app_id = azurerm_container_app.homepage_api[0].id

  # We must completely omit the certificate binding fields and tell Terraform
  # to ignore them, so it doesn't destroy the cert once Azure generates it.
  lifecycle {
    ignore_changes = [
      certificate_binding_type,
      container_app_environment_certificate_id
    ]
  }

  depends_on = [
    azurerm_dns_txt_record.homepage_api_verification,
    azurerm_dns_cname_record.homepage_api
  ]
}

# 4. The Auth0 Resource Server
resource "auth0_resource_server" "backend_api" {
  name        = "My Homepage Backend API"
  identifier  = "https://${local.back_app_dns_name}.${var.dns_zone_name}"
  signing_alg = "RS256"

  # Allows the frontend to request refresh tokens so users stay logged in
  allow_offline_access = true

  # Prevents the consent prompt since you own both the frontend and backend.
  skip_consent_for_verifiable_first_party_clients = true
}
