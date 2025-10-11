/**
 * FlowLang TypeScript Client
 *
 * Type-safe client for calling FlowLang flows via REST API.
 *
 * @example
 * ```typescript
 * import { FlowLangClient } from '@flowlang/client';
 *
 * const client = new FlowLangClient({ baseUrl: 'http://localhost:8000' });
 *
 * // Execute a flow
 * const result = await client.executeFlow('HelloWorld', { user_name: 'Alice' });
 * console.log(result.outputs.message);
 *
 * // Stream execution events
 * await client.executeFlowStream('MyFlow', { input: 'value' }, {
 *   onEvent: (eventType, data) => console.log(`${eventType}:`, data)
 * });
 * ```
 *
 * @packageDocumentation
 */

export { FlowLangClient } from './client';
export * from './types';
export * from './errors';
export { processSSEStream, SSEParser } from './sse-parser';
