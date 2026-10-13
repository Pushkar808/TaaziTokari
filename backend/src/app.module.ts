import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminGuard } from './common/guards/admin.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CommonModule } from './common/common.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { PrismaModule } from './prisma/prisma.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    // The real .env sits in the repo root; the backend may also have its own.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),

    // Global rate limit: 100 requests per minute per IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    PrismaModule,
    CommonModule,
    AuthModule,
    CatalogModule,
    AddressesModule,
    CouponsModule,
    OrdersModule,
    AdminModule,
    PaymentsModule,
  ],
  providers: [
    // Guards run in this order: rate limit, then login check, then admin check.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
