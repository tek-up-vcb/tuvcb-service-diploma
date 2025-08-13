import { makeCounterProvider, makeHistogramProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';

export const DIPLOMA_METRICS_PROVIDERS = [
  makeCounterProvider({
    name: 'tuvcb_diploma_requests_total',
    help: 'Total number of diploma requests',
    labelNames: ['status'],
  }),
  makeCounterProvider({
    name: 'tuvcb_diploma_signatures_total',
    help: 'Total number of diploma signatures',
    labelNames: ['status'],
  }),
  makeHistogramProvider({
    name: 'tuvcb_diploma_processing_duration_seconds',
    help: 'Duration of diploma processing operations in seconds',
    labelNames: ['operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),
  makeGaugeProvider({
    name: 'tuvcb_diploma_pending_requests',
    help: 'Number of pending diploma requests',
  }),
];
