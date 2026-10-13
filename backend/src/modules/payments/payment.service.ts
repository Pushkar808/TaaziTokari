import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

export type MarkPaidResult = 'paid' | 'already_paid' | 'unknown_order';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /**
   * Marks an order PAID after a verified Razorpay capture. Safe to call repeatedly:
   * a second delivery of the same event changes nothing.
   */
  async markOrderPaid(orderNumber: string, amountPaise: number, paymentId: string): Promise<MarkPaidResult> {
    const order = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!order) return 'unknown_order';
    if (order.paymentStatus === 'PAID') return 'already_paid';

    if (order.grandTotal.mul(100).round().toNumber() !== amountPaise) {
      throw new BadRequestException(`Amount mismatch for ${orderNumber}: paid ${amountPaise} paise`);
    }

    // The status filter keeps this idempotent even if two webhooks race: only one update matches.
    const { count } = await this.prisma.order.updateMany({
      where: { id: order.id, paymentStatus: { not: 'PAID' } },
      data: { paymentStatus: 'PAID' },
    });
    if (count === 0) return 'already_paid';

    await this.audit.log({
      action: 'PAYMENT_CAPTURED',
      entityType: 'orders',
      entityId: order.id,
      actor: 'Razorpay webhook',
      details: `${orderNumber} paid via ${paymentId}`,
    });
    this.logger.log(`Order ${orderNumber} marked PAID (${paymentId})`);
    return 'paid';
  }
}
