import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors';
import { JwtUserPayload } from '../types';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header. Expected Bearer token.');
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = await (request.server as any).jwt.verify(token);
    request.user = decoded as JwtUserPayload;
  } catch (err: any) {
    throw new UnauthorizedError(err.message || 'Invalid or expired access token');
  }
}
