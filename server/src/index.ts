import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { getDatabase, runMigrations } from './database/connection.js';
import { BufferRepository } from './repositories/buffer.repo.js';
import { WindowRepository } from './repositories/window.repo.js';
import { MessageRepository } from './repositories/message.repo.js';
import { WaitingRepository } from './repositories/waiting.repo.js';
import { LogRepository } from './repositories/log.repo.js';
import { BufferService } from './services/buffer.service.js';
import { IngestionService } from './services/ingestion.service.js';
import { WindowManagerService } from './services/window-manager.service.js';
import { WebhookService } from './services/webhook.service.js';
import { createApiRoutes } from './routes/api.routes.js';
import { createWebRoutes } from './routes/web.routes.js';
import { createDocsRoutes } from './routes/docs.routes.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  await runMigrations();

  const database = getDatabase();

  const bufferRepo = new BufferRepository();
  const windowRepo = new WindowRepository();
  const messageRepo = new MessageRepository();
  const waitingRepo = new WaitingRepository();
  const logRepo = new LogRepository();

  const webhookService = new WebhookService(logRepo);
  const windowManager = new WindowManagerService(
    bufferRepo,
    windowRepo,
    messageRepo,
    waitingRepo,
    webhookService
  );
  const ingestionService = new IngestionService(
    bufferRepo,
    windowRepo,
    messageRepo,
    waitingRepo,
    windowManager
  );
  const bufferService = new BufferService(bufferRepo, windowRepo, waitingRepo, logRepo);

  await windowManager.recoverWindows();

  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  // API de ingestão (pública, autenticada por X-Api-Key)
  app.use('/api', createApiRoutes(ingestionService, windowRepo, bufferRepo, windowManager));

  // API administrativa (protegida por Bearer token)
  app.use('/api/web', authMiddleware, createWebRoutes(bufferService, logRepo, windowRepo, windowManager));

  // Documentação da API
  app.use('/docs', createDocsRoutes());

  // Arquivos públicos (fotos, etc)
  app.use('/public', express.static(path.resolve(__dirname, '../public')));

  // Servir frontend React em produção
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.use(errorHandler);

  app.listen(env.port, () => {
    console.log(`Message Buffer Manager rodando em http://localhost:${env.port}`);
    console.log(`Documentação: http://localhost:${env.port}/docs`);
  });

  process.on('SIGTERM', () => {
    windowManager.clearAllTimers();
    database.destroy();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    windowManager.clearAllTimers();
    database.destroy();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
