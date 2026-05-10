import { Router, Request, Response } from 'express';
import { IngestionService } from '../services/ingestion.service.js';

export function createApiRoutes(ingestionService: IngestionService): Router {
  const router = Router();

  /**
   * @openapi
   * /api/ingest/{bufferId}:
   *   post:
   *     tags:
   *       - Ingestão
   *     summary: Envia uma mensagem para um buffer
   *     description: >
   *       Envia uma mensagem para o buffer especificado. O buffer agrupa mensagens
   *       por `identifier` dentro de uma janela de tempo e as envia em lote para
   *       o webhook configurado quando a janela expirar.
   *     parameters:
   *       - in: path
   *         name: bufferId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do buffer de destino
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - identifier
   *               - content
   *               - type
   *             properties:
   *               identifier:
   *                 type: string
   *                 description: Identificador único para agrupar mensagens na mesma janela
   *                 example: "user-session-123"
   *               content:
   *                 description: Conteúdo da mensagem (string, number, boolean ou objeto JSON)
   *                 example: "mensagem de exemplo"
   *               type:
   *                 type: string
   *                 enum: [string, number, boolean, json]
   *                 description: Tipo do conteúdo
   *                 example: "string"
   *     headers:
   *       X-Api-Key:
   *         description: Chave de API do buffer (obrigatória)
   *         schema:
   *           type: string
   *     security:
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Mensagem aceita com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accepted:
   *                   type: boolean
   *                   example: true
   *                 window_id:
   *                   type: string
   *                   description: ID da janela onde a mensagem foi alocada (vazio se enfileirado)
   *                 queued:
   *                   type: boolean
   *                   description: Indica se a mensagem foi para a fila de espera
   *       401:
   *         description: API Key inválida ou não fornecida
   *       404:
   *         description: Buffer não encontrado
   */
  router.post('/ingest/:bufferId', async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        res.status(401).json({ error: 'Missing X-Api-Key header' });
        return;
      }

      const { identifier, content, type } = req.body;

      if (!identifier || content === undefined || !type) {
        res.status(400).json({
          error: 'Missing required fields: identifier, content, type',
        });
        return;
      }

      if (!['string', 'number', 'boolean', 'json'].includes(type)) {
        res.status(400).json({
          error: 'Invalid type. Must be one of: string, number, boolean, json',
        });
        return;
      }

      const result = await ingestionService. ingest(req.params.bufferId, apiKey, {
        identifier,
        content,
        type,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'BUFFER_NOT_FOUND') {
        res.status(404).json({ error: 'Buffer not found or invalid API key' });
        return;
      }
      throw err;
    }
  });

  return router;
}
