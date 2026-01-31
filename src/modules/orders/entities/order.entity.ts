import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid' })
  public userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  public totalPrice!: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  public status!: OrderStatus;

  @Column({ type: 'varchar', length: 255, unique: true })
  public idempotencyKey!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  public user!: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  public items!: OrderItem[];
}
