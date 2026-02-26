# ============================================================================
# Application Variables
# ============================================================================

variable "location" {
  description = "Azure region where the resource group will be created"
  type        = string
  default     = "westus2"
}

variable "key_vault_name" {
  description = "Name of the shared Key Vault"
  type        = string
}

# ============================================================================
# Shared Infrastructure Variables
# ============================================================================

variable "resource_group_name" {
  description = "Name of the shared resource group"
  type        = string
}

variable "resource_group_location" {
  description = "Location of the shared resource group"
  type        = string
}

variable "resource_group_id" {
  description = "ID of the shared resource group"
  type        = string
}

variable "dns_zone_name" {
  description = "Name of the DNS zone"
  type        = string
}

variable "dns_zone_id" {
  description = "ID of the DNS zone"
  type        = string
}

variable "container_app_environment_name" {
  description = "Name of the Container App Environment"
  type        = string
}

variable "container_app_environment_id" {
  description = "ID of the Container App Environment"
  type        = string
}

variable "cosmos_db_account_name" {
  description = "Name of the Cosmos DB account"
  type        = string
}

variable "cosmos_db_account_id" {
  description = "ID of the Cosmos DB account"
  type        = string
}

variable "spacelift_commit_sha" {
  description = "The Git SHA passed dynamically from Spacelift to force an apply"
  type        = string
}

variable "azure_app_config_endpoint" {
  description = "Endpoint URL of the Azure App Configuration store (e.g. https://<store>.azconfig.io)"
  type        = string
}

variable "azure_app_config_resource_id" {
  description = "Resource ID of the Azure App Configuration store (used for RBAC role assignment)"
  type        = string
}
