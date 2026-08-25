export interface CommissionInput {
  itemSubtotal: number; // price × quantity before discount
  vendorCommissionRate: number; // percentage, e.g. 15.00
  categoryOverrideRate?: number;
  couponDiscount?: number;
}

export interface CommissionResult {
  grossAmount: number;
  netDiscount: number;
  commissionBase: number;
  platformCommission: number;
  vendorPayout: number;
}

// Pure, DB-agnostic. Commission is calculated after discount (plan 4.1).
export function calculateCommission(input: CommissionInput): CommissionResult {
  const effectiveRate = input.categoryOverrideRate ?? input.vendorCommissionRate;
  const netDiscount = input.couponDiscount ?? 0;
  const commissionBase = Math.max(0, input.itemSubtotal - netDiscount);

  const platformCommission = roundToTwoDecimals(commissionBase * (effectiveRate / 100));

  return {
    grossAmount: input.itemSubtotal,
    netDiscount,
    commissionBase,
    platformCommission,
    vendorPayout: roundToTwoDecimals(commissionBase - platformCommission),
  };
}

export function roundToTwoDecimals(n: number): number {
  return Math.round(n * 100) / 100;
}
