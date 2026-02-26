# ============================================================================
# Remote State - Shared Infrastructure Outputs
# ============================================================================
# Reads outputs from the infra-bootstrap Spacelift stack using the Spacelift
# provider, which authenticates automatically during Spacelift runs.

data "spacelift_stack_output" "azure_app_config_resource_id" {
  stack_id    = var.outputs_source_stack
  output_name = "azure_app_config_resource_id"
}

data "spacelift_stack_output" "azure_app_config_endpoint" {
  stack_id    = var.outputs_source_stack
  output_name = "azure_app_config_endpoint"
}

data "spacelift_stack_output" "auth0_domain" {
  stack_id    = var.outputs_source_stack
  output_name = "auth0_domain"
}

data "spacelift_stack_output" "container_app_environment_id" {
  stack_id    = var.outputs_source_stack
  output_name = "container_app_environment_id"
}

data "spacelift_stack_output" "cosmos_db_account_id" {
  stack_id    = var.outputs_source_stack
  output_name = "cosmos_db_account_id"
}

data "spacelift_stack_output" "cosmos_db_account_name" {
  stack_id    = var.outputs_source_stack
  output_name = "cosmos_db_account_name"
}

data "spacelift_stack_output" "dns_zone_name" {
  stack_id    = var.outputs_source_stack
  output_name = "dns_zone_name"
}

data "spacelift_stack_output" "resource_group_name" {
  stack_id    = var.outputs_source_stack
  output_name = "resource_group_name"
}

locals {
  infra = {
    azure_app_config_resource_id = data.spacelift_stack_output.azure_app_config_resource_id.value
    azure_app_config_endpoint    = data.spacelift_stack_output.azure_app_config_endpoint.value
    auth0_domain                 = data.spacelift_stack_output.auth0_domain.value
    container_app_environment_id = data.spacelift_stack_output.container_app_environment_id.value
    cosmos_db_account_id         = data.spacelift_stack_output.cosmos_db_account_id.value
    cosmos_db_account_name       = data.spacelift_stack_output.cosmos_db_account_name.value
    dns_zone_name                = data.spacelift_stack_output.dns_zone_name.value
    resource_group_name          = data.spacelift_stack_output.resource_group_name.value
  }
}
