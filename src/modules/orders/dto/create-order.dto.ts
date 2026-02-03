import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  public productId!: string;

  @IsInt()
  @Min(1)
  public quantity!: number;
}

export class CreateOrderDto {
  @IsUUID()
  public userId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1)
  public items!: CreateOrderItemDto[];

  @IsString()
  public idempotencyKey!: string;
}
