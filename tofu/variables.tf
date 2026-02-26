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

variable "spacelift_commit_sha" {
  description = "The Git SHA passed dynamically from Spacelift to force an apply"
  type        = string
}

variable "outputs_source_stack" {
  description = "Spacelift stack ID to read outputs from"
  type        = string
}
