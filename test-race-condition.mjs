/**
 * Test script to verify race condition fix in model loading
 * Simulates concurrent API requests to embedding endpoint
 */

async function testConcurrentRequests() {
  console.log('🧪 Testing Race Condition Fix\n');
  console.log('Simulating 5 concurrent requests to /api/generate-embeddings...\n');

  const testPhotoPaths = [
    '/Users/naanan/Documents/test-data/Screenshot 2025-10-05 at 6.19.54 PM.png',
    '/Users/naanan/Documents/test-data/Screenshot 2025-10-05 at 6.20.04 PM.png',
  ];

  const startTime = Date.now();

  // Send 5 concurrent requests
  const requests = Array(5).fill(null).map((_, i) => 
    fetch('http://localhost:3004/api/generate-embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoPaths: testPhotoPaths }),
    })
      .then(res => res.json())
      .then(data => ({
        requestId: i + 1,
        success: !data.error,
        embeddingCount: data.embeddings?.length || 0,
        error: data.error,
      }))
      .catch(err => ({
        requestId: i + 1,
        success: false,
        error: err.message,
      }))
  );

  console.log('⏳ Waiting for all requests to complete...\n');

  const results = await Promise.all(requests);
  const totalTime = Date.now() - startTime;

  console.log('📊 Results:\n');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} Request ${result.requestId}: ${result.success ? `${result.embeddingCount} embeddings` : result.error}`);
  });

  const successCount = results.filter(r => r.success).length;
  
  console.log(`\n📈 Summary:`);
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Success rate: ${successCount}/${results.length}`);
  console.log(`  Average per request: ${Math.round(totalTime / results.length)}ms`);

  if (successCount === results.length) {
    console.log('\n✅ PASS: All concurrent requests succeeded!');
    console.log('🎉 Race condition is properly handled.');
    return true;
  } else {
    console.log('\n❌ FAIL: Some requests failed.');
    console.log('⚠️  Race condition may still exist.');
    return false;
  }
}

// Run test
testConcurrentRequests()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(err => {
    console.error('\n💥 Test error:', err.message);
    process.exit(1);
  });



