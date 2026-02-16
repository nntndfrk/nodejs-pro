import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

@ObjectType()
@Entity('products')
export class Product {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  public name!: string;

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  public price!: number;

  // Not exposed via GraphQL — internal/admin field
  @Column({ type: 'int' })
  public stock!: number;

  @VersionColumn()
  public version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updatedAt!: Date;
}
