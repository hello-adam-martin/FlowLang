/**
 * FlowLang TypeScript Client - Server-Sent Events Parser
 */

import type { FlowEventType, EventCallback } from './types';

/**
 * Parse Server-Sent Events (SSE) stream
 *
 * SSE format:
 * event: event_type
 * data: {"key": "value"}
 *
 * (blank line separates events)
 */
export class SSEParser {
  private eventType: string | null = null;
  private dataBuffer: string = '';

  /**
   * Parse a line from the SSE stream
   *
   * @param line - Line from the stream
   * @param callback - Callback to invoke when a complete event is parsed
   */
  parseLine(line: string, callback: EventCallback): void {
    const trimmed = line.trim();

    // Empty line = event complete
    if (!trimmed) {
      if (this.eventType && this.dataBuffer) {
        this.emitEvent(callback);
      }
      return;
    }

    // Parse event type
    if (trimmed.startsWith('event:')) {
      this.eventType = trimmed.substring(6).trim();
      return;
    }

    // Parse data
    if (trimmed.startsWith('data:')) {
      this.dataBuffer = trimmed.substring(5).trim();
      return;
    }
  }

  /**
   * Emit a complete event
   */
  private emitEvent(callback: EventCallback): void {
    if (!this.eventType) {
      return;
    }

    try {
      const data = JSON.parse(this.dataBuffer);
      callback(this.eventType as FlowEventType, data);
    } catch (error) {
      console.error('Failed to parse SSE data:', error);
    } finally {
      // Reset for next event
      this.eventType = null;
      this.dataBuffer = '';
    }
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.eventType = null;
    this.dataBuffer = '';
  }
}

/**
 * Process a ReadableStream of Server-Sent Events
 *
 * @param stream - ReadableStream from fetch response
 * @param callback - Callback to invoke for each event
 */
export async function processSSEStream(
  stream: ReadableStream<Uint8Array>,
  callback: EventCallback
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEParser();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      // Parse each complete line
      for (const line of lines) {
        parser.parseLine(line, callback);
      }
    }

    // Process any remaining data
    if (buffer.trim()) {
      parser.parseLine(buffer, callback);
      parser.parseLine('', callback); // Emit final event
    }
  } finally {
    reader.releaseLock();
  }
}
