import { CustomerAddress } from '@prisma/client';

export const toAddress = (a: CustomerAddress) => ({
  id: a.id,
  userId: a.userId,
  recipientName: a.recipientName,
  phoneNumber: a.phone,
  addressLine: a.addressLine,
  flatNumber: a.flatNumber,
  blockBuilding: a.blockBuilding,
  landmark: a.landmark ?? undefined,
  zoneId: a.zoneId,
  pincode: a.pincode,
  coordinates: a.latitude !== null && a.longitude !== null ? { latitude: a.latitude, longitude: a.longitude } : undefined,
  isDefault: a.isDefault,
});
