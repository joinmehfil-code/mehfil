/**
 * Authenticated tab navigator: Home, Discover, Communities, Events, Profile.
 * Uses Ionicons (bundled via @expo/vector-icons) with a custom frosted-glass
 * tab bar and a reanimated spring indicator over the active tab.
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { colors, gradients } from '@/theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  return function Icon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  };
}

/* --------------------------- Custom glass tab bar -------------------------- */

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const index = state.index;
  const progress = useSharedValue(index);
  const count = state.routes.length;

  // Keep the spring indicator in sync with the active route.
  useMemo(() => {
    progress.value = withSpring(index, { damping: 20, stiffness: 240 });
  }, [index, progress]);

  const indicator = useAnimatedStyle(() => ({
    width: `${100 / count}%`,
    transform: [{ translateX: progress.value * (100 * (count - 1)) }],
  }));

  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <BlurView
        intensity={40}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bar}>
        {/* Spring indicator */}
        <Animated.View style={[styles.indicator, indicator]} pointerEvents="none">
          <LinearGradient
            colors={[...gradients.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.indicatorGrad}
          />
        </Animated.View>

        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const focused = i === index;
          const Icon = options.tabBarIcon;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              <TabIcon index={i} activeIndex={index}>
                {Icon
                  ? Icon({ focused, color: focused ? colors.ink : colors.contentMuted, size: 22 })
                  : null}
              </TabIcon>
              <Text
                style={[styles.tabLabel, { color: focused ? colors.ink : colors.contentMuted }]}
                numberOfLines={1}
              >
                {label as string}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Icon wrapper that scales/bounces when its tab becomes active. */
function TabIcon({
  index,
  activeIndex,
  children,
}: {
  index: number;
  activeIndex: number;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(index === activeIndex ? 1.05 : 0.9);
  useMemo(() => {
    scale.value = withSpring(index === activeIndex ? 1.05 : 0.9, { damping: 14, stiffness: 260 });
  }, [activeIndex, index, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.tabIcon, animated]}>{children}</Animated.View>;
}

export default function TabsLayout() {
  const { t } = useI18n();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.content, fontWeight: '800' },
        headerTintColor: colors.content,
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.contentMuted,
        tabBarStyle: { backgroundColor: 'transparent', elevation: 0, borderTopWidth: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t.nav.home, tabBarIcon: tabIcon('home'), headerTitle: t.common.appName }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: t.nav.discover, tabBarIcon: tabIcon('search') }}
      />
      <Tabs.Screen
        name="communities"
        options={{ title: t.nav.communities, tabBarIcon: tabIcon('people') }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: t.nav.events, tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t.nav.profile, tabBarIcon: tabIcon('person') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  bar: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 6 },
  indicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
    borderRadius: 18,
    overflow: 'hidden',
  },
  indicatorGrad: { flex: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, zIndex: 1 },
  tabIcon: { alignItems: 'center', justifyContent: 'center', height: 24 },
  tabLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
});
