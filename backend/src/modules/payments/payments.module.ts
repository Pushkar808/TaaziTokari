import { Module } from '@nestjs/common';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentService } from './payment.service';

@Module({ controllers: [PaymentWebhookController], providers: [PaymentService] })
export class PaymentsModule {}
