import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/guards/auth-user';
import { AddressesService } from './addresses.service';
import { AddressDto } from './dto/address.dto';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.addresses.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddressDto) {
    return this.addresses.update(user.id, id, dto);
  }
}
