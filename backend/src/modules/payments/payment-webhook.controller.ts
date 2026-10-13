// ==============================================================================
// RAZORPAY WEBHOOK
// Server-to-server only. Verifies the signature over the raw body, then marks the
// order PAID. Never trusts frontend redirect callbacks.
// The order must be created in Razorpay with notes.order_number = our order number.
// ==============================================================================

import { Controller, Post, Req, Res, HttpStatus, Logger, Headers, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '../../common/guards/public.decorator';
import { PaymentService } from './payment.service';
import { verifyRazorpaySignature } from './razorpay-signature.util';

@Controller('payments')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly paymentService: PaymentService,
    config: ConfigService
  ) {
    // No fallback: the app must not start with a guessable secret.
    const secret = config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET must be set');
    this.webhookSecret = secret;
  }

  @Public() // authenticated by the Razorpay signature instead of a login token
  @Post('webhook/razorpay')
  async handleRazorpayWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature?: string
  ) {
    if (!signature || !req.rawBody) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing signature or body' });
    }
    if (!verifyRazorpaySignature(req.rawBody, signature, this.webhookSecret)) {
      this.logger.error('Webhook signature mismatch. Possible spoofing.');
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body;
    if (event?.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const orderNumber = payment?.notes?.order_number;
      if (!orderNumber || !payment?.id || typeof payment.amount !== 'number') {
        this.logger.error('payment.captured is missing notes.order_number, id or amount');
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Incomplete payment payload' });
      }

      try {
        const result = await this.paymentService.markOrderPaid(orderNumber, payment.amount, payment.id);
        if (result === 'unknown_order') this.logger.error(`Payment ${payment.id} references unknown order ${orderNumber}`);
      } catch (err) {
        // A mismatch will never succeed on retry; anything else (database down) should be retried.
        if (err instanceof BadRequestException) {
          this.logger.error(err.message);
          return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Payment amount mismatch' });
        }
        this.logger.error(`Failed to mark ${orderNumber} paid: ${(err as Error).message}`);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Fulfillment retry needed' });
      }
    }

    return res.status(HttpStatus.OK).json({ status: 'received' });
  }
}
