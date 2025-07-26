export default {
    testMatch: [
        '**/test/**/*.test.js',
        '**/src/**/*.test.js'
    ],
    testEnvironment: 'node',
    transform: {
        '^.+\\.jsx?$': 'babel-jest'
    },
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    testTimeout: 60000, // 60 seconds for browser and container tests
    verbose: true,
    collectCoverageFrom: [
        'src/**/*.{js,ts}',
        '!src/**/*.d.ts',
        '!src/**/*.test.{js,ts}'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html']
};
