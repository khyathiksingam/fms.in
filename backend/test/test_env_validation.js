const assert = require('node:assert/strict');
const { validateEnvironment } = require('../src/server');

async function runEnvValidationTest() {
  console.log('--- Starting Startup Environment Secrets Validation Test ---');

  const originalEnv = { ...process.env };

  try {
    // 1. In production, missing DATABASE_URL must throw
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'a_very_long_valid_jwt_secret_with_32_plus_chars!';

    assert.throws(
      () => validateEnvironment(),
      /STARTUP FAILURE.*DATABASE_URL/i,
      'Startup must fail when DATABASE_URL is missing in production'
    );

    // 2. In production, missing JWT_SECRET must throw
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/ffms_prod';
    delete process.env.JWT_SECRET;

    assert.throws(
      () => validateEnvironment(),
      /STARTUP FAILURE.*JWT_SECRET/i,
      'Startup must fail when JWT_SECRET is missing in production'
    );

    // 3. Short JWT_SECRET must throw
    process.env.JWT_SECRET = 'short_secret';
    assert.throws(
      () => validateEnvironment(),
      /must be at least 32 characters long/i,
      'Startup must fail when JWT_SECRET is shorter than 32 characters'
    );

    // 4. Valid production configuration passes
    process.env.JWT_SECRET = 'a_very_long_valid_jwt_secret_with_32_plus_chars!';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/ffms_prod';
    assert.doesNotThrow(
      () => validateEnvironment(),
      'Valid production secrets must pass startup validation'
    );

    console.log('PASSED: Startup environment secrets validation verified successfully!');
  } finally {
    process.env = originalEnv;
  }
}

runEnvValidationTest().catch(err => {
  console.error('FAILED: Env validation test failed:', err);
  process.exit(1);
});
