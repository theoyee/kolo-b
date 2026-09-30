import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.schemas';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input, (request.server as any).jwt);
    return reply.status(201).send({
      success: true,
      message: 'Account successfully registered',
      data: result,
    });
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input, (request.server as any).jwt);
    return reply.status(200).send({
      success: true,
      message: 'Authentication successful',
      data: result,
    });
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const input = refreshTokenSchema.parse(request.body);
    const result = await authService.refreshToken(input, (request.server as any).jwt);
    return reply.status(200).send({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const token = (request.body as any)?.refreshToken;
    const result = await authService.logout(token);
    return reply.status(200).send(result);
  }

  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    const result = await authService.getProfile(request.user!.userId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}

export const authController = new AuthController();
