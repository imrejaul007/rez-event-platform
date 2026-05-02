import { z } from 'zod';
import { logger } from '../config/logger';

// ── Event Header Schema (from EVENT-SCHEMAS.md) ──────────────────────────────

const EventHeaderSchema = z.object({
  event: z.string().regex(/^[a-z]+\.[a-z]+$/, 'Format: domain.action (e.g. inventory.low)'),
  version: z.string().regex(/^v\d+$/, 'Format: v1, v2, etc.'),
  correlation_id: z.string().uuid('Must be valid UUID v4'),
  source: z.string().min(1).max(100),
  timestamp: z.number().int().positive('Must be positive Unix ms'),
});

// ── Domain-specific event data schemas (from EVENT-SCHEMAS.md) ─────────────

const InventoryLowDataSchema = z.object({
  merchant_id: z.string().uuid(),
  store_id: z.string().uuid(),
  item_id: z.string().uuid(),
  item_name: z.string().min(1).max(255),
  current_stock: z.number().int().min(0),
  threshold: z.number().int().positive(),
  unit: z.string().min(1).max(50),
  supplier_id: z.string().uuid().optional(),
});

const OrderItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

const OrderCompletedDataSchema = z.object({
  order_id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  total_amount: z.number().min(0),
  coin_discount: z.number().min(0),
  items: z.array(OrderItemSchema).min(1),
  payment_method: z.enum(['cash', 'card', 'digital_wallet', 'crypto', 'coin_balance']),
  coins_earned: z.number().int().min(0),
});

const PaymentSuccessDataSchema = z.object({
  payment_id: z.string().min(1).max(100),
  order_id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'card', 'digital_wallet', 'crypto', 'coin_balance']),
  gateway: z.string().min(1).max(100),
  gateway_transaction_id: z.string().min(1).max(255),
  coins_credited: z.number().int().min(0),
  cashback_amount: z.number().min(0),
});

// ── Full event schemas ─────────────────────────────────────────────────────

export const InventoryLowEventSchema = EventHeaderSchema.extend({
  event: z.literal('inventory.low'),
  data: InventoryLowDataSchema,
});

export const OrderCompletedEventSchema = EventHeaderSchema.extend({
  event: z.literal('order.completed'),
  data: OrderCompletedDataSchema,
});

export const PaymentSuccessEventSchema = EventHeaderSchema.extend({
  event: z.literal('payment.success'),
  data: PaymentSuccessDataSchema,
});

// Union of all known schemas
const KNOWN_SCHEMAS = [
  InventoryLowEventSchema,
  OrderCompletedEventSchema,
  PaymentSuccessEventSchema,
] as const;

// Union type for all events
export type AnyEvent =
  | z.infer<typeof InventoryLowEventSchema>
  | z.infer<typeof OrderCompletedEventSchema>
  | z.infer<typeof PaymentSuccessEventSchema>;

// ── Validation utility ──────────────────────────────────────────────────────

export class EventValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(message);
    this.name = 'EventValidationError';
  }
}

export function validateEvent(payload: unknown): AnyEvent {
  // Try known schemas first
  for (const schema of KNOWN_SCHEMAS) {
    const result = schema.safeParse(payload);
    if (result.success) {
      return result.data;
    }
    // Try next schema
  }

  // Fall back to generic header validation
  const headerResult = EventHeaderSchema.safeParse(payload);
  if (!headerResult.success) {
    const errors = headerResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new EventValidationError('Event validation failed', errors);
  }

  // Unknown event type — accept but log warning
  logger.warn('Unknown event type received', {
    event: (payload as Record<string, unknown>).event,
    source: (payload as Record<string, unknown>).source,
  });

  return payload as AnyEvent;
}

export function getKnownEventTypes(): string[] {
  return ['inventory.low', 'order.completed', 'payment.success'];
}
