/**
 * Test script for API input validation
 * Tests various edge cases and attack vectors
 */

const BASE_URL = 'http://localhost:3004';

const tests = [
  {
    name: 'Empty photo paths array',
    endpoint: '/api/generate-embeddings',
    method: 'POST',
    body: { photoPaths: [] },
    expectedStatus: 400,
    expectedError: 'Photo paths array cannot be empty',
  },
  {
    name: 'Too many photos (over limit)',
    endpoint: '/api/group-photos',
    method: 'POST',
    body: {
      photos: Array(1001).fill(null).map((_, i) => ({
        id: `photo-${i}`,
        path: `/test/photo${i}.jpg`,
        filename: `photo${i}.jpg`,
        selected: false,
      })),
    },
    expectedStatus: 400,
    expectedError: 'Too many photos',
  },
  {
    name: 'Invalid eps value (negative)',
    endpoint: '/api/group-photos',
    method: 'POST',
    body: {
      photos: [{ path: '/test/photo.jpg', filename: 'photo.jpg' }],
      eps: -0.5,
    },
    expectedStatus: 400,
    expectedError: 'eps must be between 0 and 1',
  },
  {
    name: 'Invalid eps value (too large)',
    endpoint: '/api/group-photos',
    method: 'POST',
    body: {
      photos: [{ path: '/test/photo.jpg', filename: 'photo.jpg' }],
      eps: 1.5,
    },
    expectedStatus: 400,
    expectedError: 'eps must be between 0 and 1',
  },
  {
    name: 'Invalid minPts (too large)',
    endpoint: '/api/group-photos',
    method: 'POST',
    body: {
      photos: [{ path: '/test/photo.jpg', filename: 'photo.jpg' }],
      minPts: 150,
    },
    expectedStatus: 400,
    expectedError: 'minPts must be between 1 and 100',
  },
  {
    name: 'Invalid minPts (float instead of integer)',
    endpoint: '/api/group-photos',
    method: 'POST',
    body: {
      photos: [{ path: '/test/photo.jpg', filename: 'photo.jpg' }],
      minPts: 2.5,
    },
    expectedStatus: 400,
    expectedError: 'minPts must be an integer',
  },
  {
    name: 'Null byte injection in path',
    endpoint: '/api/generate-embeddings',
    method: 'POST',
    body: {
      photoPaths: ['/test/photo.jpg\0/etc/passwd'],
    },
    expectedStatus: 400,
    expectedError: 'contains invalid characters',
  },
  {
    name: 'Path too long',
    endpoint: '/api/generate-embeddings',
    method: 'POST',
    body: {
      photoPaths: ['/' + 'a'.repeat(1500) + '/photo.jpg'],
    },
    expectedStatus: 400,
    expectedError: 'too long',
  },
  {
    name: 'Non-array photo paths',
    endpoint: '/api/generate-embeddings',
    method: 'POST',
    body: {
      photoPaths: 'not-an-array',
    },
    expectedStatus: 400,
    expectedError: 'must be an array',
  },
  {
    name: 'Missing folder path',
    endpoint: '/api/scan-folder',
    method: 'POST',
    body: {},
    expectedStatus: 400,
    expectedError: 'Folder path',
  },
  {
    name: 'Empty string folder path',
    endpoint: '/api/scan-folder',
    method: 'POST',
    body: { folderPath: '   ' },
    expectedStatus: 400,
    expectedError: 'cannot be empty',
  },
  {
    name: 'Too many photos for LLM',
    endpoint: '/api/select-best-photo',
    method: 'POST',
    body: {
      photoPaths: Array(20).fill(null).map((_, i) => `/test/photo${i}.jpg`),
    },
    expectedStatus: 400,
    expectedError: 'Too many photos (max 10)',
  },
];

async function runTests() {
  console.log('🧪 Running Input Validation Tests\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const response = await fetch(`${BASE_URL}${test.endpoint}`, {
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.body),
      });

      const data = await response.json().catch(() => ({ error: response.statusText }));

      const statusMatch = response.status === test.expectedStatus;
      const errorMatch = data.error && data.error.toLowerCase().includes(test.expectedError.toLowerCase());

      if (statusMatch && errorMatch) {
        console.log(`✅ PASS: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Expected status: ${test.expectedStatus}, got: ${response.status}`);
        console.log(`   Expected error to contain: "${test.expectedError}"`);
        console.log(`   Got error: "${data.error}"`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 ERROR: ${test.name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Passed: ${passed}/${tests.length}`);
  console.log(`   Failed: ${failed}/${tests.length}`);
  console.log(`   Success rate: ${Math.round((passed / tests.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All validation tests passed!');
    return true;
  } else {
    console.log('\n⚠️  Some validation tests failed.');
    return false;
  }
}

// Run tests
runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('\n💥 Test suite error:', err);
    process.exit(1);
  });

