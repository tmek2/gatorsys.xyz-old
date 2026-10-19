/** Preview state belongs to one visitor. Never connect to an operator's Redis. */
export async function getCached<T>(_key: string): Promise<T | null> { return null; }
export async function setCached(_key: string, _data: unknown, _expirationSeconds = 3600) {}
export async function deleteCached(..._keys: string[]) {}
export async function readGeneration(_key: string): Promise<number> { return 0; }
export async function bumpGeneration(_key: string, _expirationSeconds = 86_400) {}
