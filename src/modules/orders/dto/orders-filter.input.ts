import { Field, InputType } from '@nestjs/graphql';

import { OrderStatus } from '../entities/order.entity';

@InputType()
export class OrdersFilterInput {
  @Field(() => OrderStatus, { nullable: true })
  public status?: OrderStatus | undefined;

  @Field(() => Date, { nullable: true })
  public dateFrom?: Date | undefined;

  @Field(() => Date, { nullable: true })
  public dateTo?: Date | undefined;
}
