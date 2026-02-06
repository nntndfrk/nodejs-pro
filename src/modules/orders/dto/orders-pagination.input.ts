import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class OrdersPaginationInput {
  @Field(() => Int, { defaultValue: 20 })
  public limit: number = 20;

  @Field(() => Int, { defaultValue: 0 })
  public offset: number = 0;
}
