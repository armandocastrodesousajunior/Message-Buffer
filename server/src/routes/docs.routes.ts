import { Router } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Message Buffer Manager API',
      version: '1.0.0',
      description: `API de gerenciamento de buffers de mensagens com janelamento assíncrono.

## Autenticação

### Painel Web (endpoints /api/web/)
\`\`\`
Authorization: Bearer <ACCESS_TOKEN>
\`\`\`

### Ingestão de Mensagens (POST /api/ingest/:bufferId)
\`\`\`
X-Api-Key: <api_key_do_buffer>
\`\`\`

## Fluxo de Mensagens
1. Mensagem chega via \`POST /api/ingest/:bufferId\`
2. Sistema agrupa mensagens pelo mesmo \`identifier\` dentro de uma janela de tempo
3. Ao expirar a janela, o lote é enviado ao webhook configurado
4. Se o limite de janelas simultâneas for atingido, a mensagem vai para fila de espera
`,
      contact: {
        name: 'Message Buffer Manager',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desenvolvimento',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token de acesso do painel administrativo (configurado via .env)',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Api-Key',
          description: 'API Key do buffer (gerada ao criar o buffer)',
        },
      },
    },
    tags: [
      { name: 'Ingestão', description: 'Endpoints para envio de mensagens aos buffers' },
      { name: 'Administração', description: 'Endpoints de gerenciamento dos buffers (requer Bearer auth)' },
    ],
  },
  apis: [path.join(__dirname, 'api.routes.ts'), path.join(__dirname, 'web.routes.ts')],
};

const spec = swaggerJsdoc(options);

export function createDocsRoutes(): Router {
  const router = Router();

  router.use('/', swaggerUi.serve, swaggerUi.setup(spec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Message Buffer Manager - API Docs',
    swaggerOptions: { persistAuthorization: true },
  }));

  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });

  return router;
}
