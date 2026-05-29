import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0f0a' }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0a0f0a" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0f0a' } }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
