// Production Request Correlation & Observability Middleware (Points 2 & 21)
import crypto from 'crypto';

export function requestCorrelationMiddleware(req, res, next) {
  // Extract or generate Request ID for distributed tracing
  const requestId = req.headers['x-request-id'] || `req-${crypto.randomBytes(8).toString('hex')}`;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Measure latency for observability
  const startTime = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const latencyMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    
    // In production, structured JSON log is consumed by CloudWatch/Datadog/Elasticsearch
    if (process.env.LOG_FORMAT === 'json') {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        tenantId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        latencyMs: Number(latencyMs),
        userAgent: req.headers['user-agent']
      }));
    }
  });

  next();
}
