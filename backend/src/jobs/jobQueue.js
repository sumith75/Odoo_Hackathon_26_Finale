/**
 * jobQueue.js — Lightweight Background Job Abstraction
 *
 * Provides a decoupled interface for asynchronous worker operations:
 * - enqueueJob(queueName, payload, options)
 * - registerJobHandler(queueName, handlerFn)
 *
 * Allows non-transactional work (e.g. notifications, report generation, cache warming)
 * to be processed asynchronously without blocking HTTP request threads.
 *
 * Currently backed by an in-process async worker with ready extensibility
 * to BullMQ / Redis queues without rewriting call sites.
 */

import crypto from 'crypto';

class JobQueueManager {
  constructor() {
    this.handlers = new Map();
    this.jobs = [];
    this.isProcessing = false;
  }

  /**
   * Register a worker function for a named queue
   * @param {string} queueName - e.g. 'EMAIL_NOTIFICATIONS', 'AUDIT_INGESTION'
   * @param {Function} handlerFn - async (payload, jobContext) => Promise<void>
   */
  registerJobHandler(queueName, handlerFn) {
    this.handlers.set(queueName, handlerFn);
    console.log(`📦 [JOB_QUEUE] Registered worker handler for queue: "${queueName}"`);
  }

  /**
   * Enqueue a job for background processing
   * @param {string} queueName
   * @param {Object} payload
   * @param {Object} options - { delayMs, priority, retries }
   * @returns {Object} Job descriptor { id, queueName, status, enqueuedAt }
   */
  async enqueueJob(queueName, payload = {}, options = {}) {
    const job = {
      id: `job-${crypto.randomBytes(6).toString('hex')}`,
      queueName,
      payload,
      options,
      status: 'QUEUED',
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
      maxRetries: options.retries || 3,
    };

    if (options.delayMs && options.delayMs > 0) {
      setTimeout(() => {
        this.jobs.push(job);
        this._processNext();
      }, options.delayMs);
    } else {
      // Dispatch immediately in next microtask
      setImmediate(() => {
        this.jobs.push(job);
        this._processNext();
      });
    }

    return {
      id: job.id,
      queueName,
      status: job.status,
      enqueuedAt: job.enqueuedAt,
    };
  }

  async _processNext() {
    if (this.isProcessing || this.jobs.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.jobs.shift();

    const handler = this.handlers.get(job.queueName);
    if (!handler) {
      console.warn(`⚠️ [JOB_QUEUE] No registered handler for queue: "${job.queueName}". Job ${job.id} discarded.`);
      this.isProcessing = false;
      this._processNext();
      return;
    }

    try {
      job.status = 'RUNNING';
      job.attempts += 1;
      await handler(job.payload, { jobId: job.id, enqueuedAt: job.enqueuedAt });
      job.status = 'COMPLETED';
    } catch (err) {
      console.error(`❌ [JOB_QUEUE] Job ${job.id} on "${job.queueName}" failed:`, err.message);
      if (job.attempts < job.maxRetries) {
        job.status = 'RETRYING';
        this.jobs.push(job);
      } else {
        job.status = 'FAILED';
      }
    } finally {
      this.isProcessing = false;
      if (this.jobs.length > 0) {
        this._processNext();
      }
    }
  }

  getStats() {
    return {
      pendingJobs: this.jobs.length,
      registeredQueues: Array.from(this.handlers.keys()),
      isProcessing: this.isProcessing,
    };
  }
}

export const jobQueue = new JobQueueManager();

// Register standard background queues
jobQueue.registerJobHandler('CUSTOMER_NOTIFICATION', async (payload) => {
  // Simulates asynchronous push/email notification dispatch
  // console.log(`[NOTIFY] Sent notification to ${payload.email || payload.customerId}`);
});

jobQueue.registerJobHandler('DOCUMENT_GENERATION', async (payload) => {
  // Simulates background PDF generation for quotations and invoices
  // console.log(`[DOC_GEN] Generated document for ${payload.quotationId || payload.invoiceId}`);
});

export default jobQueue;
