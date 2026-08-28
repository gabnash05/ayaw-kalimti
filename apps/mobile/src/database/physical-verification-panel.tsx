import { AppState, Button, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { physicalStorageVerificationProbe } from './physical-verification.js';

type ProbeStatus =
  | 'ready'
  | 'working'
  | 'journal-held'
  | 'locked-armed'
  | 'locked-passed'
  | 'complete'
  | 'failed';

export function PhysicalStorageVerificationPanel() {
  if (!__DEV__) return null;
  return <DevelopmentPhysicalStorageVerificationPanel />;
}

function DevelopmentPhysicalStorageVerificationPanel() {
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      void physicalStorageVerificationProbe
        .handleAppStateChange(appState)
        .then((result) => {
          if (result === 'passed') setStatus('locked-passed');
          if (result === 'failed') setStatus('failed');
        });
    });
    return () => subscription.remove();
  }, []);

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
        title="Arm locked-background access"
        onPress={() => {
          void run(
            () => physicalStorageVerificationProbe.armLockedBackgroundAccess(),
            'locked-armed',
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
