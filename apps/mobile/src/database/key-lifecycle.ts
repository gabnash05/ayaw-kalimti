import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export const DATABASE_KEY_STORAGE_KEY = 'ayaw-kalimti.database-key.v1';
const DATABASE_KEY_BYTES = 32;
const HEX_KEY = /^[a-f0-9]{64}$/;

export interface KeyStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: { requireAuthentication?: boolean },
  ): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface RandomBytes {
  getRandomBytesAsync(length: number): Promise<Uint8Array>;
}

export class InvalidStoredDatabaseKeyError extends Error {
  public constructor() {
    super('The protected local database key is invalid.');
  }
}

export class InvalidGeneratedDatabaseKeyError extends Error {
  public constructor() {
    super('The generated protected database key is invalid.');
  }
}

export function encodeKey(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function getOrCreateDatabaseKey(
  keyStore: KeyStore = SecureStore,
  randomBytes: RandomBytes = Crypto,
): Promise<string> {
  const storedKey = await keyStore.getItemAsync(DATABASE_KEY_STORAGE_KEY);
  if (storedKey !== null) {
    if (!HEX_KEY.test(storedKey)) {
      throw new InvalidStoredDatabaseKeyError();
    }
    return storedKey;
  }

  const bytes = await randomBytes.getRandomBytesAsync(DATABASE_KEY_BYTES);
  if (bytes.length !== DATABASE_KEY_BYTES) {
    throw new InvalidGeneratedDatabaseKeyError();
  }
  const key = encodeKey(bytes);
  await keyStore.setItemAsync(DATABASE_KEY_STORAGE_KEY, key, {
    requireAuthentication: false,
  });
  return key;
}

export function clearDatabaseKey(
  keyStore: KeyStore = SecureStore,
): Promise<void> {
  return keyStore.deleteItemAsync(DATABASE_KEY_STORAGE_KEY);
}
