import * as SecureStore from 'expo-secure-store';

const memory = new Map<string, string>();
const isWeb = process.env.EXPO_OS === 'web';
const CHUNK_SIZE = 1800;
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureKeyValue = {
  async getItem(key: string) {
    return isWeb ? memory.get(key) ?? null : SecureStore.getItemAsync(key, options);
  },
  async setItem(key: string, value: string) {
    if (isWeb) memory.set(key, value);
    else await SecureStore.setItemAsync(key, value, options);
  },
  async removeItem(key: string) {
    if (isWeb) memory.delete(key);
    else await SecureStore.deleteItemAsync(key, options);
  },
};

const chunkKey = (key: string, index: number) => `${key}:chunk:${index}`;

export async function setSecureJson<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  const previousMeta = await secureKeyValue.getItem(`${key}:meta`);
  const previousCount = previousMeta ? Number(previousMeta) || 0 : 0;
  const chunks = Array.from({ length: Math.ceil(raw.length / CHUNK_SIZE) }, (_, index) =>
    raw.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );
  await Promise.all(chunks.map((chunk, index) => secureKeyValue.setItem(chunkKey(key, index), chunk)));
  await secureKeyValue.setItem(`${key}:meta`, String(chunks.length));
  if (previousCount > chunks.length) {
    await Promise.all(
      Array.from({ length: previousCount - chunks.length }, (_, offset) =>
        secureKeyValue.removeItem(chunkKey(key, chunks.length + offset)),
      ),
    );
  }
}

export async function getSecureJson<T>(key: string): Promise<T | null> {
  const meta = await secureKeyValue.getItem(`${key}:meta`);
  const count = meta ? Number(meta) : 0;
  if (!Number.isInteger(count) || count <= 0 || count > 256) return null;
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) => secureKeyValue.getItem(chunkKey(key, index))),
  );
  if (chunks.some((chunk) => chunk === null)) return null;
  try {
    return JSON.parse(chunks.join('')) as T;
  } catch {
    await removeSecureJson(key);
    return null;
  }
}

export async function removeSecureJson(key: string) {
  const meta = await secureKeyValue.getItem(`${key}:meta`);
  const count = meta ? Number(meta) || 0 : 0;
  await Promise.all([
    secureKeyValue.removeItem(`${key}:meta`),
    ...Array.from({ length: count }, (_, index) => secureKeyValue.removeItem(chunkKey(key, index))),
  ]);
}
