import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin, Staff } from '../../common/guards/admin.decorator';
import { AuthUser, CurrentUser } from '../../common/guards/auth-user';
import { AdminService } from './admin.service';
import {
  CouponDto, ExpenseDto, ManualSaleDto, MetricsQueryDto, NotificationDto, OrderStatusDto, ProductDto, PurchaseDto, StaffDto, ZoneDto,
} from './dto/admin.dto';
import { MetricsService } from './metrics.service';
import { StockService } from './stock.service';

@Admin()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly stock: StockService,
    private readonly metrics: MetricsService
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Staff()
  @Get('ops/overview')
  opsOverview() {
    return this.admin.opsOverview();
  }

  @Post('zones')
  createZone(@CurrentUser() user: AuthUser, @Body() dto: ZoneDto) {
    return this.admin.createZone(user.id, dto);
  }

  @Patch('zones/:id')
  updateZone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ZoneDto) {
    return this.admin.updateZone(user.id, id, dto);
  }

  @Post('staff')
  createStaff(@CurrentUser() user: AuthUser, @Body() dto: StaffDto) {
    return this.admin.createStaff(user.id, dto);
  }

  @Delete('staff/:id')
  deleteStaff(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.deleteStaff(user.id, id);
  }

  @Get('metrics')
  getMetrics(@Query() query: MetricsQueryDto) {
    return this.metrics.forDay(query.date);
  }

  @Post('products')
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: ProductDto) {
    return this.admin.createProduct(user.id, dto);
  }

  @Patch('products/:id')
  updateProduct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProductDto) {
    return this.admin.updateProduct(user.id, id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.deleteProduct(user.id, id);
  }

  @Post('notifications')
  createNotification(@CurrentUser() user: AuthUser, @Body() dto: NotificationDto) {
    return this.admin.createNotification(user.id, dto);
  }

  @Patch('notifications/:id')
  updateNotification(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: NotificationDto) {
    return this.admin.updateNotification(user.id, id, dto);
  }

  @Delete('notifications/:id')
  deleteNotification(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.deleteNotification(user.id, id);
  }

  @Post('coupons')
  createCoupon(@CurrentUser() user: AuthUser, @Body() dto: CouponDto) {
    return this.admin.createCoupon(user.id, dto);
  }

  @Patch('coupons/:id')
  updateCoupon(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CouponDto) {
    return this.admin.updateCoupon(user.id, id, dto);
  }

  @Delete('coupons/:id')
  deleteCoupon(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.deleteCoupon(user.id, id);
  }

  @Post('expenses')
  recordExpense(@CurrentUser() user: AuthUser, @Body() dto: ExpenseDto) {
    return this.admin.recordExpense(user.id, dto);
  }

  @Post('purchases')
  recordPurchase(@CurrentUser() user: AuthUser, @Body() dto: PurchaseDto) {
    return this.stock.recordPurchase(user.id, dto);
  }

  @Post('manual-sales')
  recordManualSale(@CurrentUser() user: AuthUser, @Body() dto: ManualSaleDto) {
    return this.stock.recordManualSale(user.id, dto);
  }

  @Staff()
  @Patch('orders/:id/status')
  updateOrderStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OrderStatusDto) {
    return this.stock.updateOrderStatus(user.id, id, dto.status);
  }
}
