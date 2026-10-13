import { Body, Controller, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/guards/auth-user';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/coupon.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('validate')
  validate(@CurrentUser() user: AuthUser, @Body() dto: ValidateCouponDto) {
    return this.coupons.validate(user.id, dto.code, dto.subtotal);
  }
}
