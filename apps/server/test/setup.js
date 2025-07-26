// Jest setup file for tool tests
// This file runs before each test suite

// Increase timeout for browser and container tests
jest.setTimeout(60000);

// Global test configuration
global.testConfig = {
    browser: {
        headless: true,
        timeout: 30000
    },
    container: {
        cleanupDelay: 1000
    }
};

// Mock console methods to reduce noise during tests (optional)
if (process.env.NODE_ENV === 'test') {
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;

    // Only show important test messages
    console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('✅') || message.includes('❌') || message.includes('🎉') || message.includes('📊')) {
            originalConsoleLog(...args);
        }
    };

    console.warn = (...args) => {
        const message = args.join(' ');
        if (message.includes('⚠️') || message.includes('WARNING')) {
            originalConsoleWarn(...args);
        }
    };
}

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process in tests, just log the error
});
