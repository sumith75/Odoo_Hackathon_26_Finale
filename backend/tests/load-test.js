// Production Concurrency & Load Testing Harness (Point 28)
// Demonstrates that the stateless architecture can be benchmarked and validated for high throughput.

const API_BASE = 'http://localhost:5000/api';
const TOTAL_REQUESTS = 200;
const CONCURRENCY = 20;

async function runBenchmark() {
  console.log('====================================================');
  console.log(`⚡ DEALFLOW360 CONCURRENCY BENCHMARK & LOAD TEST`);
  console.log(`🎯 Testing ${TOTAL_REQUESTS} total requests with ${CONCURRENCY} concurrent workers`);
  console.log('====================================================\n');

  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  const endpoints = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/admin/products' },
    { method: 'GET', path: '/admin/rules' },
    { method: 'GET', path: '/approvals/pending' },
    { method: 'GET', path: '/dashboard/metrics' }
  ];

  const startTime = Date.now();
  let requestCounter = 0;

  async function worker() {
    while (requestCounter < TOTAL_REQUESTS) {
      const idx = requestCounter++;
      const endpoint = endpoints[idx % endpoints.length];
      const reqStart = process.hrtime();

      try {
        const res = await fetch(`${API_BASE}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'x-request-id': `bench-${idx}-${Date.now()}`,
            'x-tenant-id': `tenant-${idx % 5}`
          }
        });

        const diff = process.hrtime(reqStart);
        const ms = diff[0] * 1e3 + diff[1] * 1e-6;
        latencies.push(ms);

        if (res.ok) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
      } catch (err) {
        failedRequests++;
      }
    }
  }

  // Spawn concurrent worker pool
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const totalDurationSeconds = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
  const rps = (successfulRequests / totalDurationSeconds).toFixed(1);

  console.log('📊 BENCHMARK RESULTS:');
  console.log(`   - Total Requests:      ${TOTAL_REQUESTS}`);
  console.log(`   - Concurrency Level:   ${CONCURRENCY}`);
  console.log(`   - Duration:            ${totalDurationSeconds.toFixed(2)}s`);
  console.log(`   - Throughput (RPS):    ${rps} requests/sec 🚀`);
  console.log(`   - Success Rate:        ${((successfulRequests / TOTAL_REQUESTS) * 100).toFixed(1)}%`);
  console.log(`   - Failed Requests:     ${failedRequests}`);
  console.log('\n⏱️  LATENCY DISTRIBUTION:');
  console.log(`   - Avg Latency:         ${avgLatency} ms`);
  console.log(`   - P50 (Median):        ${p50} ms`);
  console.log(`   - P95:                 ${p95} ms`);
  console.log(`   - P99:                 ${p99} ms`);
  console.log('====================================================\n');
}

runBenchmark();
