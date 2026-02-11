import { Field, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';

import { OrderStatus } from '../entities/order.entity';

/** Map GraphQL enum name (CONFIRMED) to enum value (confirmed) for validation. */
function toOrderStatusValue(value: unknown): OrderStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value in OrderStatus) {
    return (OrderStatus as Record<string, OrderStatus>)[value];
  }
  return value as OrderStatus;
}

@InputType()
export class OrdersFilterInput {
  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOrderStatusValue(value))
  @IsEnum(OrderStatus)
  public status?: OrderStatus | undefined;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  public dateFrom?: Date | undefined;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  public dateTo?: Date | undefined;
}
