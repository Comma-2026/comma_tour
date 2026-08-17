import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { diaryPhotoSource, fetchDiaryByPin } from '@/api/diary';
import { Brand, Fonts } from '@/constants/theme';
import type { Diary } from '@/types/diary';
import { getToken } from '@/utils/authStorage';

const ScreenTheme = {
  background: '#f9f8f2',
  card: '#ffffff',
  text: '#1A1A1A',
  greenDeep: '#1a3a2a',
  muted: '#9AA0A6',
};

/**
 * 작성된 일기 읽기 전용 상세 화면.
 * 일반 탭에서는 이 화면(수정 불가)으로 열리고, 상단 '수정' 버튼을 눌러야만 작성 화면으로 넘어간다.
 * 핀 정보를 파라미터로 받고, 일기 본문은 pin_id로 서버에서 불러온다(수정 후 돌아오면 갱신).
 */
export default function DiaryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pinId: string;
    contentId?: string;
    placeName: string;
    region?: string;
  }>();

  const { pinId, contentId, placeName, region } = params;

  const [diary, setDiary] = useState<Diary | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 화면에 들어올 때마다(수정 후 돌아올 때 포함) 최신 일기 + 토큰을 다시 불러온다.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([fetchDiaryByPin(pinId), getToken()]).then(([result, savedToken]) => {
        if (!active) return;
        setDiary(result);
        setToken(savedToken);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [pinId]),
  );

  const goEdit = () => {
    router.push({
      pathname: '/diary-write',
      params: { pinId, contentId: contentId ?? '', placeName, region: region ?? '' },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>일기</Text>
        {/* 상단 '수정' 버튼 — 이걸 눌러야만 수정 화면으로 넘어간다. */}
        <TouchableOpacity onPress={goEdit} disabled={loading || !diary}>
          <Text style={[styles.editButton, (loading || !diary) && styles.editButtonDisabled]}>수정</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.green} />
        </View>
      ) : !diary ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>일기를 불러오지 못했어요.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.placeCard}>
            <Text style={styles.placeLabel}>📍 이 핀에 남긴 일기</Text>
            <Text style={styles.placeName}>{placeName}</Text>
            {!!region && <Text style={styles.placeRegion}>{region}</Text>}
            {/* 방문일은 사용자가 일기에 직접 적은 값만 보여준다(핀 생성일 자동 표시 아님). */}
            {!!diary.visited_at && (
              <Text style={styles.placeDate}>방문일 · {diary.visited_at}</Text>
            )}
          </View>

          {diary.has_photo && (
            <Image
              source={diaryPhotoSource(pinId, token)}
              style={styles.photo}
              contentFit="cover"
              transition={150}
            />
          )}

          {!!diary.title && <Text style={styles.title}>{diary.title}</Text>}
          <Text style={styles.body}>{diary.content}</Text>

          <Text style={styles.metaDate}>작성 · {(diary.created_at ?? '').slice(0, 10)}</Text>
          {/* 수정 이력이 있을 때(작성 시각 ≠ 수정 시각)만 마지막 수정일을 따로 표시한다. */}
          {diary.updated_at !== diary.created_at && (
            <Text style={styles.metaDateSub}>
              마지막 수정 · {(diary.updated_at ?? '').slice(0, 10)}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ScreenTheme.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 40,
    fontSize: 24,
    fontWeight: '600',
    color: ScreenTheme.text,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '800',
    color: ScreenTheme.text,
  },
  editButton: {
    width: 40,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700',
    color: Brand.green,
  },
  editButtonDisabled: {
    color: ScreenTheme.muted,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: ScreenTheme.muted,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  placeCard: {
    borderRadius: 16,
    backgroundColor: '#eef5ee',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  placeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ScreenTheme.greenDeep,
  },
  placeName: {
    marginTop: 6,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '800',
    color: ScreenTheme.text,
  },
  placeRegion: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: ScreenTheme.muted,
  },
  placeDate: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: ScreenTheme.muted,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 18,
    backgroundColor: '#eceae3',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: ScreenTheme.text,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: ScreenTheme.text,
  },
  metaDate: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: '600',
    color: ScreenTheme.muted,
  },
  metaDateSub: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    color: ScreenTheme.muted,
  },
});
