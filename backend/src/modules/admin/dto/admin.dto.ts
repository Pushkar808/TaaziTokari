import { DiscountType, ExpenseCategory, NotificationType, OrderStatus } from '@prisma/client';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Min, MinLength,
} from 'class-validator';
import { DATE_PATTERN, TIME_PATTERN } from '../../../common/dates';

const DATE_MESSAGE = 'date must look like 2026-10-31';

export class ProductDto {
  @IsString() @MinLength(1) nameEn: string;
  @IsOptional() @IsString() nameHi?: string;
  @IsString() @MinLength(1) categorySlug: string;
  @IsString() @MinLength(1) unit: string;
  @IsNumber() @Min(0) price: number;
  @IsNumber() @Min(0) mrp: number;
  @IsNumber() @Min(0) stockQty: number;
  @IsNumber() @Min(0) lowStockThreshold: number;
  @IsBoolean() isAvailable: boolean;
  @IsBoolean() isNewArrival: boolean;
  @IsBoolean() isPopular: boolean;
  @IsBoolean() isBestPrice: boolean;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() topBadge?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
}

export class NotificationDto {
  @IsString() @MinLength(1) title: string;
  @IsString() @MinLength(1) message: string;
  @IsEnum(NotificationType) type: NotificationType;
  @IsOptional() @IsString() bannerImageUrl?: string;
  @IsOptional() @IsString() actionText?: string;
  @IsOptional() @IsString() actionUrl?: string;
  @IsBoolean() isActive: boolean;
  @IsInt() priority: number;
}

export class ExpenseDto {
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) date: string;
  @IsEnum(ExpenseCategory) category: ExpenseCategory;
  @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsString() notes?: string;
}

export class PurchaseDto {
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) date: string;
  @IsString() @MinLength(1) productId: string;
  @IsNumber() @IsPositive() quantity: number;
  @IsNumber() @Min(0) totalCost: number;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ManualSaleDto {
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) date: string;
  @IsString() @MinLength(1) productId: string;
  @IsNumber() @IsPositive() quantity: number;
  @IsNumber() @Min(0) sellingPrice: number;
  @IsOptional() @IsString() notes?: string;
}

export class OrderStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
}

export class MetricsQueryDto {
  @IsOptional() @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) date?: string;
}

export class CouponDto {
  @IsString() @MinLength(1) code: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(DiscountType) discountType: DiscountType;
  @IsNumber() @IsPositive() discountValue: number;
  @IsNumber() @Min(0) minOrderAmount: number;
  @IsOptional() @IsNumber() @IsPositive() maxDiscount?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsInt() @Min(1) perUserLimit: number;
  @IsBoolean() firstOrderOnly: boolean;
  @IsBoolean() isActive: boolean;
}

export class ZoneDto {
  @IsString() @MinLength(1) name: string;
  @Matches(TIME_PATTERN, { message: 'cutoffTime must look like 22:00' }) cutoffTime: string;
  @IsNumber() @Min(0) deliveryFee: number;
  @IsNumber() @Min(0) minOrderFreeDelivery: number;
  @IsBoolean() isActive: boolean;
  // Optional on update (the console only edits them when creating); required when creating a zone.
  @IsOptional() @IsArray() @Matches(/^\d{6}$/, { each: true, message: 'each pincode must be 6 digits' }) pincodes?: string[];
}

export class StaffDto {
  @IsString() @MinLength(1) fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsString() @MinLength(6) password: string;
}
