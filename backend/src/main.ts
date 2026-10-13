// Taazi Tokari API: NestJS bootstrap. All routes live under /api.

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Preserve the raw body for Razorpay webhook signature verification
    rawBody: true,
  });
  // Lets Prisma release its database connections when the process is stopped or restarted.
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' });

  // Rejects malformed bodies and strips any field a DTO does not declare.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Taazi Tokari API running on http://localhost:${port}/api`);
}

bootstrap();
