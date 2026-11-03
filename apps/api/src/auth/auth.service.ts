import {
  Injectable, UnauthorizedException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { bcrypt } from '../common/utils/bcrypt.util';
import { PrismaService } from '../prisma/prisma.service';
import { LoginInput, RegisterInput } from '@repo/validators';
import { AuthTokens, TokenPayload, Role } from '@repo/types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  async login(input: LoginInput): Promise<AuthTokens & { user: object }> {
    const user = await this.validateUser(input.email, input.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role as Role);

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash: _, ...safeUser } = user;
    return { ...tokens, user: safeUser };
  }

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await this.prisma.user.create({
      data: {
        employeeId: input.employeeId,
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role as Role,
        phone: input.phone,
        departmentId: input.departmentId,
      },
      select: {
        id: true, name: true, email: true, role: true,
        employeeId: true, phone: true, createdAt: true,
      },
    });

    return user;
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(
      stored.user.id, stored.user.email, stored.user.role as Role,
    );
    await this.storeRefreshToken(stored.user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, employeeId: true, name: true, email: true,
        role: true, phone: true, avatarUrl: true, isActive: true,
        lastLoginAt: true, createdAt: true,
        department: { select: { id: true, name: true } },
      },
    });
  }

  private async generateTokens(
    userId: string, email: string, role: Role,
  ): Promise<AuthTokens> {
    const payload: TokenPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: 7 * 24 * 3600 };
  }

  private async storeRefreshToken(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }
}
