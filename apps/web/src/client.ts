import type { IngestionEvent } from './types/contracts';
export const ownerSessionExpired = 'grasp-owner-session-expired';
export class ApiError extends Error {
    constructor(message: string, public status: number, public detail?: unknown) { super(message); }
}
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch('/api' + path, { ...options, credentials: 'same-origin' });
    if (!response.ok) {
        if (response.status === 401 && !path.startsWith('/owner-session'))
            window.dispatchEvent(new Event(ownerSessionExpired));
        const data = await response.json().catch(() => ({ detail: 'The server could not complete this request.' }));
        const detail: unknown = data.detail;
        const message = typeof detail === 'string' ? detail : 'Please check the submitted values.';
        throw new ApiError(message, response.status, detail);
    }
    return response;
}
export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    const options: RequestInit = body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    return (await apiFetch(path, options)).json() as Promise<T>;
}
export async function remove(path: string): Promise<{
    cleanupPending?: boolean;
}> { return (await apiFetch(path, { method: 'DELETE' })).json() as Promise<{
    cleanupPending?: boolean;
}>; }
export async function documentEvents(id: string, onEvent: (event: IngestionEvent) => void, signal: AbortSignal): Promise<void> {
    let cursor = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await apiFetch(`/documents/${id}/events`, { headers: { 'Last-Event-ID': String(cursor) }, signal });
            const reader = response.body?.getReader();
            if (!reader)
                throw new Error('Progress streaming is unavailable.');
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    buffer += decoder.decode(value, { stream: !done });
                    let boundary: number;
                    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
                        const block = buffer.slice(0, boundary);
                        buffer = buffer.slice(boundary + 2);
                        const data = block.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
                        if (!data)
                            continue;
                        const event = JSON.parse(data) as IngestionEvent;
                        cursor = event.id;
                        onEvent(event);
                        if (event.type === 'error')
                            throw new ApiError(event.message || 'Processing failed.', 422);
                        if (event.type === 'complete')
                            return;
                    }
                    if (done)
                        break;
                }
            }
            finally {
                await reader.cancel().catch(() => { });
            }
        }
        catch (error) {
            if (signal.aborted || error instanceof ApiError)
                throw error;
            if (attempt === 4)
                throw error;
        }
        if (signal.aborted)
            throw new Error('Progress stopped. Processing continues on the server.');
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    throw new Error('Connection interrupted. Reopen the workspace to reload stored results.');
}
