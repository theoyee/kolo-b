import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../db/prisma';
import { config } from '../../config';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../errors';
import { RegisterInput, LoginInput, RefreshTokenInput } from './auth.schemas';
import { JwtUserPayload, Role, ROLE_PERMISSIONS } from '../../types';
import { recordAuditLog } from '../../middlewares/audit';

export class AuthService {
  async register(input: RegisterInput, fastifyJwt: any) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email address already exists');
    }

    const salt = await bcrypt.genSalt(config.saltRounds);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone || null,
        },
      });

      let business = null;
      let member = null;

      if (input.businessName) {
        const slug =
          input.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 50) + '-' + Math.floor(1000 + Math.random() * 9000);

        business = await tx.business.create({
          data: {
            name: input.businessName,
            slug,
            email: input.email.toLowerCase(),
            phone: input.phone || null,
          },
        });

        await tx.businessSetting.create({
          data: {
            businessId: business.id,
            allowNegativeStock: false,
            vatRateBps: 750,
            currencySymbol: '₦',
            invoicePrefix: 'KOLO-',
            bankName: 'Moniepoint Microfinance Bank',
            bankAccountNumber: '8239019201',
            bankAccountName: input.businessName,
          },
        });

        member = await tx.member.create({
          data: {
            userId: user.id,
            businessId: business.id,
            role: 'OWNER',
            permissions: ['*'],
          },
        });
      }

      return { user, business, member };
    });

    const userPayload: JwtUserPayload = {
      userId: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      isSuperAdmin: result.user.isSuperAdmin,
    };

    const accessToken = fastifyJwt.sign(userPayload, { expiresIn: config.jwtExpiresIn });
    const { refreshToken } = await this.generateRefreshToken(result.user.id);

    await recordAuditLog({
      businessId: result.business?.id,
      userId: result.user.id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: result.user.id,
      details: { email: result.user.email, createdBusiness: result.business?.name },
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        phone: result.user.phone,
      },
      business: result.business
        ? {
            id: result.business.id,
            name: result.business.name,
            slug: result.business.slug,
            role: 'OWNER',
          }
        : null,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: config.jwtExpiresIn,
      },
    };
  }

  async login(input: LoginInput, fastifyJwt: any) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            business: {
              select: { id: true, name: true, slug: true, currency: true },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedError('Invalid email or password');

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedError('Invalid email or password');

    const userPayload: JwtUserPayload = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
    };

    const accessToken = fastifyJwt.sign(userPayload, { expiresIn: config.jwtExpiresIn });
    const { refreshToken } = await this.generateRefreshToken(user.id);

    await recordAuditLog({
      userId: user.id,
      action: 'AUTH_LOGIN',
      entity: 'User',
      entityId: user.id,
      details: { email: user.email },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isSuperAdmin: user.isSuperAdmin,
      },
      businesses: user.memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        currency: m.business.currency,
        role: m.role,
        permissions: m.permissions.length > 0 ? m.permissions : ROLE_PERMISSIONS[m.role as Role] || [],
      })),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: config.jwtExpiresIn,
      },
    };
  }

  async refreshToken(input: RefreshTokenInput, fastifyJwt: any) {
    const tokenHash = crypto.createHash('sha256').update(input.refreshToken).digest('hex');

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token is invalid or expired.');
    }

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const userPayload: JwtUserPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      firstName: storedToken.user.firstName,
      lastName: storedToken.user.lastName,
      isSuperAdmin: storedToken.user.isSuperAdmin,
    };

    const accessToken = fastifyJwt.sign(userPayload, { expiresIn: config.jwtExpiresIn });
    const { refreshToken: newRefreshToken } = await this.generateRefreshToken(storedToken.user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.jwtExpiresIn,
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isSuperAdmin: true,
        createdAt: true,
        memberships: {
          where: { isActive: true },
          include: {
            business: {
              include: { settings: true },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User profile not found');
    return user;
  }

  private async generateRefreshToken(userId: string) {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.jwtRefreshExpiresInDays);

    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { refreshToken: rawToken, expiresAt };
  }
}

export const authService = new AuthService();
