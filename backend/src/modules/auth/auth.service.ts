import {
  ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Profile } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { toProfile } from './profile.mapper';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();
  private readonly googleClientId?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService
  ) {
    this.googleClientId = config.get<string>('GOOGLE_CLIENT_ID') || undefined;
  }

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    if (await this.prisma.profile.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists. Please sign in.');
    }
    const profile = await this.prisma.profile.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phoneNumber.trim(),
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    return this.session(profile);
  }

  async login(dto: LoginDto) {
    const profile = await this.prisma.profile.findUnique({ where: { email: normalizeEmail(dto.email) } });
    // One message for "no such user" and "wrong password" so emails cannot be probed.
    const valid = profile?.passwordHash ? await bcrypt.compare(dto.password, profile.passwordHash) : false;
    if (!profile || !valid) throw new UnauthorizedException('Incorrect email or password.');
    return this.session(profile);
  }

  /** Signs in (or signs up) with a Google ID token obtained by the browser. */
  async loginWithGoogle(idToken: string) {
    if (!this.googleClientId) throw new ServiceUnavailableException('Google sign-in is not configured.');

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: this.googleClientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Your Google account has no verified email.');
    }

    const email = normalizeEmail(payload.email);
    const existing =
      (await this.prisma.profile.findUnique({ where: { googleId: payload.sub } })) ??
      (await this.prisma.profile.findUnique({ where: { email } }));
    const profile = existing
      ? await this.prisma.profile.update({
          where: { id: existing.id },
          data: { googleId: payload.sub, avatarUrl: existing.avatarUrl ?? payload.picture },
        })
      : await this.prisma.profile.create({
          data: { email, googleId: payload.sub, fullName: payload.name ?? '', avatarUrl: payload.picture },
        });
    return this.session(profile);
  }

  async me(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new UnauthorizedException('Please sign in again.');
    return toProfile(profile);
  }

  /** The role is read from the database here and embedded in the token. */
  private session(profile: Profile) {
    return { token: this.jwt.sign({ sub: profile.id, role: profile.role }), user: toProfile(profile) };
  }
}
