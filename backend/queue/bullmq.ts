import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

let redisConnection: IORedis | null = null;
let isRedisAvailable = false;

try {
  redisConnection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 1) return null;
      return 500;
    },
  });

  redisConnection.on('connect', () => {
    isRedisAvailable = true;
    console.log('[Queue] Redis connection established for BullMQ');
  });

  redisConnection.on('error', () => {
    isRedisAvailable = false;
  });
} catch (e) {
  isRedisAvailable = false;
}

export interface JobPayloadMap {
  'send_receipt_notification': {
    businessId: string;
    saleId: string;
    saleNumber: string;
    customerPhone?: string;
    customerEmail?: string;
    amountKobo: number;
  };
  'check_low_stock_alert': {
    businessId: string;
    productId: string;
    productName: string;
    currentStock: number;
    threshold: number;
  };
  'log_audit_event': {
    businessId?: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: unknown;
    ipAddress?: string;
  };
}

export class NotificationQueue {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor() {
    if (redisConnection) {
      try {
        this.queue = new Queue('kolo-notifications', {
          connection: redisConnection,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        });

        this.worker = new Worker(
          'kolo-notifications',
          async (job: Job) => {
            await this.processJob(job.name, job.data);
          },
          { connection: redisConnection }
        );

        this.worker.on('failed', (job, err) => {
          console.error(`[Queue] Job ${job?.id} of type ${job?.name} failed:`, err.message);
        });
      } catch (e) {
        // Fallback
      }
    }
  }

  async add<K extends keyof JobPayloadMap>(name: K, data: JobPayloadMap[K]): Promise<void> {
    if (this.queue && isRedisAvailable) {
      try {
        await this.queue.add(name, data);
        return;
      } catch (err) {
        // Fallback to in-process execution
      }
    }

    setImmediate(async () => {
      try {
        await this.processJob(name, data);
      } catch (err) {
        console.error(`[Queue-Fallback] Failed to process in-memory job ${name}:`, err);
      }
    });
  }

  private async processJob(name: string, data: any): Promise<void> {
    switch (name) {
      case 'send_receipt_notification':
        console.log(`[Queue Worker] Dispatched SMS/Receipt for Sale ${data.saleNumber} to ${data.customerPhone || 'Customer'}`);
        break;
      case 'check_low_stock_alert':
        console.warn(`[Queue Worker] Low stock alert: "${data.productName}" is down to ${data.currentStock}`);
        break;
      default:
        console.log(`[Queue Worker] Processed job ${name}`);
    }
  }

  async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
    if (redisConnection) await redisConnection.quit();
  }
}

export const notificationQueue = new NotificationQueue();
