import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes one audit row. Pass a transaction client to make it part of that transaction. */
  log(
    entry: { action: string; entityType: string; entityId?: string; actor: string; details?: string },
    db: Db = this.prisma
  ) {
    return db.auditLog.create({ data: entry });
  }

  /** "Full Name (role)" for audit rows and inventory notes. */
  async actorName(userId: string, db: Db = this.prisma): Promise<string> {
    const user = await db.profile.findUnique({ where: { id: userId }, select: { fullName: true, role: true } });
    return user ? `${user.fullName || 'User'} (${user.role})` : 'System';
  }
}
