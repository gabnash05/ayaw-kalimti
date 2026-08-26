import { Button, StyleSheet, Text, View } from 'react-native';
import { useCallback, useState } from 'react';

import { physicalStorageVerificationProbe } from './physical-verification.js';

type ProbeStatus = 'ready' | 'working' | 'journal-held' | 'complete' | 'failed';

export function PhysicalStorageVerificationPanel() {
  const [status, setStatus] = useState<ProbeStatus>('ready');

  const run = useCallback(
    async (operation: () => Promise<void>, success: ProbeStatus) => {
      setStatus('working');
      try {
        await operation();
        setStatus(success);
      } catch {
        setStatus('failed');
      }
    },
    [],
  );

  if (!__DEV__) return null;
  const working = status === 'working';

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Protected storage verification</Text>
      <Text testID="storage-verification-status">Status: {status}</Text>
      <Button
        disabled={working}
        title="Hold journal transaction"
        onPress={() => {
          void run(
            () => physicalStorageVerificationProbe.holdJournalTransaction(),
            'journal-held',
          );
        }}
      />
      <Button
        disabled={working}
        title="Rollback journal transaction"
        onPress={() => {
          void run(
            () => physicalStorageVerificationProbe.rollbackJournalTransaction(),
            'complete',
          );
        }}
      />
      <Button
        disabled={working}
        title="Invalidate database key"
        onPress={() => {
          void run(
            () => physicalStorageVerificationProbe.invalidateKey(),
            'complete',
          );
        }}
      />
      <Button
        disabled={working}
        title="Clear protected storage"
        onPress={() => {
          void run(
            () => physicalStorageVerificationProbe.clearProtectedStorage(),
            'complete',
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
  },
});
