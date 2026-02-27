# Outputs
output "resource_group_name" {
  value       = azurerm_resource_group.homepage.name
  description = "Name of the resource group"
}

output "static_web_app_name" {
  value       = azurerm_static_web_app.homepage.name
  description = "Name of the Azure Static Web App"
}

output "static_web_app_hostname" {
  value       = "${local.front_app_dns_name}.${local.infra.dns_zone_name}"
  description = "Custom domain hostname of the Static Web App"
}

output "cosmos_db_name" {
  value       = local.infra.cosmos_db_account_name
  description = "Cosmos DB account name"
}

output "cosmos_db_database_name" {
  value       = azurerm_cosmosdb_sql_database.homepage.name
  description = "Cosmos DB database name"
}

output "cosmos_db_container_name" {
  value       = azurerm_cosmosdb_sql_container.userdata.name
  description = "Cosmos DB container name for user data"
}

output "backend_api_url" {
  value       = "https://${local.back_app_dns_name}.${local.infra.dns_zone_name}"
  description = "The URL of the backend Container App API"
}

output "container_app_name" {
  value       = azurerm_container_app.homepage_api["homepage-api"].name
  description = "Name of the backend Container App, picked up by github actions to handle custom dns for container app."
}

output "auth0_domain" {
  value       = local.infra.auth0_domain
  description = "Auth0 custom domain for login branding"
}

output "auth0_canonical_domain" {
  value       = local.infra.auth0_canonical_domain
  description = "Auth0 canonical tenant domain for firewall bypass"
}

output "container_app_default_fqdn" {
  value       = azurerm_container_app.homepage_api["homepage-api"].ingress[0].fqdn
  description = "Default Azure-assigned FQDN for the backend Container App"
}

output "auth0_client_id" {
  value       = auth0_client.frontend_spa.client_id
  description = "Auth0 SPA client ID for the frontend application"
}

output "auth0_audience" {
  value       = auth0_resource_server.backend_api.identifier
  description = "Auth0 API audience identifier for the backend"
}

output "app_config_prefix" {
  value       = local.front_app_dns_name
  description = "App Configuration key prefix, derived from the frontend DNS name"
}
