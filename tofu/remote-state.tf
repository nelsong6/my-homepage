# ============================================================================
# Remote State - Shared Infrastructure Outputs
# ============================================================================
# Reads outputs from the infra-bootstrap Spacelift stack.  The infra-bootstrap
# stack must have "External State Access" enabled in the Spacelift UI.

data "terraform_remote_state" "infra" {
  backend = "remote"

  config = {
    hostname     = "nelsong6.app.us.spacelift.io"
    organization = "nelsong6"

    workspaces = {
      name = "infra-bootstrap"
    }
  }
}

locals {
  infra = data.terraform_remote_state.infra.outputs
}
