import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from './entities/order.entity.js';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  public async findAll(): Promise<Order[]> {
    return this.ordersRepository.find({ relations: ['items'] });
  }

  public async findById(id: string): Promise<Order | null> {
    return this.ordersRepository.findOne({
      where: { id },
      relations: ['items'],
    });
  }
}
