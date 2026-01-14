import { Stack } from 'expo-router';
import { UserProvider } from '../context/UserContext';

// 20260114-FINAL-STABLE
export default function RootLayout() {
  return (
    <UserProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard/index" />
        <Stack.Screen name="projects/index" />
        <Stack.Screen name="logs/index" />
        <Stack.Screen name="personnel/index" />
        <Stack.Screen name="sop/index" />
        <Stack.Screen name="profile/index" />
      </Stack>
    </UserProvider>
  );
}