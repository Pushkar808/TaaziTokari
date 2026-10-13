import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MinLength, ValidateNested,
} from 'class-validator';

export enum PaymentMethodDto {
  COD = 'COD',
  ONLINE_RAZORPAY = 'ONLINE_RAZORPAY',
}

class OrderLineDto {
  @IsString() @MinLength(1) productId: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() quantity: number;
}

/** Only ids and quantities come from the browser; the server decides every price. */
export class PlaceOrderDto {
  @IsString() @MinLength(1) addressId: string;
  @IsString() @MinLength(1) slotId: string;
  @IsEnum(PaymentMethodDto) paymentMethod: PaymentMethodDto;
  @IsOptional() @IsString() deliveryNotes?: string;
  @IsOptional() @IsString() couponCode?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderLineDto) items: OrderLineDto[];
}

export class FeedbackDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() comment?: string;
}
