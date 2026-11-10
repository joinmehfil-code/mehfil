/**
 * Root layout: installs global providers (safe area, gestures, i18n, auth) and
 * an auth-gated navigation stack. Unauthenticated users only see the (auth)
 * group; authenticated users get the (tabs) app plus detail routes.
 */
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth';
import { I18nProvider } from '@/i18n';
import { colors } from '@/theme/colors';

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
      <ActivityIndicator size="large" color={colors.brand[500]} />
    </View>
  );
}

function RootNav() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.content,
        headerTitleStyle: { color: colors.content, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="community/[slug]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="event/[slug]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="post/[id]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="profile/[username]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
          />
          <Stack.Screen name="messages/index" options={{ headerShown: true, title: 'Messages' }} />
          <Stack.Screen name="messages/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
          <Stack.Screen name="tickets" options={{ headerShown: true, title: 'My tickets' }} />
          <Stack.Screen name="scan" options={{ headerShown: true, title: 'Scan ticket' }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        </>
      )}
      <StatusBar style="light" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Ensure any stale splash is hidden once RN mounts.
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <RootNav />
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
