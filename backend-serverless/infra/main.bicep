targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Short environment name used in generated resource names.')
@minLength(2)
@maxLength(12)
param environmentName string = 'prod'

@description('Function App name. Leave empty to generate one.')
param functionAppName string = ''

@description('Storage account name. Leave empty to generate one.')
param storageAccountName string = ''

@description('PostgreSQL Flexible Server name. Leave empty to generate one.')
param postgresServerName string = ''

@description('PostgreSQL database name.')
param databaseName string = 'linguaquest'

@description('PostgreSQL administrator login.')
param postgresAdminLogin string = 'lqadmin'

@secure()
@description('PostgreSQL administrator password.')
param postgresAdminPassword string

@secure()
@description('JWT signing secret for production.')
param jwtSecret string

@secure()
@description('Anthropic API key for Claude content generation and evaluation.')
param anthropicApiKey string = ''

@description('Allowed frontend origins as a JSON array string.')
param corsOrigins string = '["http://localhost:5173","http://127.0.0.1:5173"]'

@description('Queue name for short writing evaluation jobs.')
param evaluationQueueName string = 'writing-evaluations'

@description('Maximum Flex Consumption scale-out instance count.')
@minValue(40)
@maxValue(1000)
param maximumInstanceCount int = 100

@description('Memory size per Flex Consumption instance.')
@allowed([
  512
  2048
  4096
])
param instanceMemoryMB int = 2048

var token = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))
var resolvedFunctionAppName = empty(functionAppName) ? 'lq-func-${environmentName}-${token}' : functionAppName
var resolvedStorageAccountName = empty(storageAccountName) ? take('lqst${replace(token, '-', '')}', 24) : storageAccountName
var resolvedPostgresServerName = empty(postgresServerName) ? 'lq-pg-${environmentName}-${token}' : postgresServerName
var planName = 'lq-plan-${environmentName}-${token}'
var logAnalyticsName = 'lq-log-${environmentName}-${token}'
var appInsightsName = 'lq-ai-${environmentName}-${token}'
var keyVaultName = take('lq-kv-${environmentName}-${token}', 24)
var packageContainerName = 'function-packages'
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: resolvedStorageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource packageContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: packageContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource evaluationQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: evaluationQueueName
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: resolvedPostgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource postgresAzureFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    accessPolicies: []
  }
}

var databaseUrl = 'postgresql+asyncpg://${postgresAdminLogin}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}'

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'database-url'
  properties: {
    value: databaseUrl
  }
}

resource jwtSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: {
    value: jwtSecret
  }
}

resource anthropicSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'anthropic-api-key'
  properties: {
    value: anthropicApiKey
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: resolvedFunctionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${packageContainerName}'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'AzureWebJobsStorage'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: maximumInstanceCount
        instanceMemoryMB: instanceMemoryMB
      }
      runtime: {
        name: 'python'
        version: '3.13'
      }
    }
    siteConfig: {
      appSettings: [
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'DATABASE_URL'
          value: '@Microsoft.KeyVault(SecretUri=${databaseUrlSecret.properties.secretUri})'
        }
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${jwtSecretResource.properties.secretUri})'
        }
        {
          name: 'JWT_ALGORITHM'
          value: 'HS256'
        }
        {
          name: 'JWT_ACCESS_TTL_SECONDS'
          value: '900'
        }
        {
          name: 'ANTHROPIC_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${anthropicSecret.properties.secretUri})'
        }
        {
          name: 'CLAUDE_MODEL'
          value: 'claude-sonnet-4-5-20250929'
        }
        {
          name: 'CLAUDE_MAX_TOKENS'
          value: '4096'
        }
        {
          name: 'CORS_ORIGINS'
          value: corsOrigins
        }
        {
          name: 'EVALUATION_QUEUE_NAME'
          value: evaluationQueueName
        }
        {
          name: 'CREATE_EVALUATION_QUEUE_ON_ENQUEUE'
          value: 'false'
        }
        {
          name: 'SEED_ON_STARTUP'
          value: 'true'
        }
        {
          name: 'AUTO_CREATE_SCHEMA'
          value: 'false'
        }
        {
          name: 'ENVIRONMENT'
          value: environmentName
        }
      ]
    }
  }
  dependsOn: [
    packageContainer
    evaluationQueue
    postgresDatabase
    postgresAzureFirewall
  ]
}

resource functionKeyVaultPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  name: '${keyVault.name}/add'
  properties: {
    accessPolicies: [
      {
        tenantId: tenant().tenantId
        objectId: functionApp.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output resourceGroupName string = resourceGroup().name
output keyVaultName string = keyVault.name
output postgresServerName string = postgres.name
output evaluationQueueName string = evaluationQueue.name
