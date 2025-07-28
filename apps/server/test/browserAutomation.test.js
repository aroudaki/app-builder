import { BrowserAutomation } from '../dist/src/tools/browser.js';
import { browserTool } from '../dist/src/langgraph/tools/definitions.js';

describe('Browser Automation Tool', () => {
    let browser;

    beforeEach(() => {
        browser = new BrowserAutomation('test-conversation');
    });

    afterEach(async () => {
        if (browser) {
            await browser.cleanup();
        }
    });

    describe('Direct BrowserAutomation Class', () => {
        test('should initialize browser successfully', async () => {
            await browser.initialize();
            // Browser should be initialized without throwing
            expect(browser).toBeDefined();
        });

        test('should navigate to a webpage', async () => {
            await browser.initialize();
            await browser.navigateToApp('https://example.com');
            // Navigation should complete without throwing
        }, 30000);

        test('should capture screenshots', async () => {
            await browser.initialize();
            await browser.navigateToApp('https://example.com');

            const screenshot = await browser.takeScreenshot();
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

        test('should handle browser cleanup properly', async () => {
            await browser.initialize();
            await browser.navigateToApp('https://example.com');

            // Cleanup should not throw errors
            await expect(browser.cleanup()).resolves.not.toThrow();
        }, 30000);
    });

    describe('LangGraph Tool Integration', () => {
        test('should have valid tool schema', () => {
            expect(browserTool.name).toBe('browser_automation');
            expect(browserTool.description).toContain('browser automation tasks');
            expect(browserTool.schema).toBeDefined();
        });

        test('should validate tool input with Zod schema', () => {
            const validInput = { action: 'screenshot', url: 'https://example.com' };
            const parsed = browserTool.schema.parse(validInput);
            expect(parsed).toEqual(validInput);

            // Test invalid action
            expect(() => {
                browserTool.schema.parse({ action: 'invalid_action' });
            }).toThrow();
        });

        test('should execute screenshot tool and return JSON result', async () => {
            const result = await browserTool.invoke({
                action: 'screenshot',
                url: 'https://example.com'
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('action');
            expect(parsed.action).toBe('screenshot');

            if (parsed.success) {
                expect(parsed).toHaveProperty('size');
                expect(parsed).toHaveProperty('format');
            }
        }, 30000);

        test('should execute navigate tool and return JSON result', async () => {
            const result = await browserTool.invoke({
                action: 'navigate',
                url: 'https://example.com'
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('action');
            expect(parsed.action).toBe('navigate');

            if (parsed.success) {
                expect(parsed).toHaveProperty('url');
                expect(parsed.url).toBe('https://example.com');
            }
        }, 30000);

        test('should execute test tool and return comprehensive result', async () => {
            const result = await browserTool.invoke({
                action: 'test',
                url: 'https://example.com'
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('action');
            expect(parsed.action).toBe('test');

            if (parsed.success) {
                expect(parsed).toHaveProperty('elementsFound');
                expect(parsed).toHaveProperty('consoleErrors');
                expect(parsed).toHaveProperty('performance');
                expect(typeof parsed.elementsFound).toBe('number');
                expect(typeof parsed.consoleErrors).toBe('number');
            }
        }, 30000);

        test('should execute inspect tool and return element data', async () => {
            const result = await browserTool.invoke({
                action: 'inspect',
                url: 'https://example.com'
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('action');
            expect(parsed.action).toBe('inspect');

            if (parsed.success) {
                expect(parsed).toHaveProperty('elements');
                expect(Array.isArray(parsed.elements)).toBe(true);
            }
        }, 30000);

        test('should handle tool execution errors gracefully', async () => {
            const result = await browserTool.invoke({
                action: 'navigate',
                url: 'invalid-url'
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed).toHaveProperty('error');
        });
    });
});
