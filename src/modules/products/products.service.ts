import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './entities/product.entity.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  public async findAll(): Promise<Product[]> {
    return this.productsRepository.find();
  }

  public async findById(id: string): Promise<Product | null> {
    return this.productsRepository.findOneBy({ id });
  }
}
