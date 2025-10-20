import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class CreateCheckoutSessionDTO {
  @ApiProperty({ description: 'Stripe price ID' })
  @IsString()
  priceId: string;

  @ApiProperty({ description: 'Success URL after payment' })
  // @IsUrl()
  successUrl: string;

  @ApiProperty({ description: 'Cancel URL if payment fails' })
  // @IsUrl()
  cancelUrl: string;
}

export class CreateSubscriptionDTO {
  @ApiProperty({ description: 'Stripe price ID' })
  @IsString()
  priceId: string;
}
