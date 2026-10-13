import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Supabase's session-mode pooler (port 5432) allows only ~15 clients in total, and Prisma by default
// opens cpus*2+1 connections per process. Cap ours so a dev restart or a second process cannot exhaust the pool.
// Override with ?connection_limit=N in DATABASE_URL.
const DEFAULT_CONNECTION_LIMIT = 5;

function withConnectionLimit(url: string | undefined): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${DEFAULT_CONNECTION_LIMIT}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasourceUrl: withConnectionLimit(process.env.DATABASE_URL) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Give the connections back when the app stops (watch-mode restarts would otherwise leak sessions).
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
