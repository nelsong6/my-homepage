# Cosmos DB NoSQL Database (app-specific; account is managed by shared infra)
resource "azurerm_cosmosdb_sql_database" "homepage" {
  name                = "HomepageDB"
  resource_group_name = var.resource_group_name
  account_name        = var.cosmos_db_account_name

  lifecycle {
    ignore_changes = [throughput]
  }
}

resource "azurerm_cosmosdb_sql_container" "userdata" {
  name                = "userdata"
  resource_group_name = var.resource_group_name
  account_name        = var.cosmos_db_account_name
  database_name       = azurerm_cosmosdb_sql_database.homepage.name
  partition_key_paths = ["/userId"]

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/*"
    }
  }
}
