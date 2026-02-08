import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  public async findAll(filters?: {
    status?: OrderStatus | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  }): Promise<Order[]> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .orderBy('order.createdAt', 'DESC');

    if (filters?.status !== undefined) {
      qb.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters?.dateFrom !== undefined) {
      qb.andWhere('order."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters?.dateTo !== undefined) {
      qb.andWhere('order."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }

    return qb.getMany();
  }

  public async findById(id: string): Promise<Order | null> {
    return this.ordersRepository.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  /**
   * Creates an order transactionally with:
   * - Idempotency via UNIQUE idempotencyKey
   * - Pessimistic locking (FOR NO KEY UPDATE) on product rows
   * - Stock validation and deduction
   * - Atomic Order + OrderItem creation
   */
  public async createOrder(dto: CreateOrderDto): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    this.logger.log(`Starting order transaction (idempotencyKey=${dto.idempotencyKey})`);

    try {
      // 1. Idempotency check: return existing order if key already used
      const existingOrder = await queryRunner.manager.findOne(Order, {
        where: { idempotencyKey: dto.idempotencyKey },
        relations: ['items'],
      });

      if (existingOrder) {
        this.logger.log(
          `Idempotent hit: order ${existingOrder.id} already exists for key=${dto.idempotencyKey}`,
        );
        await queryRunner.commitTransaction();
        return existingOrder;
      }

      // 2. Validate user exists
      const user = await queryRunner.manager.findOneBy(User, {
        id: dto.userId,
      });

      if (!user) {
        throw new NotFoundException(`User with id ${dto.userId} not found`);
      }

      // 3. Pessimistic lock on product rows (FOR NO KEY UPDATE)
      //    Sorted by ID to prevent deadlocks when concurrent transactions
      //    lock overlapping product sets.
      //    Use unique product IDs so the IN query matches our existence check when
      //    the same product appears in multiple line items.
      const productIds = dto.items.map((item) => item.productId);
      const uniqueProductIds = [...new Set(productIds)];

      const products = await queryRunner.manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write_or_fail')
        .where('product.id IN (:...ids)', { ids: uniqueProductIds })
        .orderBy('product.id', 'ASC')
        .getMany();

      // Verify all requested (unique) products were found
      if (products.length !== uniqueProductIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missing = uniqueProductIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(`Products not found: ${missing.join(', ')}`);
      }

      // Build a lookup map for quick access
      const productMap = new Map(products.map((p) => [p.id, p]));

      // 4. Validate stock and calculate total price
      let totalPrice = 0;
      const orderItems: OrderItem[] = [];

      for (const item of dto.items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new NotFoundException(`Product with id ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new ConflictException(
            `Insufficient stock for product "${product.name}" ` +
              `(requested=${String(item.quantity)}, available=${String(product.stock)})`,
          );
        }

        // 5. Deduct stock
        product.stock -= item.quantity;

        // Build order item
        const orderItem = new OrderItem();
        orderItem.productId = item.productId;
        orderItem.quantity = item.quantity;
        orderItem.price = product.price * item.quantity;
        orderItems.push(orderItem);

        totalPrice += orderItem.price;
      }

      // 6. Save updated product stock
      await queryRunner.manager.save(Product, products);

      // 7. Create and save order
      const order = new Order();
      order.userId = dto.userId;
      order.totalPrice = totalPrice;
      order.status = OrderStatus.CONFIRMED;
      order.idempotencyKey = dto.idempotencyKey;
      order.items = orderItems;

      const savedOrder = await queryRunner.manager.save(Order, order);

      // 8. Commit
      await queryRunner.commitTransaction();

      this.logger.log(
        `Order ${savedOrder.id} created successfully ` +
          `(items=${String(orderItems.length)}, total=${String(totalPrice)})`,
      );

      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Order transaction rolled back (idempotencyKey=${dto.idempotencyKey}): ${errorMessage}`,
      );

      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
