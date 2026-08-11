import { router, Tabs, usePathname, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import { Brand } from '@/constants/theme';
import { confirmResetIfNeeded } from '@/utils/pindrawSession';

const TabTheme = {
  background: '#ffffff',
  border: '#e8e4dd',
  active: Brand.green,
  inactive: Brand.muted,
};

/**
 * 초기화 확인창
 */
function guardLeavePindraw(isOnPindraw: boolean, proceed: () => void) {
  return {
    tabPress: (e: { preventDefault: () => void }) => {
      if (!isOnPindraw) return;

      e.preventDefault();
      confirmResetIfNeeded(proceed);
    },
  };
}

function goToPindrawIndex() {
  router.dismissTo('/pindraw');
}

function goToTab(path: Href) {
  return () => router.navigate(path);
}

export default function TabLayout() {
  const pathname = usePathname();
  const isOnPindraw = pathname.startsWith('/pindraw');

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TabTheme.active,
        tabBarInactiveTintColor: TabTheme.inactive,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 76,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          backgroundColor: TabTheme.background,
          borderTopWidth: 1,
          borderTopColor: TabTheme.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
        listeners={() => guardLeavePindraw(isOnPindraw, goToTab('/home'))}
      />

      <Tabs.Screen
        name="pindraw"
        options={{
          title: '쉼표뽑기',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'sparkles' : 'sparkles-outline'}
              size={size}
              color={color}
            />
          ),
        }}
        listeners={() => guardLeavePindraw(isOnPindraw, goToPindrawIndex)}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: '지도',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={size}
              color={color}
            />
          ),
        }}
        listeners={() => guardLeavePindraw(isOnPindraw, goToTab('/map'))}
      />

      <Tabs.Screen
        name="diary"
        options={{
          title: '다이어리',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={size}
              color={color}
            />
          ),
        }}
        listeners={() => guardLeavePindraw(isOnPindraw, goToTab('/diary'))}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}