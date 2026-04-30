export interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
}

export function parseSSEBlock(block: string): StreamEvent | null {
  if (!block.trim() || block.startsWith(':')) {
    return null;
  }
  const eventMatch = block.match(/^event:\s*(.+)$/m);
  const dataMatch = block.match(/^data:\s*(.+)$/m);
  if (!eventMatch || !dataMatch) {
    return null;
  }
  try {
    return {
      type: eventMatch[1].trim(),
      data: JSON.parse(dataMatch[1].trim()),
    };
  } catch {
    return null;
  }
}

export interface SSELineState {
  eventType: string;
}

export function parseSSELine(line: string, state: SSELineState): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return null;
  }
  if (trimmed.startsWith('event:')) {
    state.eventType = trimmed.slice(6).trim();
    return null;
  }
  if (trimmed.startsWith('data:')) {
    const raw = trimmed.slice(5).trim();
    try {
      return {
        type: state.eventType || 'message',
        data: JSON.parse(raw),
      };
    } catch {
      return null;
    }
  }
  return null;
}
