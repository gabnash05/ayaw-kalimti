import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  protectedStorageRuntime,
  type ProtectedStorageRuntime,
} from './runtime.js';

interface ProtectedStorageGateProps {
  children: ReactNode;
  runtime?: ProtectedStorageRuntime;
}

type StoragePhase = 'initializing' | 'ready' | 'unavailable';

export function ProtectedStorageGate({
  children,
  runtime = protectedStorageRuntime,
}: ProtectedStorageGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<StoragePhase>('initializing');

  useEffect(() => {
    let active = true;
    setPhase('initializing');
    runtime.initialize().then(
      () => {
        if (active) setPhase('ready');
      },
      () => {
        if (active) setPhase('unavailable');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, runtime]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  if (phase === 'ready') return children;
  if (phase === 'initializing') return null;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="alert" style={styles.message}>
        Protected storage is unavailable.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#1f2937',
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
