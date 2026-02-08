import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { Product } from '../products/entities/product.entity';
import { ProductLoader } from '../products/product.loader';
import { OrderItem } from './entities/order-item.entity';

@Resolver(() => OrderItem)
export class OrderItemResolver {
  constructor(private readonly productLoader: ProductLoader) {}

  @ResolveField('product', () => Product)
  public async product(@Parent() item: OrderItem): Promise<Product> {
    return this.productLoader.load(item.productId);
  }
}
