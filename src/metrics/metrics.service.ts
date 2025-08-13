import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly diplomaRequestsCounter: Counter<string>;
  private readonly signaturesCounter: Counter<string>;
  private readonly processingDurationHistogram: Histogram<string>;
  private readonly pendingRequestsGauge: Gauge<string>;

  constructor() {
    // Initialisation des métriques
    this.diplomaRequestsCounter = new Counter({
      name: 'tuvcb_diploma_requests_total',
      help: 'Total number of diploma requests',
      labelNames: ['status'],
    });

    this.signaturesCounter = new Counter({
      name: 'tuvcb_diploma_signatures_total',
      help: 'Total number of diploma signatures',
      labelNames: ['status'],
    });

    this.processingDurationHistogram = new Histogram({
      name: 'tuvcb_diploma_processing_duration_seconds',
      help: 'Duration of diploma processing operations in seconds',
      labelNames: ['operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.pendingRequestsGauge = new Gauge({
      name: 'tuvcb_diploma_pending_requests',
      help: 'Number of pending diploma requests',
    });

    // Enregistrement des métriques
    register.registerMetric(this.diplomaRequestsCounter);
    register.registerMetric(this.signaturesCounter);
    register.registerMetric(this.processingDurationHistogram);
    register.registerMetric(this.pendingRequestsGauge);
  }

  // Méthodes pour incrémenter les métriques
  incrementDiplomaRequests(status: 'created' | 'approved' | 'rejected') {
    this.diplomaRequestsCounter.labels({ status }).inc();
  }

  incrementSignatures(status: 'success' | 'failure') {
    this.signaturesCounter.labels({ status }).inc();
  }

  recordProcessingDuration(operation: string, duration: number) {
    this.processingDurationHistogram.labels({ operation }).observe(duration);
  }

  setPendingRequests(count: number) {
    this.pendingRequestsGauge.set(count);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
