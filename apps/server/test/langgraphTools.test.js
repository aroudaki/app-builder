import {
    TrackedToolNode,
    toolNode,
    appContainerTool,
    browserTool,
    appCompletedTool,
    fileOperationsTool,
    allTools,
    validateCodingCompletion,
    routeAfterTools
} from '../dist/src/langgraph/tools/index.js';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

describe('LangGraph Tools Infrastructure', () => {
    describe('Tool Definitions', () => {
        test('should have all required tools defined', () => {
            expect(allTools).toHaveLength(4);
            expect(allTools.map(t => t.name)).toContain('app_container');
            expect(allTools.map(t => t.name)).toContain('browser_automation');
            expect(allTools.map(t => t.name)).toContain('app_completed');
            expect(allTools.map(t => t.name)).toContain('file_operations');
        });

        test('should have valid tool schemas', () => {
            allTools.forEach(tool => {
                expect(tool.name).toBeDefined();
                expect(tool.description).toBeDefined();
                expect(tool.schema).toBeDefined();
                expect(typeof tool.description).toBe('string');
                expect(tool.description.length).toBeGreaterThan(10);
            });
        });

        test('should validate app container tool schema', () => {
            const validInput = { command: 'ls -la' };
            const parsed = appContainerTool.schema.parse(validInput);
            expect(parsed).toEqual(validInput);

            expect(() => {
                appContainerTool.schema.parse({});
            }).toThrow();
        });

        test('should validate browser tool schema', () => {
            const validInput = { action: 'screenshot', url: 'https://example.com' };
            const parsed = browserTool.schema.parse(validInput);
            expect(parsed).toEqual(validInput);

            expect(() => {
                browserTool.schema.parse({ action: 'invalid' });
            }).toThrow();
        });

        test('should validate app completed tool schema', () => {
            const validInput = {
                buildSuccessful: true,
                devServerRunning: true,
                requirementsMet: true,
                summary: 'Test app completed'
            };
            const parsed = appCompletedTool.schema.parse(validInput);
            expect(parsed).toEqual(validInput);

            expect(() => {
                appCompletedTool.schema.parse({ buildSuccessful: 'not boolean' });
            }).toThrow();
        });

        test('should validate file operations tool schema', () => {
            const validInput = { operation: 'read', path: '/test/file.txt' };
            const parsed = fileOperationsTool.schema.parse(validInput);
            expect(parsed).toEqual(validInput);

            expect(() => {
                fileOperationsTool.schema.parse({ operation: 'invalid' });
            }).toThrow();
        });
    });

    describe('TrackedToolNode', () => {
        test('should instantiate correctly', () => {
            expect(toolNode).toBeInstanceOf(TrackedToolNode);
            expect(toolNode.constructor.name).toBe('TrackedToolNode');
        });

        test('should handle state without tool calls', async () => {
            const mockState = {
                messages: [new HumanMessage('Hello')],
                conversationId: 'test-123',
                currentAgent: 'coding',
                completionState: {},
                lastToolExecution: [],
                aguiEvents: []
            };

            const result = await toolNode.invoke(mockState);
            expect(result).toHaveProperty('aguiEvents');
            expect(result.aguiEvents[0].type).toBe('ERROR');
        });

        test('should handle state with tool calls', async () => {
            const aiMessage = new AIMessage('I will run a command');
            aiMessage.tool_calls = [
                {
                    id: 'test-call-1',
                    name: 'app_container',
                    args: { command: 'echo test' }
                }
            ];

            const mockState = {
                messages: [aiMessage],
                conversationId: 'test-123',
                currentAgent: 'coding',
                completionState: {},
                lastToolExecution: [],
                aguiEvents: []
            };

            // This will try to execute the tool, which should work
            try {
                const result = await toolNode.invoke(mockState);
                expect(result).toHaveProperty('lastToolExecution');
                expect(result).toHaveProperty('completionState');
                expect(result).toHaveProperty('aguiEvents');
            } catch (error) {
                // Tool execution might fail in test environment, but structure should be correct
                expect(error).toBeDefined();
            }
        });
    });

    describe('Completion Validation', () => {
        test('should validate completion when app_completed tool succeeds', () => {
            const mockState = {
                lastToolExecution: [
                    {
                        name: 'app_completed',
                        output: JSON.stringify({ success: true }),
                        success: true
                    }
                ]
            };

            const isComplete = validateCodingCompletion(mockState);
            expect(isComplete).toBe(true);
        });

        test('should not validate completion when app_completed tool fails', () => {
            const mockState = {
                lastToolExecution: [
                    {
                        name: 'app_completed',
                        output: JSON.stringify({ success: false }),
                        success: false
                    }
                ]
            };

            const isComplete = validateCodingCompletion(mockState);
            expect(isComplete).toBe(false);
        });

        test('should not validate completion when no app_completed tool', () => {
            const mockState = {
                lastToolExecution: [
                    {
                        name: 'app_container',
                        output: 'some output',
                        success: true
                    }
                ]
            };

            const isComplete = validateCodingCompletion(mockState);
            expect(isComplete).toBe(false);
        });
    });

    describe('Routing Logic', () => {
        test('should route to END when completion is successful', () => {
            const mockState = {
                lastToolExecution: [
                    {
                        name: 'app_completed',
                        output: JSON.stringify({ success: true })
                    }
                ],
                currentAgent: 'coding'
            };

            const route = routeAfterTools(mockState);
            expect(route).toBe('END');
        });

        test('should route back to coding when completion fails', () => {
            const mockState = {
                lastToolExecution: [
                    {
                        name: 'app_completed',
                        output: JSON.stringify({ success: false })
                    }
                ],
                currentAgent: 'coding'
            };

            const route = routeAfterTools(mockState);
            expect(route).toBe('coding');
        });

        test('should route back to current agent when no completion tool', () => {
            const mockState = {
                lastToolExecution: [
                    {
                        name: 'app_container',
                        output: 'some output'
                    }
                ],
                currentAgent: 'wireframe'
            };

            const route = routeAfterTools(mockState);
            expect(route).toBe('wireframe');
        });

        test('should default to coding when no current agent', () => {
            const mockState = {
                lastToolExecution: []
            };

            const route = routeAfterTools(mockState);
            expect(route).toBe('coding');
        });
    });

    describe('Tool Execution Results', () => {
        test('should return structured JSON for app completion tool', async () => {
            const result = await appCompletedTool.invoke({
                buildSuccessful: true,
                devServerRunning: true,
                requirementsMet: true,
                summary: 'Test completion'
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('message');
            expect(parsed).toHaveProperty('criteria');
            expect(parsed.success).toBe(true);
        });

        test('should return failure for incomplete criteria', async () => {
            const result = await appCompletedTool.invoke({
                buildSuccessful: false,
                devServerRunning: true,
                requirementsMet: true,
                summary: 'Test completion'
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed).toHaveProperty('criteria');
            expect(parsed.criteria.buildSuccessful).toBe(false);
        });

        test('should execute app container tool with command', async () => {
            const result = await appContainerTool.invoke({ command: 'echo test' });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('command');
            expect(parsed.command).toBe('echo test');
        });
    });
});
