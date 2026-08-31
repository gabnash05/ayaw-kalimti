import { Stack } from 'expo-router';

import { ProtectedStorageGate } from '../src/database/storage-gate.js';

export default function RootLayout() {
  return (
    <ProtectedStorageGate>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedStorageGate>
  );
}
