import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from './src/context/AppContext';
import BootScreen    from './src/screens/BootScreen';
import TriageScreen  from './src/screens/TriageScreen';
import ActionScreen  from './src/screens/ActionScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0E0F' }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" backgroundColor="#0A0E0F" />
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Boot"
              screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#0A0E0F' },
              }}
            >
              {/* Flow: Boot (mode select) → Triage (1-screen intake) → Action (step-by-step) */}
              <Stack.Screen name="Boot"    component={BootScreen}   />
              <Stack.Screen name="Triage"  component={TriageScreen} />
              <Stack.Screen name="Action"  component={ActionScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
