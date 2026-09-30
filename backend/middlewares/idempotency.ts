import { FastifyRequest, FastifyReply } from 'fastify';

interface IdempotentRecord {
  statusCode: number;
  payload: any;
  timestamp: number;
}

const idempotencyStore = new Map<string, IdempotentRecord>();
const TTL_MS = 10 * 60 * 1000;

export async function handleIdempotency(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const idempotencyKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;

  if (!idempotencyKey) return;

  request.idempotencyKey = idempotencyKey;
  const businessId = request.tenant?.businessId || 'global';
  const compositeKey = `${businessId}:${idempotencyKey}`;

  const cached = idempotencyStore.get(compositeKey);
  if (cached && Date.now() - cached.timestamp < TTL_MS) {
    reply.header('x-cache-lookup', 'HIT');
    reply.header('x-idempotency-replay', 'true');
    reply.code(cached.statusCode).send(cached.payload);
  }
}

export function saveIdempotentResponse(compositeKey: string, statusCode: number, payload: any): void {
  if (idempotencyStore.size > 2000) {
    const now = Date.now();
    for (const [key, value] of idempotencyStore.entries()) {
      if (now - value.timestamp > TTL_MS) {
        idempotencyStore.delete(key);
      }
    }
  }

  idempotencyStore.set(compositeKey, {
    statusCode,
    payload,
    timestamp: Date.now(),
  });
}
