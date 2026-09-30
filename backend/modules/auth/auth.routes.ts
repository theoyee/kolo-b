import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller';
import { authenticate } from '../../middlewares/auth';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', authController.register.bind(authController));
  fastify.post('/login', authController.login.bind(authController));
  fastify.post('/refresh', authController.refreshToken.bind(authController));
  fastify.post('/logout', authController.logout.bind(authController));
  fastify.get('/me', { preHandler: [authenticate] }, authController.getProfile.bind(authController));
}
