import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Product } from './entities/product.entity';

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

  /** Batch-load products by IDs — used by ProductLoader (DataLoader). */
  public async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.productsRepository.find({ where: { id: In(ids) } });
  }
}
