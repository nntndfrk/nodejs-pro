import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Product } from '../../products/entities/product.entity';
import { Order } from './order.entity';

@ObjectType()
@Entity('order_items')
export class OrderItem {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid' })
  public orderId!: string;

  @Column({ type: 'uuid' })
  public productId!: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  public quantity!: number;

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  public price!: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  public order!: Order;

  // Resolved via DataLoader in OrderItemResolver — not eagerly loaded here
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  public product!: Product;
}
