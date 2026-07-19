import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  accessToken: process.env.ACCESS_TOKEN || '',
  databaseUrl: process.env.DATABASE_URL || 'sqlite://../data/message-buffer.db',
  get isSqlite() {
    return this.databaseUrl.startsWith('sqlite');
  },
  get sqlitePath() {
    const match = this.databaseUrl.match(/sqlite:\/\/(.+)/);
    return match ? match[1] : './data/message-buffer.db';
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
