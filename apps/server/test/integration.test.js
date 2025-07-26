import { testAppContainer } from './containerTest.js';
import { BrowserAutomation } from '../dist/src/tools/browser.js';

describe('Tool Integration Tests', () => {
  test('should run complete tool test suite', async () => {
    let containerPassed = false;
    let browserPassed = false;

    // Test App Container Tool
    try {
      await testAppContainer();
      containerPassed = true;
    } catch (error) {
      console.error('Container test failed:', error.message);
    }

    // Test Browser Automation Tool
    let browser;
    try {
      browser = new BrowserAutomation();
      await browser.initialize();
      await browser.navigateToApp('https://example.com');
      const screenshot = await browser.captureScreenshot();
      expect(screenshot).toBeDefined();
      browserPassed = true;
    } catch (error) {
      console.error('Browser test failed:', error.message);
    } finally {
      if (browser) {
        await browser.cleanup();
      }
    }

    // Both tools should pass
    expect(containerPassed).toBe(true);
    expect(browserPassed).toBe(true);
  }, 90000); // 90 seconds total timeout

  test('should validate all tool exports', async () => {
    // Test that we can import all tools
    const { AppContainer } = await import('../dist/src/tools/appContainer.js');
    const { BrowserAutomation } = await import('../dist/src/tools/browser.js');
    
    expect(AppContainer).toBeDefined();
    expect(BrowserAutomation).toBeDefined();
    
    // Test that tools can be instantiated
    const container = new AppContainer('test-exports');
    const browser = new BrowserAutomation();
    
    expect(container).toBeInstanceOf(AppContainer);
    expect(browser).toBeInstanceOf(BrowserAutomation);
    
    // Cleanup
    await container.cleanup(100);
    await browser.cleanup();
  });
});
