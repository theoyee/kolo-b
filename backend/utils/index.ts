import { PaginationMeta, PaginatedResult } from '../types';

export function getPaginationParams(query: any, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query?.page || '1', 10));
  const rawLimit = parseInt(query?.limit || String(defaultLimit), 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? defaultLimit : rawLimit), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip, take: limit };
}

export function formatPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit) || 1;
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  return { items, meta };
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number | bigint): number {
  return Number(kobo) / 100;
}

export function formatKoboToNaira(kobo: number | bigint): string {
  const naira = koboToNaira(kobo);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    currencyDisplay: 'narrowSymbol',
  }).format(naira);
}
