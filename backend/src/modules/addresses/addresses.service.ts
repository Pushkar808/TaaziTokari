import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toAddress } from './address.mapper';
import { AddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const addresses = await this.prisma.customerAddress.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return addresses.map(toAddress);
  }

  async create(userId: string, dto: AddressDto) {
    await this.assertZoneExists(dto.zoneId);
    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.customerAddress.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.customerAddress.create({ data: { userId, ...this.toColumns(dto) } });
    });
    return toAddress(address);
  }

  async update(userId: string, id: string, dto: AddressDto) {
    // Only the owner can change an address: the lookup includes userId.
    const existing = await this.prisma.customerAddress.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Address not found.');
    await this.assertZoneExists(dto.zoneId);
    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.customerAddress.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.customerAddress.update({ where: { id }, data: this.toColumns(dto) });
    });
    return toAddress(address);
  }

  private async assertZoneExists(zoneId: string) {
    if (!(await this.prisma.deliveryZone.findUnique({ where: { id: zoneId } }))) {
      throw new BadRequestException('Unknown delivery zone.');
    }
  }

  private toColumns(dto: AddressDto): Omit<Prisma.CustomerAddressUncheckedCreateInput, 'userId'> {
    return {
      recipientName: dto.recipientName,
      phone: dto.phoneNumber,
      addressLine: dto.addressLine,
      flatNumber: dto.flatNumber,
      blockBuilding: dto.blockBuilding ?? '',
      landmark: dto.landmark || null,
      zoneId: dto.zoneId,
      pincode: dto.pincode,
      latitude: dto.coordinates?.latitude ?? null,
      longitude: dto.coordinates?.longitude ?? null,
      isDefault: dto.isDefault,
    };
  }
}
