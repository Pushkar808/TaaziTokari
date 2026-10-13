import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MetricsService } from './metrics.service';
import { StockService } from './stock.service';

@Module({ controllers: [AdminController], providers: [AdminService, StockService, MetricsService] })
export class AdminModule {}
