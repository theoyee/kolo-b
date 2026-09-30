import { FastifyRequest, FastifyReply } from 'fastify';
import { settingService } from './setting.service';
import { updateSettingsSchema } from './setting.schemas';

export class SettingController {
  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const result = await settingService.getSettings(request.tenant!.businessId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const input = updateSettingsSchema.parse(request.body);
    const result = await settingService.updateSettings(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(200).send({
      success: true,
      message: 'Business settings updated',
      data: result,
    });
  }
}

export const settingController = new SettingController();
