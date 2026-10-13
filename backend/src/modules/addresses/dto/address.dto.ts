import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

class CoordinatesDto {
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
}

/** Used for both create and update; the frontend always sends the full address. */
export class AddressDto {
  @IsString() @MinLength(1) recipientName: string;
  @IsString() @MinLength(1) phoneNumber: string;
  @IsString() @MinLength(1) addressLine: string;
  @IsString() flatNumber: string;
  @IsOptional() @IsString() blockBuilding?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsString() @MinLength(1) zoneId: string;
  @IsString() @MinLength(1) pincode: string;
  @IsOptional() @ValidateNested() @Type(() => CoordinatesDto) coordinates?: CoordinatesDto;
  @IsBoolean() isDefault: boolean;
}
