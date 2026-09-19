process.env.JWT_SECRET =
  'SMART_RH_TEST_ONLY_SESSION_JWT_SECRET_2026_000000000001';

process.env.ADMIN_ACCESS_JWT_SECRET =
  'SMART_RH_TEST_ONLY_ADMIN_ACCESS_JWT_SECRET_2026_000000000002';

process.env.ADMIN_ACCESS_HMAC_SECRET =
  'SMART_RH_TEST_ONLY_ADMIN_ACCESS_HMAC_SECRET_2026_000000000003';


module.exports = {
  testEnvironment: 'node',

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'CommonJS',
          moduleResolution: 'Node',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          types: [
            'node',
            'jest',
          ],
        },
      },
    ],
  },

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
  ],

  clearMocks: true,
};
