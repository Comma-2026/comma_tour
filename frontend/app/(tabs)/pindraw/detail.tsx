import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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

import { fetchSpotDetail, type SpotDetail } from '@/api/spots';
import { Brand, Fonts } from '@/constants/theme';
import { useSpotDistance } from '@/hooks/use-spot-distance';
import type { Pin } from '@/types/pin';
import { getCurrentLocation } from '@/utils/location';
import { resetPindrawSession } from '@/utils/pindrawSession';
import { getPins, savePin } from '@/utils/pinStorage';

const ScreenTheme = {
  background: '#f9f8f2',
  text: '#1A1A1A',
  greenDeep: '#1a3a2a',
  muted: '#9AA0A6',
};

export default function SpotDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinStatusLoading, setPinStatusLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchSpotDetail(id).then((result) => {
      setSpot(result);
      setLoading(false);
    });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPinStatusLoading(true);

      getPins()
        .then((pins) => {
          if (active) {
            setIsPinned(pins.some((pin) => pin.contentId === id));
          }
        })
        .finally(() => {
          if (active) setPinStatusLoading(false);
        });

      return () => {
        active = false;
      };
    }, [id]),
  );

  // 내 위치 기준 거리 라벨(위치 확인 중/권한 없음 상태도 문구로 표시).
  const distanceLabel = useSpotDistance(spot);

  /**
   * 카카오맵 길찾기. expo-location으로 현재 위치를 받아 출발지로,
   * 이 관광지 좌표를 도착지로 자동 지정해서 연다.
   * 위치를 못 얻으면(권한 거부 등) 도착지만 지정된 링크로 폴백한다.
   */
  const handleDirections = async () => {
    if (!spot || routing) return;

    const to = `${encodeURIComponent(spot.name)},${spot.lat},${spot.lng}`;

    setRouting(true);
    try {
      const here = await getCurrentLocation();
      Linking.openURL(
        `https://map.kakao.com/link/from/${encodeURIComponent('내 위치')},${here.latitude},${here.longitude}/to/${to}`,
      );
    } catch (err) {
      // 위치 서비스 꺼짐/권한 거부 → 이유를 알려주고, 도착지만 지정해서 연다.
      const message =
        err instanceof Error ? err.message : '현재 위치를 가져오지 못했습니다.';
      Alert.alert('내 위치를 출발지로 넣지 못했어요', message, [
        {
          text: '길찾기 계속',
          onPress: () => Linking.openURL(`https://map.kakao.com/link/to/${to}`),
        },
      ]);
    } finally {
      setRouting(false);
    }
  };

  const handleSelect = async () => {
    if (!spot || saving || isPinned) return;

    const pin: Pin = {
      id: Date.now().toString(),
      contentId: spot.id,
      place_name: spot.name,
      region: spot.region,
      category: spot.category,
      latitude: spot.lat,
      longitude: spot.lng,
      visited_at: new Date().toISOString().slice(0, 10),
      memo: null,
      photo_url: null,
      phrase: null,
    };
    setSaving(true);
    try {
      await savePin(pin);
      setIsPinned(true);
    } finally {
      setSaving(false);
    }

    Alert.alert('핀 완료', '이 여행지가 지도에 핀으로 저장됐어요.', [
      {
        text: '확인',
        onPress: () => {
          // 뽑기는 핀으로 마무리됐으니 세션을 초기화하고, 새 핀이 바로 보이는 지도 탭으로 이동한다.
          resetPindrawSession();
          router.replace('/(tabs)/map');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Text style={styles.backText}>‹ 목록으로</Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.green} />
        </View>
      )}

      {!loading && !spot && (
        <View style={styles.centerBox}>
          <Text style={styles.desc}>관광지 정보를 불러오지 못했어요.</Text>
        </View>
      )}

      {!loading && spot && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>📍 {spot.name}</Text>

          <View style={styles.banner}>
            {spot.imageUrl ? (
              <Image
                source={{ uri: spot.imageUrl }}
                style={styles.bannerImage}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <Text style={styles.bannerIcon}>{spot.icon}</Text>
            )}

            {spot.imageUrl && <View style={styles.bannerScrim} />}
            <Text style={styles.bannerTagLeft}>{spot.tags[0]}</Text>
            <Text style={styles.bannerTagRight}>● {spot.congestion}</Text>
          </View>

          <Text style={styles.fullDesc}>{spot.shortDesc}</Text>

          <View style={styles.infoCard}>
            <InfoRow label="지역" value={spot.region} />
            <InfoRow label="교통" value={spot.transportInfo} />
            <InfoRow label="주차" value={spot.hasParking ? 'O' : 'X'} />
            <InfoRow label="이용권" value={spot.admissionFee} />
            <InfoRow label="영업시간" value={spot.businessHours} />
            <InfoRow label="거리" value={distanceLabel} last />
          </View>

          {!pinStatusLoading && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={isPinned ? styles.primaryButton : styles.secondaryButton}
                activeOpacity={0.85}
                onPress={handleDirections}
                disabled={routing}
              >
                {routing ? (
                  <ActivityIndicator
                    size="small"
                    color={isPinned ? '#ffffff' : ScreenTheme.greenDeep}
                  />
                ) : (
                  <Text
                    style={
                      isPinned
                        ? styles.primaryButtonText
                        : styles.secondaryButtonText
                    }
                  >
                    길찾기
                  </Text>
                )}
              </TouchableOpacity>
              {!isPinned && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.85}
                  onPress={handleSelect}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      이 여행지로 정하기
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const normalizedValue = value.replace(/<br\s*\/?>/gi, '\n').trim();

  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{normalizedValue}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ScreenTheme.background,
  },
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: ScreenTheme.muted,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  desc: {
    fontSize: 14,
    lineHeight: 22,
    color: ScreenTheme.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '800',
    color: ScreenTheme.text,
  },
  banner: {
    marginTop: 14,
    height: 170,
    borderRadius: 20,
    backgroundColor: ScreenTheme.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerIcon: {
    fontSize: 64,
    color: '#ffffff',
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  bannerTagLeft: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  bannerTagRight: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  fullDesc: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    color: '#4a4a45',
  },
  infoCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  infoRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ede4',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    width: 72,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '700',
    color: ScreenTheme.muted,
  },
  infoValue: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: ScreenTheme.text,
    textAlign: 'right',
  },
  actionRow: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#eef5ee',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: ScreenTheme.greenDeep,
  },
  primaryButton: {
    flex: 1.4,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Brand.green,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
