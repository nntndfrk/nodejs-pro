import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddOrderIndexes1770549096000 implements MigrationInterface {
  name = 'AddOrderIndexes1770549096000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Composite index on orders(status, createdAt) — covers the WHERE + ORDER BY
    // in the "hot" query: WHERE status = ? AND createdAt BETWEEN ? AND ? ORDER BY createdAt DESC
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_status_createdAt"
      ON "orders" ("status", "createdAt" DESC)
    `);

    // Index on order_items(orderId) — speeds up JOIN order_items ON orderId = orders.id
    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_orderId"
      ON "order_items" ("orderId")
    `);

    // Index on orders(userId) — speeds up user-specific order lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_userId"
      ON "orders" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_orders_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_items_orderId"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_status_createdAt"`);
  }
}
