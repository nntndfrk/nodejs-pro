import path from 'path';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource for TypeORM CLI (migrations).
 *
 * Uses __dirname so the same file works both from source (ts-node)
 * and from compiled output (node dist/data-source.js).
 *
 * Usage (local):
 *   npm run migration:generate -- src/migrations/MigrationName
 *   npm run migration:run
 *   npm run migration:revert
 *
 * Usage (Docker):
 *   node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js
 */
export default new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'postgres',
  database: process.env['DB_NAME'] ?? 'nodejs_pro',
  entities: [path.join(__dirname, 'modules/**/entities/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
});
