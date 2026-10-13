import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOWED_ROLES_KEY } from './admin.decorator';

/** Runs after JwtAuthGuard: rejects users whose role is not allowed on routes marked @Admin() or @Staff(). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<string[] | undefined>(ALLOWED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed) return true;
    if (!allowed.includes(context.switchToHttp().getRequest().user?.role)) {
      throw new ForbiddenException(allowed.length === 1 ? 'Admins only.' : 'Staff only.');
    }
    return true;
  }
}
