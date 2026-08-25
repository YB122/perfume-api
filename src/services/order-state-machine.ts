import type { SubOrderStatus } from '../models/Order';

const ALLOWED_TRANSITIONS: Record<SubOrderStatus, SubOrderStatus[]> = {
  awaiting_confirmation: ['confirmed', 'cancelled_by_vendor', 'cancelled_by_customer'],
  confirmed: ['preparing', 'cancelled_by_vendor'],
  preparing: ['shipped', 'cancelled_by_vendor'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled_by_vendor: [],
  cancelled_by_customer: [],
  refunded: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: SubOrderStatus, to: SubOrderStatus) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition(from: SubOrderStatus, to: SubOrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionSubOrder(from: SubOrderStatus, to: SubOrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
