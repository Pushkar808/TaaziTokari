import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthUser } from './auth-user';

/** Global guard: every route needs a valid Bearer token unless it is marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Please sign in.');

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: AuthUser['role'] }>(token);
      request.user = { id: payload.sub, role: payload.role } satisfies AuthUser;
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    return true;
  }
}
