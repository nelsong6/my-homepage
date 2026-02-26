# ============================================================================
# Azure App Configuration Key-Values
# ============================================================================
# These keys are read at runtime by the backend via fetchAppConfig() in
# backend/startup/appConfig.js. The Container App's managed identity has the
# "App Configuration Data Reader" role assigned in backend.tf.

resource "azurerm_app_configuration_key" "auth0_domain" {
  configuration_store_id = local.infra.azure_app_config_resource_id
  key                    = "${local.front_app_dns_name}/AUTH0_DOMAIN"
  value                  = local.infra.auth0_domain
}

resource "azurerm_app_configuration_key" "auth0_audience" {
  configuration_store_id = local.infra.azure_app_config_resource_id
  key                    = "${local.front_app_dns_name}/AUTH0_AUDIENCE"
  value                  = auth0_resource_server.backend_api.identifier
}

resource "azurerm_app_configuration_key" "auth0_client_id" {
  configuration_store_id = local.infra.azure_app_config_resource_id
  key                    = "${local.front_app_dns_name}/AUTH0_CLIENT_ID"
  value                  = auth0_client.frontend_spa.client_id
}
