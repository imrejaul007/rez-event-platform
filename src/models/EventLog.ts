import mongoose, { Schema, Document } from 'mongoose';

export interface IEventLog extends Document {
  eventId: string;
  event: string;
  version: string;
  correlationId: string;
  source: string;
  timestamp: number;
  data: Record<string, unknown>;
  routingResult?: {
    subscribers: string[];
    matched: boolean;
  };
  validationStatus: 'valid' | 'invalid' | 'error';
  validationErrors?: string[];
  processedAt?: Date;
  createdAt: Date;
}

const EventLogSchema = new Schema<IEventLog>(
  {
    eventId: { type: String, required: true, index: true },
    event: { type: String, required: true, index: true },
    version: { type: String, required: true },
    correlationId: { type: String, required: true, index: true },
    source: { type: String, required: true, index: true },
    timestamp: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    routingResult: {
      subscribers: [String],
      matched: Boolean,
    },
    validationStatus: {
      type: String,
      enum: ['valid', 'invalid', 'error'],
      required: true,
    },
    validationErrors: [String],
    processedAt: Date,
  },
  { timestamps: true }
);

EventLogSchema.index({ event: 1, createdAt: -1 });
EventLogSchema.index({ source: 1, createdAt: -1 });

export const EventLog = mongoose.model<IEventLog>('EventLog', EventLogSchema);
