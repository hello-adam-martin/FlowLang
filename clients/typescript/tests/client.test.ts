/**
 * FlowLang TypeScript Client - Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowLangClient } from '../src/client';
import {
  FlowLangError,
  FlowExecutionError,
  FlowNotReadyError,
  FlowNotFoundError,
} from '../src/errors';

// Mock fetch globally
global.fetch = vi.fn();

describe('FlowLangClient', () => {
  let client: FlowLangClient;

  beforeEach(() => {
    client = new FlowLangClient({
      baseUrl: 'http://test.example.com',
      retryAttempts: 3,
      retryDelay: 100,
      retryBackoff: 2,
    });
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with default config', () => {
      const defaultClient = new FlowLangClient({
        baseUrl: 'http://localhost:8000',
      });
      expect(defaultClient).toBeInstanceOf(FlowLangClient);
    });

    it('should remove trailing slash from base URL', () => {
      const client = new FlowLangClient({
        baseUrl: 'http://localhost:8000/',
      });
      expect(client['baseUrl']).toBe('http://localhost:8000');
    });

    it('should accept custom configuration', () => {
      const client = new FlowLangClient({
        baseUrl: 'http://custom:9000',
        timeout: 60000,
        retryAttempts: 5,
        retryDelay: 2000,
        retryBackoff: 3.0,
        headers: { 'X-Custom': 'value' },
      });

      expect(client['baseUrl']).toBe('http://custom:9000');
      expect(client['timeout']).toBe(60000);
      expect(client['retryAttempts']).toBe(5);
      expect(client['retryDelay']).toBe(2000);
      expect(client['retryBackoff']).toBe(3.0);
      expect(client['headers']['X-Custom']).toBe('value');
    });
  });

  describe('executeFlow', () => {
    it('should execute flow successfully', async () => {
      const mockResponse = {
        success: true,
        outputs: { message: 'Hello, World!' },
        execution_time_ms: 123.45,
        flow: 'TestFlow',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.executeFlow('TestFlow', { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.outputs).toEqual({ message: 'Hello, World!' });
      expect(result.executionTimeMs).toBe(123.45);
      expect(result.flow).toBe('TestFlow');
    });

    it('should throw FlowNotFoundError for 404', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Flow not found' }),
      });

      await expect(
        client.executeFlow('NonExistent', {})
      ).rejects.toThrow(FlowNotFoundError);
    });

    it('should throw FlowNotReadyError for 503', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Flow not ready',
          pending_tasks: ['Task1', 'Task2'],
          implementation_progress: '3/5 (60%)',
        }),
      });

      try {
        await client.executeFlow('TestFlow', {});
      } catch (error) {
        expect(error).toBeInstanceOf(FlowNotReadyError);
        if (error instanceof FlowNotReadyError) {
          expect(error.pendingTasks).toEqual(['Task1', 'Task2']);
          expect(error.progress).toBe('3/5 (60%)');
        }
      }
    });

    it('should throw FlowExecutionError on failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          error: 'Execution failed',
          error_details: 'Task xyz failed',
          flow: 'TestFlow',
        }),
      });

      await expect(
        client.executeFlow('TestFlow', {})
      ).rejects.toThrow(FlowExecutionError);
    });

    it('should handle empty inputs', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          outputs: {},
          flow: 'TestFlow',
        }),
      });

      const result = await client.executeFlow('TestFlow');
      expect(result.success).toBe(true);
    });

    it('should handle terminated flows', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          terminated: true,
          termination_reason: 'Early exit',
          outputs: { status: 'terminated' },
          flow: 'TestFlow',
        }),
      });

      const result = await client.executeFlow('TestFlow');
      expect(result.success).toBe(true);
      expect(result.terminated).toBe(true);
      expect(result.terminationReason).toBe('Early exit');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 500 error', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            outputs: {},
            flow: 'TestFlow',
          }),
        });

      const result = await client.executeFlow('TestFlow');
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 rate limit', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            outputs: {},
            flow: 'TestFlow',
          }),
        });

      const result = await client.executeFlow('TestFlow');
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 client error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(
        client.executeFlow('TestFlow')
      ).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('listFlows', () => {
    it('should list all flows', async () => {
      const mockFlows = [
        {
          name: 'Flow1',
          description: 'First flow',
          inputs: [],
          outputs: [],
        },
        {
          name: 'Flow2',
          description: 'Second flow',
          inputs: [],
          outputs: [],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFlows,
      });

      const flows = await client.listFlows();
      expect(flows).toHaveLength(2);
      expect(flows[0].name).toBe('Flow1');
      expect(flows[1].name).toBe('Flow2');
    });
  });

  describe('getFlowInfo', () => {
    it('should get flow information', async () => {
      const mockFlow = {
        name: 'TestFlow',
        description: 'Test flow',
        inputs: [{ name: 'input1', type: 'string' }],
        outputs: [{ name: 'output1' }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFlow,
      });

      const flow = await client.getFlowInfo('TestFlow');
      expect(flow.name).toBe('TestFlow');
      expect(flow.description).toBe('Test flow');
      expect(flow.inputs).toHaveLength(1);
    });

    it('should throw FlowNotFoundError for non-existent flow', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Flow not found' }),
      });

      await expect(
        client.getFlowInfo('NonExistent')
      ).rejects.toThrow(FlowNotFoundError);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockHealth = {
        status: 'healthy',
        ready: true,
        tasks_implemented: 10,
        tasks_total: 10,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      });

      const health = await client.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.ready).toBe(true);
    });

    it('should handle not ready status', async () => {
      const mockHealth = {
        status: 'healthy',
        ready: false,
        tasks_implemented: 5,
        tasks_total: 10,
        tasks_pending: 5,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      });

      const health = await client.healthCheck();
      expect(health.ready).toBe(false);
      expect(health.tasksPending).toBe(5);
    });
  });
});

describe('Error Classes', () => {
  it('should create FlowLangError', () => {
    const error = new FlowLangError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('FlowLangError');
    expect(error.message).toBe('Test error');
  });

  it('should create FlowExecutionError with details', () => {
    const error = new FlowExecutionError(
      'Execution failed',
      'Detailed error',
      'TestFlow'
    );
    expect(error).toBeInstanceOf(FlowLangError);
    expect(error.name).toBe('FlowExecutionError');
    expect(error.errorDetails).toBe('Detailed error');
    expect(error.flow).toBe('TestFlow');
  });

  it('should create FlowNotReadyError with tasks', () => {
    const error = new FlowNotReadyError(
      'Not ready',
      ['Task1', 'Task2'],
      '3/5 (60%)'
    );
    expect(error).toBeInstanceOf(FlowLangError);
    expect(error.name).toBe('FlowNotReadyError');
    expect(error.pendingTasks).toEqual(['Task1', 'Task2']);
    expect(error.progress).toBe('3/5 (60%)');
  });

  it('should create FlowNotFoundError', () => {
    const error = new FlowNotFoundError('TestFlow');
    expect(error).toBeInstanceOf(FlowLangError);
    expect(error.name).toBe('FlowNotFoundError');
    expect(error.flowName).toBe('TestFlow');
    expect(error.message).toContain('TestFlow');
  });
});
