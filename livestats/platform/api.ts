export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, token?: string, body?: unknown, method?: string): Promise<T> {
  if (!API_URL) throw new Error('Cloud backup is not configured in this build.');
  if (!API_URL.startsWith('https://')) throw new Error('Cloud backup requires a secure HTTPS server.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(typeof data?.error === 'string' ? data.error : 'The server could not complete this request.', response.status);
    if (!data) throw new Error('The server returned an empty response.');
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Connection timed out. Your data is still on this device.');
    if (error instanceof TypeError) throw new Error('Could not connect. Your data is still on this device. Try again when online.');
    throw error;
  } finally { clearTimeout(timeout); }
}
