import prisma from '../db/prisma';
import { notificationQueue } from '../queue/bullmq';

export interface AuditParams {
  businessId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: params.businessId || null,
        userId: params.userId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        details: (params.details as any) || {},
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });

    await notificationQueue.add('log_audit_event', {
      businessId: params.businessId,
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      ipAddress: params.ipAddress,
    });
  } catch (err) {
    // Non-blocking
  }
}
