import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[ERROR]', err);

  if (err.message === 'BUFFER_NOT_FOUND') {
    res.status(404).json({ error: 'Buffer not found or invalid API key' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
