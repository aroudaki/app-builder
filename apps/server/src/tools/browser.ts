import { Browser, BrowserContext, Page, chromium, firefox, webkit, ElementHandle } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

/**
 * Helper function to safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Browser configuration options
 */
export interface BrowserOptions {
    headless?: boolean;
    browserType?: 'chromium' | 'firefox' | 'webkit';
    viewport?: { width: number; height: number };
    userAgent?: string;
    timeout?: number;
    recordVideo?: boolean;
    slowMo?: number;
}

/**
 * Screenshot capture options
 */
export interface ScreenshotOptions {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
    annotations?: Annotation[];
    highlightElements?: string[];
    format?: 'png' | 'jpeg';
    quality?: number;
}

/**
 * Element information structure
 */
export interface ElementInfo {
    tagName: string;
    textContent: string;
    innerHTML: string;
    attributes: Record<string, string>;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    computedStyles: Record<string, string>;
    isVisible: boolean;
    isEnabled: boolean;
    classList: string[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
    memoryUsage: number;
    requestCount: number;
    responseSize: number;
}

/**
 * Console error information
 */
export interface ConsoleError {
    type: 'error' | 'warning' | 'info' | 'debug';
    message: string;
    source: string;
    timestamp: Date;
    stackTrace?: string;
}

/**
 * Accessibility report
 */
export interface A11yReport {
    violations: A11yViolation[];
    passes: A11yPass[];
    incomplete: A11yIncomplete[];
    score: number;
}

export interface A11yViolation {
    id: string;
    description: string;
    impact: 'minor' | 'moderate' | 'serious' | 'critical';
    nodes: A11yNode[];
}

export interface A11yPass {
    id: string;
    description: string;
    nodes: A11yNode[];
}

export interface A11yIncomplete {
    id: string;
    description: string;
    nodes: A11yNode[];
}

export interface A11yNode {
    selector: string;
    html: string;
    target: string[];
}

/**
 * Point coordinate
 */
export interface Point {
    x: number;
    y: number;
}

/**
 * Recorded action for playback
 */
export interface Action {
    type: 'click' | 'type' | 'scroll' | 'hover' | 'navigate' | 'wait' | 'keyPress';
    selector?: string;
    coordinates?: Point;
    text?: string;
    url?: string;
    delay?: number;
    key?: string;
    timestamp: number;
}

/**
 * Annotation for screenshots
 */
export interface Annotation {
    type: 'arrow' | 'circle' | 'rectangle' | 'text';
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    color?: string;
}

/**
 * Agent action for Computer Use integration
 */
export interface AgentAction {
    type: 'click' | 'type' | 'scroll' | 'wait' | 'assert' | 'navigate' | 'evaluate';
    target?: string; // Natural language description or selector
    value?: string;
    coordinates?: Point;
    condition?: string;
    script?: string;
}

/**
 * Action execution result
 */
export interface ActionResult {
    success: boolean;
    message?: string;
    screenshot?: Buffer;
    elementInfo?: ElementInfo;
    value?: any;
    error?: string;
}

/**
 * Viewport capture for Computer Use Agent
 */
export interface ViewportCapture {
    screenshot: Buffer;
    elements: AnnotatedElement[];
    dimensions: { width: number; height: number };
    url: string;
    timestamp: Date;
}

/**
 * Annotated element for Computer Use Agent
 */
export interface AnnotatedElement {
    id: string;
    selector: string;
    tagName: string;
    textContent: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    clickable: boolean;
    interactive: boolean;
    role?: string;
    ariaLabel?: string;
}

/**
 * Browser automation tool with Playwright integration
 * Provides comprehensive browser control for testing generated applications
 * and foundation for Computer Use Agent integration
 */
export class BrowserAutomation extends EventEmitter {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private options: BrowserOptions;
    private recordingEnabled: boolean = false;
    private recordedActions: Action[] = [];
    private consoleErrors: ConsoleError[] = [];
    private performanceStartTime: number = 0;
    private screenshotCounter: number = 0;
    private conversationId: string;

    constructor(conversationId: string, options: BrowserOptions = {}) {
        super();
        this.conversationId = conversationId;
        this.options = {
            headless: true,
            browserType: 'chromium',
            viewport: { width: 1920, height: 1080 },
            timeout: 30000,
            recordVideo: false,
            slowMo: 0,
            ...options
        };
    }

    /**
     * Initialize browser instance
     */
    async initialize(): Promise<void> {
        try {
            // Launch browser based on type
            const browserType = this.options.browserType!;
            const launchOptions = {
                headless: this.options.headless,
                slowMo: this.options.slowMo,
                timeout: this.options.timeout
            };

            switch (browserType) {
                case 'firefox':
                    this.browser = await firefox.launch(launchOptions);
                    break;
                case 'webkit':
                    this.browser = await webkit.launch(launchOptions);
                    break;
                default:
                    this.browser = await chromium.launch(launchOptions);
            }

            // Create browser context
            const contextOptions: any = {
                viewport: this.options.viewport,
                userAgent: this.options.userAgent
            };

            if (this.options.recordVideo) {
                contextOptions.recordVideo = {
                    dir: path.join(process.cwd(), 'temp', 'videos', this.conversationId),
                    size: this.options.viewport
                };
            }

            this.context = await this.browser.newContext(contextOptions);

            // Create page
            this.page = await this.context.newPage();

            // Set up console error monitoring
            this.page.on('console', (msg) => {
                if (msg.type() === 'error' || msg.type() === 'warning') {
                    this.consoleErrors.push({
                        type: msg.type() as 'error' | 'warning',
                        message: msg.text(),
                        source: msg.location().url || 'unknown',
                        timestamp: new Date()
                    });
                }
            });

            // Set up page error monitoring
            this.page.on('pageerror', (error) => {
                this.consoleErrors.push({
                    type: 'error',
                    message: error.message,
                    source: 'page',
                    timestamp: new Date(),
                    stackTrace: error.stack
                });
            });

            this.emit('initialized');
        } catch (error) {
            throw new Error(`Failed to initialize browser: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Navigate to the generated app URL
     */
    async navigateToApp(url: string): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            this.performanceStartTime = Date.now();
            await this.page.goto(url, { waitUntil: 'networkidle' });

            if (this.recordingEnabled) {
                this.recordedActions.push({
                    type: 'navigate',
                    url,
                    timestamp: Date.now()
                });
            }

            this.emit('navigation', { url });
        } catch (error) {
            throw new Error(`Failed to navigate to ${url}: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Take screenshot with optional annotations
     */
    async takeScreenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            // Highlight elements if specified
            if (options.highlightElements && options.highlightElements.length > 0) {
                await this.highlightElements(options.highlightElements);
            }

            const screenshotOptions: any = {
                fullPage: options.fullPage || false,
                type: options.format || 'png'
            };

            if (options.clip) {
                screenshotOptions.clip = options.clip;
            }

            if (options.quality && options.format === 'jpeg') {
                screenshotOptions.quality = options.quality;
            }

            const screenshot = await this.page.screenshot(screenshotOptions);

            // Add annotations if specified
            if (options.annotations && options.annotations.length > 0) {
                // Note: In a full implementation, you would use a library like Sharp or Canvas
                // to add annotations to the screenshot. For now, we'll return the base screenshot.
                console.log(`Would add ${options.annotations.length} annotations to screenshot`);
            }

            this.screenshotCounter++;
            this.emit('screenshot', { counter: this.screenshotCounter });

            return screenshot;
        } catch (error) {
            throw new Error(`Failed to take screenshot: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Click on element or coordinates
     */
    async click(selector: string | Point): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            if (typeof selector === 'string') {
                await this.page.click(selector);
            } else {
                await this.page.mouse.click(selector.x, selector.y);
            }

            if (this.recordingEnabled) {
                this.recordedActions.push({
                    type: 'click',
                    selector: typeof selector === 'string' ? selector : undefined,
                    coordinates: typeof selector === 'object' ? selector : undefined,
                    timestamp: Date.now()
                });
            }

            this.emit('action', { type: 'click', target: selector });
        } catch (error) {
            throw new Error(`Failed to click on ${selector}: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Type text into input field
     */
    async type(selector: string, text: string): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            await this.page.fill(selector, text);

            if (this.recordingEnabled) {
                this.recordedActions.push({
                    type: 'type',
                    selector,
                    text,
                    timestamp: Date.now()
                });
            }

            this.emit('action', { type: 'type', target: selector, value: text });
        } catch (error) {
            throw new Error(`Failed to type in ${selector}: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Hover over element
     */
    async hover(selector: string | Point): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            if (typeof selector === 'string') {
                await this.page.hover(selector);
            } else {
                await this.page.mouse.move(selector.x, selector.y);
            }

            if (this.recordingEnabled) {
                this.recordedActions.push({
                    type: 'hover',
                    selector: typeof selector === 'string' ? selector : undefined,
                    coordinates: typeof selector === 'object' ? selector : undefined,
                    timestamp: Date.now()
                });
            }

            this.emit('action', { type: 'hover', target: selector });
        } catch (error) {
            throw new Error(`Failed to hover over ${selector}: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Scroll to element or position
     */
    async scrollTo(selector: string | Point): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            if (typeof selector === 'string') {
                await this.page.locator(selector).scrollIntoViewIfNeeded();
            } else {
                await this.page.mouse.wheel(0, selector.y);
            }

            if (this.recordingEnabled) {
                this.recordedActions.push({
                    type: 'scroll',
                    selector: typeof selector === 'string' ? selector : undefined,
                    coordinates: typeof selector === 'object' ? selector : undefined,
                    timestamp: Date.now()
                });
            }

            this.emit('action', { type: 'scroll', target: selector });
        } catch (error) {
            throw new Error(`Failed to scroll to ${selector}: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Get detailed element information
     */
    async getElementInfo(selector: string): Promise<ElementInfo> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            const element = await this.page.locator(selector).first();

            const elementInfo: ElementInfo = {
                tagName: await element.evaluate(el => el.tagName.toLowerCase()),
                textContent: await element.textContent() || '',
                innerHTML: await element.innerHTML(),
                attributes: await element.evaluate(el => {
                    const attrs: Record<string, string> = {};
                    for (const attr of el.attributes) {
                        attrs[attr.name] = attr.value;
                    }
                    return attrs;
                }),
                boundingBox: await element.boundingBox(),
                computedStyles: await element.evaluate(el => {
                    const styles = window.getComputedStyle(el);
                    return {
                        display: styles.display,
                        visibility: styles.visibility,
                        opacity: styles.opacity,
                        backgroundColor: styles.backgroundColor,
                        color: styles.color,
                        fontSize: styles.fontSize,
                        fontFamily: styles.fontFamily
                    };
                }),
                isVisible: await element.isVisible(),
                isEnabled: await element.isEnabled(),
                classList: await element.evaluate(el => Array.from(el.classList))
            };

            return elementInfo;
        } catch (error) {
            throw new Error(`Failed to get element info for ${selector}: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Execute JavaScript in page context
     */
    async evaluateScript(script: string): Promise<any> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            return await this.page.evaluate(script);
        } catch (error) {
            throw new Error(`Failed to evaluate script: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Wait for specific condition to be true
     */
    async waitForCondition(condition: string, timeout: number = 10000): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            await this.page.waitForFunction(condition, { timeout });
        } catch (error) {
            throw new Error(`Condition not met within timeout: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Start recording user actions
     */
    async startRecording(): Promise<void> {
        this.recordingEnabled = true;
        this.recordedActions = [];
        this.emit('recording_started');
    }

    /**
     * Stop recording and return action sequence
     */
    async stopRecording(): Promise<Action[]> {
        this.recordingEnabled = false;
        const actions = [...this.recordedActions];
        this.emit('recording_stopped', { actionCount: actions.length });
        return actions;
    }

    /**
     * Replay recorded actions
     */
    async playbackActions(actions: Action[]): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'navigate':
                        if (action.url) {
                            await this.navigateToApp(action.url);
                        }
                        break;
                    case 'click':
                        if (action.selector) {
                            await this.click(action.selector);
                        } else if (action.coordinates) {
                            await this.click(action.coordinates);
                        }
                        break;
                    case 'type':
                        if (action.selector && action.text) {
                            await this.type(action.selector, action.text);
                        }
                        break;
                    case 'hover':
                        if (action.selector) {
                            await this.hover(action.selector);
                        } else if (action.coordinates) {
                            await this.hover(action.coordinates);
                        }
                        break;
                    case 'scroll':
                        if (action.selector) {
                            await this.scrollTo(action.selector);
                        } else if (action.coordinates) {
                            await this.scrollTo(action.coordinates);
                        }
                        break;
                    case 'wait':
                        if (action.delay) {
                            await new Promise(resolve => setTimeout(resolve, action.delay));
                        }
                        break;
                    case 'keyPress':
                        if (action.key) {
                            await this.page.keyboard.press(action.key);
                        }
                        break;
                }

                // Add delay between actions if specified
                if (action.delay) {
                    await new Promise(resolve => setTimeout(resolve, action.delay));
                }
            } catch (error) {
                console.warn(`Failed to replay action ${action.type}:`, getErrorMessage(error));
            }
        }

        this.emit('playback_complete', { actionCount: actions.length });
    }

    /**
     * Capture viewport with element annotations for Computer Use Agent
     */
    async captureViewport(): Promise<ViewportCapture> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            const screenshot = await this.takeScreenshot({ fullPage: false });
            const viewport = this.page.viewportSize() || { width: 1920, height: 1080 };

            // Get all interactive elements
            const elements = await this.page.evaluate(() => {
                const interactiveSelectors = [
                    'button', 'input', 'textarea', 'select', 'a[href]',
                    '[onclick]', '[role="button"]', '[tabindex]'
                ];

                const elements: any[] = [];

                interactiveSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach((el, index) => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            elements.push({
                                id: `${el.tagName.toLowerCase()}_${index}`,
                                selector: selector,
                                tagName: el.tagName.toLowerCase(),
                                textContent: el.textContent?.trim() || '',
                                boundingBox: {
                                    x: rect.x,
                                    y: rect.y,
                                    width: rect.width,
                                    height: rect.height
                                },
                                clickable: true,
                                interactive: true,
                                role: el.getAttribute('role'),
                                ariaLabel: el.getAttribute('aria-label')
                            });
                        }
                    });
                });

                return elements;
            });

            return {
                screenshot,
                elements,
                dimensions: viewport,
                url: this.page.url(),
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to capture viewport: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Execute high-level action from Computer Use Agent
     */
    async executeAgentAction(action: AgentAction): Promise<ActionResult> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            let result: ActionResult = { success: false };

            switch (action.type) {
                case 'click':
                    if (action.target) {
                        // Try to find element by natural language description
                        const selector = await this.findElementByDescription(action.target);
                        await this.click(selector);
                        result = { success: true, message: `Clicked on element: ${action.target}` };
                    } else if (action.coordinates) {
                        await this.click(action.coordinates);
                        result = { success: true, message: `Clicked at coordinates: ${action.coordinates.x}, ${action.coordinates.y}` };
                    }
                    break;

                case 'type':
                    if (action.target && action.value) {
                        const selector = await this.findElementByDescription(action.target);
                        await this.type(selector, action.value);
                        result = { success: true, message: `Typed "${action.value}" into ${action.target}` };
                    }
                    break;

                case 'scroll':
                    if (action.target) {
                        const selector = await this.findElementByDescription(action.target);
                        await this.scrollTo(selector);
                        result = { success: true, message: `Scrolled to ${action.target}` };
                    } else if (action.coordinates) {
                        await this.scrollTo(action.coordinates);
                        result = { success: true, message: `Scrolled to coordinates: ${action.coordinates.x}, ${action.coordinates.y}` };
                    }
                    break;

                case 'wait':
                    if (action.condition) {
                        await this.waitForCondition(action.condition);
                        result = { success: true, message: `Waited for condition: ${action.condition}` };
                    }
                    break;

                case 'assert':
                    if (action.condition) {
                        const assertionResult = await this.evaluateScript(`(${action.condition})()`);
                        result = {
                            success: !!assertionResult,
                            message: `Assertion ${assertionResult ? 'passed' : 'failed'}: ${action.condition}`,
                            value: assertionResult
                        };
                    }
                    break;

                case 'navigate':
                    if (action.value) {
                        await this.navigateToApp(action.value);
                        result = { success: true, message: `Navigated to ${action.value}` };
                    }
                    break;

                case 'evaluate':
                    if (action.script) {
                        const evalResult = await this.evaluateScript(action.script);
                        result = {
                            success: true,
                            message: `Executed script successfully`,
                            value: evalResult
                        };
                    }
                    break;

                default:
                    result = { success: false, error: `Unknown action type: ${action.type}` };
            }

            // Take screenshot after action for debugging
            result.screenshot = await this.takeScreenshot();

            return result;
        } catch (error) {
            return {
                success: false,
                error: getErrorMessage(error),
                screenshot: await this.takeScreenshot().catch(() => Buffer.alloc(0))
            };
        }
    }

    /**
     * Run accessibility check using axe-core
     */
    async runAccessibilityCheck(): Promise<A11yReport> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            // Inject axe-core library
            await this.page.addScriptTag({
                url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js'
            });

            // Run accessibility check
            const results = await this.page.evaluate(() => {
                return new Promise((resolve) => {
                    // @ts-ignore - axe is loaded dynamically
                    window.axe.run().then((results: any) => {
                        resolve(results);
                    });
                });
            });

            // Process results
            const report: A11yReport = {
                violations: (results as any).violations.map((v: any) => ({
                    id: v.id,
                    description: v.description,
                    impact: v.impact,
                    nodes: v.nodes.map((n: any) => ({
                        selector: n.target.join(', '),
                        html: n.html,
                        target: n.target
                    }))
                })),
                passes: (results as any).passes.map((p: any) => ({
                    id: p.id,
                    description: p.description,
                    nodes: p.nodes.map((n: any) => ({
                        selector: n.target.join(', '),
                        html: n.html,
                        target: n.target
                    }))
                })),
                incomplete: (results as any).incomplete.map((i: any) => ({
                    id: i.id,
                    description: i.description,
                    nodes: i.nodes.map((n: any) => ({
                        selector: n.target.join(', '),
                        html: n.html,
                        target: n.target
                    }))
                })),
                score: this.calculateA11yScore(results as any)
            };

            return report;
        } catch (error) {
            throw new Error(`Failed to run accessibility check: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Measure performance metrics
     */
    async measurePerformance(): Promise<PerformanceMetrics> {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            const metrics = await this.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
                const paint = performance.getEntriesByType('paint');

                return {
                    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                    // Note: Some metrics require additional setup in a real implementation
                    largestContentfulPaint: 0, // Would need LCP observer
                    firstInputDelay: 0, // Would need FID observer
                    cumulativeLayoutShift: 0, // Would need CLS observer
                    memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
                    requestCount: performance.getEntriesByType('resource').length,
                    responseSize: performance.getEntriesByType('resource').reduce((total: number, resource: any) => {
                        return total + (resource.transferSize || 0);
                    }, 0)
                };
            });

            return metrics;
        } catch (error) {
            throw new Error(`Failed to measure performance: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Get console errors and warnings
     */
    async getConsoleErrors(): Promise<ConsoleError[]> {
        return [...this.consoleErrors];
    }

    /**
     * Clear console errors
     */
    clearConsoleErrors(): void {
        this.consoleErrors = [];
    }

    /**
     * Find element by natural language description
     */
    private async findElementByDescription(description: string): Promise<string> {
        // Simple implementation - in a full Computer Use Agent integration,
        // this would use AI to understand natural language and find elements
        const lowercaseDesc = description.toLowerCase();

        if (lowercaseDesc.includes('submit') || lowercaseDesc.includes('send')) {
            return 'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Send")';
        } else if (lowercaseDesc.includes('input') || lowercaseDesc.includes('text field')) {
            return 'input[type="text"], input[type="email"], textarea';
        } else if (lowercaseDesc.includes('button')) {
            return 'button';
        } else if (lowercaseDesc.includes('link')) {
            return 'a[href]';
        } else {
            // Fallback to text content matching
            return `*:has-text("${description}")`;
        }
    }

    /**
     * Highlight elements on the page
     */
    private async highlightElements(selectors: string[]): Promise<void> {
        if (!this.page) return;

        for (const selector of selectors) {
            try {
                await this.page.locator(selector).highlight();
            } catch (error) {
                console.warn(`Could not highlight element ${selector}:`, getErrorMessage(error));
            }
        }
    }

    /**
     * Calculate accessibility score
     */
    private calculateA11yScore(results: any): number {
        const total = results.violations.length + results.passes.length;
        if (total === 0) return 100;

        const weighted = results.violations.reduce((score: number, violation: any) => {
            const impact = violation.impact;
            const weight = impact === 'critical' ? 4 : impact === 'serious' ? 3 : impact === 'moderate' ? 2 : 1;
            return score - weight;
        }, total);

        return Math.max(0, Math.round((weighted / total) * 100));
    }

    /**
     * Cleanup browser resources
     */
    async cleanup(): Promise<void> {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }

            if (this.context) {
                await this.context.close();
                this.context = null;
            }

            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }

            this.emit('cleanup_complete');
        } catch (error) {
            console.warn('Error during browser cleanup:', getErrorMessage(error));
        }
    }
}

// Legacy class for backward compatibility
export class BrowserTool {
    private automation: BrowserAutomation;

    constructor(conversationId: string = 'default') {
        this.automation = new BrowserAutomation(conversationId);
    }

    async takeScreenshot(url: string): Promise<Buffer> {
        try {
            await this.automation.initialize();
            await this.automation.navigateToApp(url);
            const screenshot = await this.automation.takeScreenshot();
            await this.automation.cleanup();
            return screenshot;
        } catch (error) {
            console.error('BrowserTool.takeScreenshot error:', getErrorMessage(error));
            return Buffer.from('placeholder');
        }
    }
}
