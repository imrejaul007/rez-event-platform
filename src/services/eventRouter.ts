import { logger } from '../config/logger';

// ── Subscriber routing table (from ARCHITECTURE-INTEGRATION.md) ─────────────

const ROUTING_TABLE: Record<string, string[]> = {
  'order.completed': ['automation-service', 'analytics-service', 'rez-gamification-service'],
  'order.created': ['automation-service', 'analytics-service'],
  'order.cancelled': ['automation-service', 'analytics-service'],
  'payment.success': ['automation-service', 'wallet-service', 'analytics-service'],
  'payment.failed': ['automation-service', 'wallet-service'],
  'wallet.balance_changed': ['automation-service', 'analytics-service'],
  'inventory.low': ['automation-service', 'analytics-service', 'rez-feedback-service'],
  'intent.captured': ['insights-service', 'analytics-service', 'rez-action-engine'],
  'insight.generated': ['automation-service', 'copilot-ui'],
  'hotel.booking.created': ['automation-service', 'analytics-service'],
  'hotel.room.checked_in': ['automation-service'],
  'hotel.room.checked_out': ['automation-service', 'analytics-service'],
  'automation.rule_triggered': ['logging-service'],
};

export interface RoutingResult {
  subscribers: string[];
  matched: boolean;
}

export function routeEvent(eventType: string): RoutingResult {
  const subscribers = ROUTING_TABLE[eventType] || [];

  if (subscribers.length === 0) {
    logger.debug('No subscribers for event', { eventType });
    return { subscribers: [], matched: false };
  }

  logger.info('Event routed to subscribers', { eventType, subscribers });
  return { subscribers, matched: true };
}

export function getAllRoutes(): Record<string, string[]> {
  return { ...ROUTING_TABLE };
}
