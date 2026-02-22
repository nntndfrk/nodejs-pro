/* eslint-disable no-console -- seed script is a CLI; console is appropriate for progress output */
import * as bcrypt from 'bcrypt';

import dataSource from '../data-source';
import { Product } from '../modules/products/entities/product.entity';
import { User, UserRole } from '../modules/users/entities/user.entity';

const SEED_PASSWORD = 'password123';
const BCRYPT_SALT_ROUNDS = 10;

const users: { email: string; name: string; role: UserRole }[] = [
  { email: 'alice@example.com', name: 'Alice Johnson', role: UserRole.ADMIN },
  { email: 'bob@example.com', name: 'Bob Smith', role: UserRole.USER },
  { email: 'charlie@example.com', name: 'Charlie Brown', role: UserRole.USER },
  { email: 'diana@example.com', name: 'Diana Prince', role: UserRole.USER },
  { email: 'eve@example.com', name: 'Eve Davis', role: UserRole.USER },
];

const products: Partial<Product>[] = [
  { name: 'Wireless Mouse', price: 29.99, stock: 150 },
  { name: 'Mechanical Keyboard', price: 89.99, stock: 75 },
  { name: 'USB-C Hub', price: 49.99, stock: 200 },
  { name: '27" Monitor', price: 349.99, stock: 30 },
  { name: 'Webcam HD', price: 59.99, stock: 100 },
  { name: 'Laptop Stand', price: 39.99, stock: 120 },
  { name: 'Noise-Cancelling Headphones', price: 199.99, stock: 50 },
  { name: 'Ethernet Cable 3m', price: 9.99, stock: 500 },
  { name: 'Portable SSD 1TB', price: 109.99, stock: 60 },
  { name: 'Desk Lamp LED', price: 24.99, stock: 80 },
];

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('Data source initialized.');

  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_SALT_ROUNDS);

  const savedUsers = await userRepo.save(users.map((u) => userRepo.create({ ...u, passwordHash })));
  console.log(`Seeded ${String(savedUsers.length)} users (password: "${SEED_PASSWORD}").`);

  const savedProducts = await productRepo.save(products.map((p) => productRepo.create(p)));
  console.log(`Seeded ${String(savedProducts.length)} products.`);

  console.log('\n--- Seeded Users ---');
  for (const user of savedUsers) {
    console.log(`  ${user.id}  ${user.email}  (${user.name})  role=${user.role}`);
  }

  console.log('\n--- Seeded Products ---');
  for (const product of savedProducts) {
    console.log(
      `  ${product.id}  ${product.name}  $${String(product.price)}  stock=${String(product.stock)}`,
    );
  }

  await dataSource.destroy();
  console.log('\nSeed complete. Connection closed.');
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
