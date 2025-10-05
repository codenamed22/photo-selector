/**
 * Test script to validate LLM configuration
 * Run: node test-llm-config.mjs
 */

import { createLLMClient, getModelName, validateLLMConfig } from './src/lib/llm-client.ts';

console.log('🧪 Testing LLM Configuration...\n');

// Test validation
const validation = validateLLMConfig();
console.log('✓ Validation:', validation);
console.log('✓ Provider:', validation.provider);
console.log('✓ Model:', getModelName());

if (!validation.valid) {
  console.error('\n❌ Configuration Error:', validation.error);
  process.exit(1);
}

console.log('\n✅ LLM configuration is valid!');
console.log('💡 Ready to analyze photos');

