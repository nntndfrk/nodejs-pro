import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { Order } from './entities/order.entity.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  public async findAll(): Promise<Order[]> {
    return this.ordersService.findAll();
  }

  @Get(':id')
  public async findById(@Param('id') id: string): Promise<Order> {
    const order = await this.ordersService.findById(id);

    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }

    return order;
  }
}
