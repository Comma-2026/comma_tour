import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeActionCards } from '@/components/home/HomeActionCards';
import { HomeHeader } from '@/components/home/HomeHeader';
import { RecentPinSection } from '@/components/home/RecentPinSection';

const HomeTheme = {
  background: '#f9f8f2',
};

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />
        <HomeActionCards />
        <RecentPinSection />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: HomeTheme.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: HomeTheme.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 96,
  },
});