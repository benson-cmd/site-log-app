import { Stack, useRouter, useSegments } from 'expo-router';
import { UserProvider, useUser } from '../context/UserContext';
import { PersonnelProvider } from '../context/PersonnelContext';
import { ProjectProvider } from '../context/ProjectContext';
import { LogProvider } from '../context/LogContext';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
//import { Toaster } from 'sonner';

const AuthCheck = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)'; // If using (auth) group

    // Check if on login screen
    // root (index) is login.
    const isLoginScreen = (segments.length as number) === 0 || (segments.length === 1 && segments[0] === 'index');

    if (!user && !isLoginScreen) {
      // Redirect to login
      router.replace('/');
    } else if (user && isLoginScreen) {
      // Redirect to dashboard
      router.replace('/dashboard');
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
};

// 20260114-FINAL-STABLE
export default function RootLayout() {
  return (
    <UserProvider>

      <PersonnelProvider>
        <ProjectProvider>
          <LogProvider>
            <AuthCheck>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="dashboard/index" />
                <Stack.Screen name="projects/index" />
                <Stack.Screen name="logs/index" />
                <Stack.Screen name="personnel/index" />
                <Stack.Screen name="sop/index" />
                <Stack.Screen name="profile/index" />
              </Stack>
            </AuthCheck>
          </LogProvider>
        </ProjectProvider>
      </PersonnelProvider>
    </UserProvider>
  );
}