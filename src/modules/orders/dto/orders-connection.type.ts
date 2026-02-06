import { Field, Int, ObjectType } from '@nestjs/graphql';

import { Order } from '../entities/order.entity';

@ObjectType()
export class PageInfo {
  @Field()
  public hasNextPage!: boolean;

  @Field()
  public hasPreviousPage!: boolean;
}

@ObjectType()
export class OrdersConnection {
  @Field(() => [Order])
  public nodes!: Order[];

  @Field(() => Int)
  public totalCount!: number;

  @Field()
  public pageInfo!: PageInfo;
}
