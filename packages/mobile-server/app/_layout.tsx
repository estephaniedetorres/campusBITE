import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '900' },
          headerTitle: 'CampusBITE',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'CampusBITE — Phone Server' }} />
      </Stack>
    </>
  );
}
