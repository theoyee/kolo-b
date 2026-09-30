import prisma from '../../db/prisma';
import { UpdateSettingsInput } from './setting.schemas';
import { recordAuditLog } from '../../middlewares/audit';

export class SettingService {
  async getSettings(businessId: string) {
    let settings = await prisma.businessSetting.findUnique({
      where: { businessId },
    });

    if (!settings) {
      settings = await prisma.businessSetting.create({
        data: {
          businessId,
          allowNegativeStock: false,
          vatRateBps: 750,
          currencySymbol: '₦',
          invoicePrefix: 'KOLO-',
          bankName: 'Moniepoint Microfinance Bank',
          bankAccountNumber: '8239019201',
          bankAccountName: 'Mama Chinedu Supermarket & Provisions',
          bankTransferInstructions: 'Transfer to this account and upload your payment receipt or enter session ID.',
        },
      });
    }

    return settings;
  }

  async updateSettings(businessId: string, userId: string, input: UpdateSettingsInput) {
    const updated = await prisma.businessSetting.upsert({
      where: { businessId },
      update: {
        allowNegativeStock: input.allowNegativeStock,
        vatRateBps: input.vatRateBps,
        currencySymbol: input.currencySymbol,
        receiptNotes: input.receiptNotes,
        invoicePrefix: input.invoicePrefix,
        lowStockThresholdDefault: input.lowStockThresholdDefault,
        bankName: input.bankName,
        bankAccountNumber: input.bankAccountNumber,
        bankAccountName: input.bankAccountName,
        bankTransferInstructions: input.bankTransferInstructions,
      },
      create: {
        businessId,
        allowNegativeStock: input.allowNegativeStock ?? false,
        vatRateBps: input.vatRateBps ?? 750,
        currencySymbol: input.currencySymbol ?? '₦',
        receiptNotes: input.receiptNotes,
        invoicePrefix: input.invoicePrefix ?? 'KOLO-',
        lowStockThresholdDefault: input.lowStockThresholdDefault ?? 10,
        bankName: input.bankName ?? 'Moniepoint Microfinance Bank',
        bankAccountNumber: input.bankAccountNumber ?? '8239019201',
        bankAccountName: input.bankAccountName ?? 'Kolo SME Merchant',
        bankTransferInstructions: input.bankTransferInstructions,
      },
    });

    await recordAuditLog({
      businessId,
      userId,
      action: 'SETTINGS_UPDATED',
      entity: 'BusinessSetting',
      entityId: updated.id,
      details: input,
    });

    return updated;
  }
}

export const settingService = new SettingService();
