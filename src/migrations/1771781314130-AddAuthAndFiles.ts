import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAuthAndFiles1771781314130 implements MigrationInterface {
  name = 'AddAuthAndFiles1771781314130';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "public"."IDX_order_items_orderId"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_orders_status_createdAt"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_orders_userId"
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."file_records_entitytype_enum" AS ENUM('user', 'product', 'order')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."file_records_status_enum" AS ENUM('pending', 'ready')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."file_records_visibility_enum" AS ENUM('private', 'public')
        `);
    await queryRunner.query(`
            CREATE TABLE "file_records" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ownerId" uuid NOT NULL,
                "entityId" uuid,
                "entityType" "public"."file_records_entitytype_enum",
                "key" character varying(512) NOT NULL,
                "contentType" character varying(100) NOT NULL,
                "size" bigint,
                "status" "public"."file_records_status_enum" NOT NULL DEFAULT 'pending',
                "visibility" "public"."file_records_visibility_enum" NOT NULL DEFAULT 'private',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_17d6bda4e953aace5de8a299e34" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "passwordHash" character varying(255) NOT NULL DEFAULT ''
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ALTER COLUMN "passwordHash" DROP DEFAULT
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'user'
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "avatarFileId" uuid
        `);
    await queryRunner.query(`
            ALTER TABLE "products"
            ADD "imageFileId" uuid
        `);
    await queryRunner.query(`
            ALTER TABLE "orders"
            ADD "invoiceFileId" uuid
        `);
    await queryRunner.query(`
            ALTER TABLE "file_records"
            ADD CONSTRAINT "FK_e2487f0b49afe1bd20895c432ac" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "file_records" DROP CONSTRAINT "FK_e2487f0b49afe1bd20895c432ac"
        `);
    await queryRunner.query(`
            ALTER TABLE "orders" DROP COLUMN "invoiceFileId"
        `);
    await queryRunner.query(`
            ALTER TABLE "products" DROP COLUMN "imageFileId"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "avatarFileId"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "role"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."users_role_enum"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "passwordHash"
        `);
    await queryRunner.query(`
            DROP TABLE "file_records"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."file_records_visibility_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."file_records_status_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."file_records_entitytype_enum"
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_orders_userId" ON "orders" ("userId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_orders_status_createdAt" ON "orders" ("createdAt", "status")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_order_items_orderId" ON "order_items" ("orderId")
        `);
  }
}
