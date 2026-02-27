import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { createRequireAuth } from './middleware/auth.js';
import { fetchAppConfig } from './startup/appConfig.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware that does NOT depend on async config — safe to register now
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

async function startServer() {
  // Step 1: Fetch AUTH0_DOMAIN and AUTH0_AUDIENCE from Azure App Configuration.
  const { auth0Domain, auth0Audience, cosmosDbEndpoint } = await fetchAppConfig();

  // Step 2: Build the Auth0 JWT middleware now that we have the values.
  const requireAuth = createRequireAuth({ auth0Domain, auth0Audience });

  // Step 3: Initialize Cosmos DB client.
  const DATABASE_NAME = process.env.COSMOS_DB_DATABASE_NAME || 'HomepageDB';
  const CONTAINER_NAME = process.env.COSMOS_DB_CONTAINER_NAME || 'userdata';

  let container;
  try {
    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({
      endpoint: cosmosDbEndpoint,
      aadCredentials: credential
    });

    const database = client.database(DATABASE_NAME);
    container = database.container(CONTAINER_NAME);
    console.log('Connected to Cosmos DB using Azure Identity');
  } catch (error) {
    console.error('Failed to connect to Cosmos DB:', error);
    process.exit(1);
  }

  // Step 4: Register all routes.

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: DATABASE_NAME,
      container: CONTAINER_NAME
    });
  });

  // Database initialization endpoint
  app.post('/api/admin/init-database', requireAuth, async (req, res) => {
    try {
      const credential = new DefaultAzureCredential();
      const client = new CosmosClient({
        endpoint: cosmosDbEndpoint,
        aadCredentials: credential
      });

      // Create database if it doesn't exist
      const { database } = await client.databases.createIfNotExists({
        id: DATABASE_NAME
      });

      // Create container if it doesn't exist
      const { container: newContainer } = await database.containers.createIfNotExists({
        id: CONTAINER_NAME,
        partitionKey: {
          paths: ['/userId']
        }
      });

      // Optionally seed bookmarks for the current user
      const userId = req.auth.payload.sub;
      let seeded = false;

      if (req.body.bookmarks) {
        const bookmarksDoc = {
          id: `bookmarks_${userId}`,
          userId,
          type: 'bookmarks',
          bookmarks: req.body.bookmarks,
          updatedAt: new Date().toISOString()
        };
        await newContainer.items.upsert(bookmarksDoc);
        seeded = true;
      }

      res.json({
        success: true,
        message: 'Database initialized successfully',
        database: DATABASE_NAME,
        container: CONTAINER_NAME,
        seeded
      });
    } catch (error) {
      console.error('Error initializing database:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize database',
        message: error.message
      });
    }
  });

  // Get bookmarks for the authenticated user
  app.get('/api/bookmarks', requireAuth, async (req, res) => {
    try {
      const userId = req.auth.payload.sub;

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.type = @type AND c.userId = @userId',
        parameters: [
          { name: '@type', value: 'bookmarks' },
          { name: '@userId', value: userId }
        ]
      };

      const { resources } = await container.items.query(querySpec).fetchAll();

      if (resources.length === 0) {
        return res.json({ bookmarks: [] });
      }

      res.json({ bookmarks: resources[0].bookmarks });
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      res.status(500).json({ error: 'Failed to fetch bookmarks', message: error.message });
    }
  });

  // Save/update bookmarks for the authenticated user
  app.put('/api/bookmarks', requireAuth, async (req, res) => {
    try {
      const userId = req.auth.payload.sub;
      const { bookmarks } = req.body;

      if (!Array.isArray(bookmarks)) {
        return res.status(400).json({ error: 'Request body must contain a bookmarks array' });
      }

      const bookmarksDoc = {
        id: `bookmarks_${userId}`,
        userId,
        type: 'bookmarks',
        bookmarks,
        updatedAt: new Date().toISOString()
      };

      const { resource } = await container.items.upsert(bookmarksDoc);

      res.json({ bookmarks: resource.bookmarks, updatedAt: resource.updatedAt });
    } catch (error) {
      console.error('Error saving bookmarks:', error);
      res.status(500).json({ error: 'Failed to save bookmarks', message: error.message });
    }
  });

  // In production, serve frontend static files
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('../frontend'));
  }

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });

  console.log(`Database: ${DATABASE_NAME}`);
  console.log(`Container: ${CONTAINER_NAME}`);
  console.log(`Auth0 domain: ${auth0Domain}`);
  console.log('Server ready');
}

// Listen immediately so Azure startup probes pass while async init runs.
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}, initializing...`);
});

startServer().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});

export default app;
