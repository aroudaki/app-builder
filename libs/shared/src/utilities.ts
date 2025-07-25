import { ConversationSnapshot, Context, AgUiEvent } from './types.js';

/**
 * Generates a UUID v4 string
 */
export function generateUUID(): string {
    // Simple UUID v4 implementation for browser/node compatibility
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback implementation
    return 'xxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Gets the current timestamp in ISO format
 */
export function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Creates a conversation snapshot for persistence
 */
export function createSnapshot(
    conversationId: string,
    context: Context,
    events: AgUiEvent[],
    version: number = 1
): ConversationSnapshot {
    return {
        conversationId,
        version,
        timestamp: getTimestamp(),
        context: {
            ...context,
            // Remove EventEmitter from context for serialization
            events: undefined as any
        },
        events,
        artifacts: {
            wireframe: context.wireframe,
            generatedFiles: context.generatedCode,
        }
    };
}

/**
 * Serializes a conversation snapshot to JSON
 */
export function serializeSnapshot(snapshot: ConversationSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
}

/**
 * Deserializes a conversation snapshot from JSON
 */
export function deserializeSnapshot(data: string): ConversationSnapshot {
    try {
        return JSON.parse(data);
    } catch (error) {
        throw new Error(`Failed to deserialize snapshot: ${error}`);
    }
}

/**
 * Validates a conversation snapshot structure
 */
export function validateSnapshot(snapshot: any): snapshot is ConversationSnapshot {
    return (
        typeof snapshot === 'object' &&
        typeof snapshot.conversationId === 'string' &&
        typeof snapshot.version === 'number' &&
        typeof snapshot.timestamp === 'string' &&
        typeof snapshot.context === 'object' &&
        Array.isArray(snapshot.events)
    );
}

/**
 * Creates a deep clone of an object (for immutable updates)
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
        const cloned = {} as T;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }

    return obj;
}

/**
 * Sanitizes user input to prevent XSS and other attacks
 */
export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim()
        .substring(0, 10000); // Limit length
}

/**
 * Validates a conversation ID format
 */
export function isValidConversationId(id: string): boolean {
    if (typeof id !== 'string') {
        return false;
    }

    // Should be a UUID or similar format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) || /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

/**
 * Creates a safe filename from a string
 */
export function createSafeFilename(input: string): string {
    return input
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 255);
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
}

/**
 * Creates a promise that resolves after a specified delay
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                throw lastError;
            }

            const delayMs = baseDelay * Math.pow(2, attempt);
            await delay(delayMs);
        }
    }

    throw lastError!;
}
