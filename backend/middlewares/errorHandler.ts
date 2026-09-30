import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors';

export function globalErrorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof ZodError) {
    const rawIssues: any[] = (error as any).issues || (error as any).errors || [];
    const formattedErrors = rawIssues.map((err: any) => ({
      field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
      message: err.message,
      rule: err.code,
    }));

    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data provided',
        details: formattedErrors,
      },
    });
  }

  const prismaError = error as any;
  if (prismaError?.code === 'P2002') {
    const target = (prismaError.meta?.target as string[])?.join(', ') || 'field';
    return reply.status(409).send({
      success: false,
      error: {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: `A record with this ${target} already exists`,
      },
    });
  }

  if (prismaError?.code === 'P2025') {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: prismaError.meta?.cause || 'Requested record was not found',
      },
    });
  }

  request.log.error(error);
  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected internal error occurred' 
        : error.message,
    },
  });
}
