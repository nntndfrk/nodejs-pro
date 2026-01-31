import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { Product } from './entities/product.entity.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  public async findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  public async findById(@Param('id') id: string): Promise<Product> {
    const product = await this.productsService.findById(id);

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }
}
