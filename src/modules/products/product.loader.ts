import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import { type Product } from './entities/product.entity';
import { ProductsService } from './products.service';

/**
 * Request-scoped DataLoader for batching product lookups.
 * Each GraphQL request gets a fresh instance, preventing cross-request
 * cache leaks while deduplicating within a single request.
 */
@Injectable({ scope: Scope.REQUEST })
export class ProductLoader {
  private readonly loader: DataLoader<string, Product>;

  constructor(private readonly productsService: ProductsService) {
    this.loader = new DataLoader<string, Product>(async (ids) => {
      const products = await this.productsService.findByIds(ids as string[]);
      const productMap = new Map(products.map((p) => [p.id, p]));

      return ids.map((id) => productMap.get(id) ?? new Error(`Product ${id} not found`));
    });
  }

  public async load(id: string): Promise<Product> {
    return this.loader.load(id);
  }
}
