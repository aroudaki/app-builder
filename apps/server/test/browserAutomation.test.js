import { BrowserAutomation } from '../dist/src/tools/browser.js';

describe('Browser Automation Tool', () => {
  let browser;

  beforeEach(() => {
    browser = new BrowserAutomation();
  });

  afterEach(async () => {
    if (browser) {
      await browser.cleanup();
    }
  });

  test('should initialize browser successfully', async () => {
    const result = await browser.initialize();
    expect(result.success).toBe(true);
    expect(result.message).toContain('Browser initialized');
  });

  test('should navigate to a webpage', async () => {
    await browser.initialize();
    
    const result = await browser.navigateToApp('https://example.com');
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://example.com/');
  }, 30000); // 30 second timeout for navigation

  test('should capture screenshots', async () => {
    await browser.initialize();
    await browser.navigateToApp('https://example.com');
    
    const screenshot = await browser.captureScreenshot();
    expect(screenshot).toBeDefined();
    expect(screenshot.length).toBeGreaterThan(1000); // Should be a reasonable file size
  }, 30000);

  test('should capture viewport with element annotations', async () => {
    await browser.initialize();
    await browser.navigateToApp('https://example.com');
    
    const viewport = await browser.captureViewport();
    expect(viewport.screenshot).toBeDefined();
    expect(viewport.elements).toBeDefined();
    expect(Array.isArray(viewport.elements)).toBe(true);
  }, 30000);

  test('should inspect page elements', async () => {
    await browser.initialize();
    await browser.navigateToApp('https://example.com');
    
    const elements = await browser.inspectElements();
    expect(Array.isArray(elements)).toBe(true);
    expect(elements.length).toBeGreaterThan(0);
    
    // Check that elements have required properties
    if (elements.length > 0) {
      const firstElement = elements[0];
      expect(firstElement).toHaveProperty('tag');
      expect(firstElement).toHaveProperty('visible');
    }
  }, 30000);

  test('should measure page performance', async () => {
    await browser.initialize();
    await browser.navigateToApp('https://example.com');
    
    const metrics = await browser.measurePerformance();
    expect(metrics).toHaveProperty('loadTime');
    expect(metrics).toHaveProperty('domContentLoaded');
    expect(typeof metrics.loadTime).toBe('number');
  }, 30000);

  test('should check for console errors', async () => {
    await browser.initialize();
    await browser.navigateToApp('https://example.com');
    
    const errors = await browser.getConsoleErrors();
    expect(Array.isArray(errors)).toBe(true);
    // Note: example.com might or might not have console errors
  }, 30000);

  test('should support different browser types', async () => {
    // Test Chromium (default)
    const chromiumBrowser = new BrowserAutomation('chromium');
    const chromiumResult = await chromiumBrowser.initialize();
    expect(chromiumResult.success).toBe(true);
    await chromiumBrowser.cleanup();

    // Test Firefox if available
    try {
      const firefoxBrowser = new BrowserAutomation('firefox');
      const firefoxResult = await firefoxBrowser.initialize();
      expect(firefoxResult.success).toBe(true);
      await firefoxBrowser.cleanup();
    } catch (error) {
      // Firefox might not be installed, that's ok
      console.log('Firefox test skipped:', error.message);
    }
  });

  test('should handle browser cleanup properly', async () => {
    await browser.initialize();
    await browser.navigateToApp('https://example.com');
    
    // Cleanup should not throw errors
    await expect(browser.cleanup()).resolves.not.toThrow();
  }, 30000);
});
