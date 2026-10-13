import { IsNumber, IsString, MinLength, Min } from 'class-validator';

export class ValidateCouponDto {
  @IsString() @MinLength(1) code: string;
  @IsNumber() @Min(0) subtotal: number;
}
