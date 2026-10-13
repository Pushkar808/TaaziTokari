import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/guards/auth-user';
import { FeedbackDto, PlaceOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orders.list(user.id);
  }

  @Post()
  place(@CurrentUser() user: AuthUser, @Body() dto: PlaceOrderDto) {
    return this.orders.place(user.id, dto);
  }

  @Post(':id/feedback')
  submitFeedback(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FeedbackDto) {
    return this.orders.submitFeedback(user.id, id, dto);
  }
}
