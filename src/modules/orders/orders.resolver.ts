import { Args, Query, Resolver } from '@nestjs/graphql';

import { OrdersConnection } from './dto/orders-connection.type';
import { OrdersFilterInput } from './dto/orders-filter.input';
import { OrdersPaginationInput } from './dto/orders-pagination.input';
import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';

@Resolver(() => Order)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => OrdersConnection, {
    description: 'List orders with optional filters and pagination',
  })
  public async orders(
    @Args('filter', { nullable: true }) filter?: OrdersFilterInput,
    @Args('pagination', { nullable: true }) pagination?: OrdersPaginationInput,
  ): Promise<OrdersConnection> {
    return this.ordersService.findAllPaginated(filter, pagination);
  }
}
