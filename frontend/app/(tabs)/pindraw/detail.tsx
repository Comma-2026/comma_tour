import { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchDriveDistance, fetchSpotDetail, type SpotDetail } from '@/api/spots';
import { Brand, Fonts } from '@/constants/theme';
import type { CurrentLocation } from '@/types/location';
import type { Pin } from '@/types/pin';
import { estimateDrivingLabel } from '@/utils/distance';
import { getCurrentLocation } from '@/utils/location';
import { savePin } from '@/utils/pinStorage';

const ScreenTheme = {
  background: '#f9f8f2',
  text: '#1A1A1A',
  greenDeep: '#1a3a2a',
  muted: '#9AA0A6',
};

export default function SpotDetailScreen() {
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const isFromRecords = from === 'records';
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState(false);
  // 거리 표시용 — 실패해도(권한 거부 등) 조용히 무시하고 서버가 준 대구 기준 거리로 폴백한다.
  const [userLocation, setUserLocation] = useState<CurrentLocation | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchSpotDetail(id).then((result) => {
      setSpot(result);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    getCurrentLocation()
      .then(setUserLocation)
      .catch(() => setUserLocation(null));
  }, []);

  // 즉시 뜨는 직선거리 근사치 → 카카오모빌리티 실제 도로 거리가 도착하면 조용히 교체.
  const [driveLabel, setDriveLabel] = useState<string | null>(null);
  useEffect(() => {
    setDriveLabel(null);
    if (!spot || !userLocation) return;
    let cancelled = false;
    fetchDriveDistance(userLocation, spot.lat, spot.lng).then((result) => {
      if (!cancelled && result) setDriveLabel(result.label);
    });
    return () => {
      cancelled = true;
    };
  }, [spot?.id, userLocation]);

  const distanceLabel =
    driveLabel ??
    (spot && userLocation
      ? estimateDrivingLabel(userLocation, { lat: spot.lat, lng: spot.lng }).label
      : spot?.distanceFromDaegu);

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
    if (!spot) return;

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
    await savePin(pin);

    Alert.alert('핀 완료', '이 여행지가 지도에 핀으로 저장됐어요.', [
      {
        text: '확인',
        onPress: () =>
          router.replace({
            pathname: '/pindraw',
            params: { justPinned: Date.now().toString() },
          }),
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
            <InfoRow label="거리" value={distanceLabel ?? spot.distanceFromDaegu} last />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={
                isFromRecords ? styles.primaryButton : styles.secondaryButton
              }
              activeOpacity={0.85}
              onPress={handleDirections}
              disabled={routing}
            >
              {routing ? (
                <ActivityIndicator
                  size="small"
                  color={isFromRecords ? '#ffffff' : ScreenTheme.greenDeep}
                />
              ) : (
                <Text
                  style={
                    isFromRecords
                      ? styles.primaryButtonText
                      : styles.secondaryButtonText
                  }
                >
                  길찾기
                </Text>
              )}
            </TouchableOpacity>
            {!isFromRecords && (
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={handleSelect}
              >
                <Text style={styles.primaryButtonText}>이 여행지로 정하기</Text>
              </TouchableOpacity>
            )}
          </View>
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
