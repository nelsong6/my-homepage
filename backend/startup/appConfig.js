import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Fetches application configuration from Azure App Configuration.
 *
 * AZURE_APP_CONFIG_ENDPOINT is infrastructure config (not a secret) and
 * is injected as a plain environment variable on the Container App.
 *
 * @returns {Promise<{ auth0Domain: string, auth0Audience: string, cosmosDbEndpoint: string }>}
 */
export async function fetchAppConfig() {
  const endpoint = process.env.AZURE_APP_CONFIG_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      'AZURE_APP_CONFIG_ENDPOINT environment variable is not set. ' +
      'This must be provided as infra config on the Container App.'
    );
  }

  const prefix = process.env.APP_CONFIG_PREFIX;

  if (!prefix) {
    throw new Error(
      'APP_CONFIG_PREFIX environment variable is not set. ' +
      'This must be provided as infra config on the Container App.'
    );
  }

  const credential = new DefaultAzureCredential();
  const client = new AppConfigurationClient(endpoint, credential);

  const [domainSetting, audienceSetting, cosmosEndpointSetting] = await Promise.all([
    client.getConfigurationSetting({ key: 'AUTH0_DOMAIN' }),
    client.getConfigurationSetting({ key: `${prefix}/AUTH0_AUDIENCE` }),
    client.getConfigurationSetting({ key: 'cosmos_db_endpoint' }),
  ]);

  const auth0Domain = domainSetting.value;
  const auth0Audience = audienceSetting.value;
  const cosmosDbEndpoint = cosmosEndpointSetting.value;

  if (!auth0Domain || !auth0Audience || !cosmosDbEndpoint) {
    throw new Error(
      `Azure App Configuration is missing required keys. ` +
      `Ensure AUTH0_DOMAIN, ${prefix}/AUTH0_AUDIENCE, and cosmos_db_endpoint are set in the store.`
    );
  }

  console.log('[appConfig] Application config fetched from Azure App Configuration');
  return { auth0Domain, auth0Audience, cosmosDbEndpoint };
}
