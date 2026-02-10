import { Field, InputType, Int } from '@nestjs/graphql';
import { Max, Min } from 'class-validator';

@InputType()
export class OrdersPaginationInput {
  @Field(() => Int, { defaultValue: 20, description: 'Max items per page (1–50)' })
  @Min(1)
  @Max(50)
  public limit = 20;

  @Field(() => Int, { defaultValue: 0, description: 'Number of items to skip' })
  @Min(0)
  public offset = 0;
}
