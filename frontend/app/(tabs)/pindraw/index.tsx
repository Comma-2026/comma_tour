import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEBUG_SOURCE_TYPES,
  FEEDBACK_TAGS,
  PREFERENCE_TAG_GROUPS,
  THEME_CATEGORIES,
  THEME_HELP_NOTICE,
  fetchAvailableRegions,
  fetchRecommendedSpots,
  type SpotCard,
} from '@/api/spots';
import { Brand, Fonts } from '@/constants/theme';
import { useSpotDistance } from '@/hooks/use-spot-distance';
import {
  confirmResetIfNeeded,
  registerPindrawSession,
} from '@/utils/pindrawSession';

const ScreenTheme = {
  background: '#f9f8f2',
  text: '#1A1A1A',
  greenDeep: '#1a3a2a',
  muted: '#9AA0A6',
};

export default function PinDrawScreen() {
  const router = useRouter();

  // 이번 세션 동안 유지되는 선호(첫 진입 설문). 매 추천 호출에 함께 반영된다.
  const [surveyDone, setSurveyDone] = useState(false);
  const [preference, setPreference] = useState<Set<string>>(new Set());
  const [regions, setRegions] = useState<string[]>([]);
  // 지역 다중 선택(중복 선택 가능). 비어있으면 전체.
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  // "테마별" 다중 선택(THEME_CATEGORIES, 중복 선택 가능). 비어있으면 전체.
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  // 디버그용 — 12/14/28/38 각 출처가 실제로 잘 불러와졌는지 확인할 때만 쓴다.
  const [debugSourceType, setDebugSourceType] = useState<number | null>(null);
  // "테마별" ? 아이콘을 누르면 뜨는 테마 안내 모달.
  const [themeHelpVisible, setThemeHelpVisible] = useState(false);

  useEffect(() => {
    fetchAvailableRegions().then(setRegions);
  }, []);

  const [cards, setCards] = useState<SpotCard[]>([]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // 5개 한 묶음을 다 패스하면 1번만 추가로 5개를 더 준다(총 10번의 패스 기회).
  // 그 추가 기회까지 다 쓰면 확인 없이 바로 초기화한다.
  const [extraRoundUsed, setExtraRoundUsed] = useState(false);

  const draw = useCallback(
    async (excludeIds: string[] = [], roundFeedbackTags: string[] = []) => {
      setLoading(true);
      setError(false);
      const tags = [...preference, ...roundFeedbackTags];
      const spots = await fetchRecommendedSpots(
        excludeIds,
        tags,
        Array.from(selectedRegions),
        debugSourceType,
        Array.from(selectedThemes),
      );
      if (spots.length === 0) {
        setError(true);
      } else {
        setCards(spots);
        setIndex(0);
        setFeedback(new Set());
      }
      setLoading(false);
    },
    [preference, selectedRegions, debugSourceType, selectedThemes],
  );

  // 설문을 마치면 그 선호를 반영해 첫 3장을 뽑는다.
  useEffect(() => {
    if (surveyDone) draw();
  }, [surveyDone, draw]);

  // 진행중인 뽑기 존재 확인용 함수
  const surveyDoneRef = useRef(surveyDone);
  useEffect(() => {
    surveyDoneRef.current = surveyDone;
  }, [surveyDone]);

  const resetToSurvey = useCallback(() => {
    setSurveyDone(false);
    setPreference(new Set());
    setSelectedRegions(new Set());
    setSelectedThemes(new Set());
    setDebugSourceType(null);
    setCards([]);
    setIndex(0);
    setFeedback(new Set());
    setError(false);
    setExtraRoundUsed(false);
  }, []);

  useEffect(() => {
    registerPindrawSession(() => surveyDoneRef.current, resetToSurvey);
  }, [resetToSurvey]);

  // 안드로이드 하드웨어 뒤로가기도 탭 전환과 똑같이 가로챈다 — 진행 중인 뽑기가 있으면
  // 초기화 확인창을 띄우고, 없으면(surveyDoneRef.current === false) 원래 뒤로가기 동작 그대로 둔다.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (!surveyDoneRef.current) return false;
          confirmResetIfNeeded(() => router.back());
          return true;
        },
      );
      return () => subscription.remove();
    }, [router]),
  );

  const current = cards[index];

  // 내 위치 기준 거리 라벨(위치 확인 중/권한 없음 상태도 문구로 표시).
  const distanceLabel = useSpotDistance(current);

  const togglePreference = (tagId: string) => {
    setPreference((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const toggleTheme = (themeId: string) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else {
        next.add(themeId);
      }
      return next;
    });
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  };

  const toggleFeedback = (tagId: string) => {
    setFeedback((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // 초기화 확인창 없이 바로 초기화 — "더 뽑을 기회가 없어서" 끝나는 경우라 나갈지 물을 필요는
  // 없고, 초기화된다는 사실만 알려주면 된다(confirmResetIfNeeded와는 별개의 상황).
  const resetWithNotice = () => {
    Alert.alert(
      '초기화됩니다',
      '더 뽑을 수 있는 쉼표가 없어서 처음 선택 화면으로 돌아갈게요.',
      [{ text: '확인', onPress: resetToSurvey }],
    );
  };

  // 5개짜리 한 묶음을 다 패스했을 때: 추가 기회가 남아있으면 한 번 더 받을지 물어보고,
  // 이미 추가 기회를 썼다면(총 10번 다 패스) 바로 초기화 안내로 넘어간다.
  const handleBatchExhausted = () => {
    if (extraRoundUsed) {
      resetWithNotice();
      return;
    }
    Alert.alert(
      '추가 쉼표 뽑기',
      '5개의 쉼표 중 선택하지 못해 5회의 추가 쉼표를 받으시겠습니까?',
      [
        { text: '취소', style: 'cancel', onPress: resetWithNotice },
        {
          text: '추가 뽑기',
          onPress: () => {
            setExtraRoundUsed(true);
            draw(
              cards.map((card) => card.id),
              Array.from(feedback),
            );
          },
        },
      ],
    );
  };

  const handlePass = () => {
    if (index < cards.length - 1) {
      setIndex(index + 1);
      return;
    }
    handleBatchExhausted();
  };

  const handleOpenDetail = () => {
    if (!current) return;
    router.push({ pathname: '/spot-detail', params: { id: current.id } });
  };

  if (!surveyDone) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.surveyBox}>
          <Text style={styles.surveyTitle}>떠나기 전에 알려주세요</Text>
          <Text style={styles.surveyDesc}>
            선호하시는 여행 스타일을 골라주시면, 추천에 반영할게요.{'\n'}
            선택하지 않으셔도 바로 시작할 수 있어요.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.surveyScroll}
          >
            {PREFERENCE_TAG_GROUPS.map((group) => (
              <View key={group.title}>
                <View style={styles.surveyGroup}>
                  <Text style={styles.surveyGroupTitle}>{group.title}</Text>
                  <View style={styles.chipRow}>
                    {group.tags.map((tag) => {
                      const selected = preference.has(tag.id);
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          style={[styles.chip, selected && styles.chipSelected]}
                          activeOpacity={0.8}
                          onPress={() => togglePreference(tag.id)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                            ]}
                          >
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {group.title === '기본' && (
                  <>
                    <View style={styles.surveyGroup}>
                      <View style={styles.surveyGroupTitleRow}>
                        <Text style={[styles.surveyGroupTitle, styles.surveyGroupTitleInRow]}>
                          테마별
                        </Text>
                        <TouchableOpacity
                          hitSlop={8}
                          onPress={() => setThemeHelpVisible(true)}
                          accessibilityRole="button"
                          accessibilityLabel="테마 분류 도움말"
                        >
                          <Ionicons
                            name="help-circle-outline"
                            size={18}
                            color={ScreenTheme.muted}
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.chipRow}>
                        <TouchableOpacity
                          style={[
                            styles.chip,
                            selectedThemes.size === 0 && styles.chipSelected,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => setSelectedThemes(new Set())}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selectedThemes.size === 0 && styles.chipTextSelected,
                            ]}
                          >
                            전체
                          </Text>
                        </TouchableOpacity>
                        {THEME_CATEGORIES.map((theme) => {
                          const selected = selectedThemes.has(theme.id);
                          return (
                            <TouchableOpacity
                              key={theme.id}
                              style={[
                                styles.chip,
                                selected && styles.chipSelected,
                              ]}
                              activeOpacity={0.8}
                              onPress={() => toggleTheme(theme.id)}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  selected && styles.chipTextSelected,
                                ]}
                              >
                                {theme.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.surveyGroup}>
                      <Text style={styles.surveyGroupTitle}>지역</Text>
                      <View style={styles.chipRow}>
                        <TouchableOpacity
                          style={[
                            styles.chip,
                            selectedRegions.size === 0 && styles.chipSelected,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => setSelectedRegions(new Set())}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selectedRegions.size === 0 && styles.chipTextSelected,
                            ]}
                          >
                            전체
                          </Text>
                        </TouchableOpacity>
                        {regions.map((region) => {
                          const selected = selectedRegions.has(region);
                          return (
                            <TouchableOpacity
                              key={region}
                              style={[
                                styles.chip,
                                selected && styles.chipSelected,
                              ]}
                              activeOpacity={0.8}
                              onPress={() => toggleRegion(region)}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  selected && styles.chipTextSelected,
                                ]}
                              >
                                {region}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}
              </View>
            ))}

            <View style={styles.surveyGroup}>
              <Text style={styles.surveyGroupTitle}>
                🔧 (테스트) 출처별로만 뽑기
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    debugSourceType === null && styles.chipSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setDebugSourceType(null)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      debugSourceType === null && styles.chipTextSelected,
                    ]}
                  >
                    전체
                  </Text>
                </TouchableOpacity>
                {DEBUG_SOURCE_TYPES.map((type) => {
                  const selected = debugSourceType === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      activeOpacity={0.8}
                      onPress={() => setDebugSourceType(type.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.surveyStartButton}
            activeOpacity={0.85}
            onPress={() => setSurveyDone(true)}
          >
            <Text style={styles.surveyStartButtonText}>쉼표 뽑으러 가기</Text>
          </TouchableOpacity>
        </View>

        {/* 테마별 ? 도움말 — 분류 근거(관광공사 공식 분류)와 테마별 설명/예시 */}
        <Modal
          visible={themeHelpVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setThemeHelpVisible(false)}
        >
          <View style={styles.helpOverlay}>
            <View style={styles.helpCard}>
              <View style={styles.helpHeader}>
                <Text style={styles.helpTitle}>테마 안내</Text>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => setThemeHelpVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="도움말 닫기"
                >
                  <Ionicons name="close" size={20} color={ScreenTheme.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.helpNotice}>{THEME_HELP_NOTICE}</Text>

              <ScrollView
                style={styles.helpScroll}
                showsVerticalScrollIndicator={false}
              >
                {THEME_CATEGORIES.map((theme) => (
                  <View key={theme.id} style={styles.helpItem}>
                    <Text style={styles.helpItemLabel}>{theme.label}</Text>
                    <Text style={styles.helpItemDesc}>{theme.description}</Text>
                    <Text style={styles.helpItemExamples}>
                      예: {theme.examples}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => confirmResetIfNeeded(() => router.back())}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>쉼표 뽑기</Text>
        <Text style={styles.headerCounter}>
          {cards.length > 0 ? `${index + 1}/${cards.length}` : ''}
        </Text>
      </View>

      {!loading && !error && cards.length > 0 && (
        <View style={styles.dotsRow}>
          {cards.map((card, i) => (
            <View
              key={card.id}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.green} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centerBox}>
          <Text style={styles.desc}>
            추천을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => draw()}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && current && (
        <View style={styles.body}>
          <TouchableOpacity
            style={styles.banner}
            activeOpacity={0.9}
            onPress={handleOpenDetail}
          >
            {current.imageUrl ? (
              <Image
                source={{ uri: current.imageUrl }}
                style={styles.bannerImage}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <Text style={styles.bannerIcon}>{current.icon}</Text>
            )}

            {current.imageUrl && <View style={styles.bannerScrim} />}
            <View style={styles.bannerTagRow}>
              {current.tags.map((tag) => (
                <Text key={tag} style={styles.tagPill}>
                  {tag}
                </Text>
              ))}
            </View>
          </TouchableOpacity>

          <Text style={styles.title}>{current.name}</Text>
          <Text style={styles.region}>📍 {current.region}</Text>
          <Text style={styles.cardDesc}>{current.shortDesc}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>● {current.congestion}</Text>
            <Text style={styles.metaText}>🚗 {distanceLabel}</Text>
          </View>

          <Text style={styles.feedbackLabel}>어떤 점이 아쉬웠나요?</Text>
          <View style={styles.chipRow}>
            {FEEDBACK_TAGS.map((tag) => {
              const selected = feedback.has(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  activeOpacity={0.8}
                  onPress={() => toggleFeedback(tag.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.passButton}
              activeOpacity={0.85}
              onPress={handlePass}
            >
              <Text style={styles.passButtonText}>✕ 패스</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pinButton}
              activeOpacity={0.85}
              onPress={handleOpenDetail}
            >
              <Text style={styles.pinButtonText}>📍 핀하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ScreenTheme.background,
  },
  surveyBox: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  surveyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    fontWeight: '800',
    color: Brand.green,
  },
  surveyDesc: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: ScreenTheme.text,
  },
  surveyScroll: {
    flex: 1,
    marginTop: 10,
  },
  surveyGroup: {
    marginBottom: 20,
  },
  surveyGroupTitle: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    color: ScreenTheme.muted,
  },
  surveyGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  surveyGroupTitleInRow: {
    // 행(Row)이 아래 여백을 담당하므로 제목 자체 여백은 끈다(이중 여백 방지).
    marginBottom: 0,
  },
  helpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  helpCard: {
    maxHeight: '78%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  helpTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '800',
    color: ScreenTheme.text,
  },
  helpNotice: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eef5ee',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    color: ScreenTheme.greenDeep,
  },
  helpScroll: {
    flexGrow: 0,
  },
  helpItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ede4',
  },
  helpItemLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: ScreenTheme.text,
  },
  helpItemDesc: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: '#4a4a45',
  },
  helpItemExamples: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: ScreenTheme.muted,
  },
  surveyStartButton: {
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: ScreenTheme.greenDeep,
  },
  surveyStartButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 32,
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
  headerCounter: {
    width: 32,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: ScreenTheme.muted,
  },
  dotsRow: {
    marginTop: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0ddd3',
  },
  dotActive: {
    width: 20,
    backgroundColor: Brand.green,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  body: {
    flex: 1,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  banner: {
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
  bannerTagRow: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  title: {
    marginTop: 16,
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '800',
    color: ScreenTheme.text,
  },
  region: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: ScreenTheme.muted,
  },
  cardDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    color: '#4a4a45',
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: ScreenTheme.greenDeep,
  },
  feedbackLabel: {
    marginTop: 20,
    fontSize: 13,
    fontWeight: '700',
    color: ScreenTheme.text,
  },
  chipRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8d4c8',
    backgroundColor: '#ffffff',
  },
  chipSelected: {
    backgroundColor: ScreenTheme.greenDeep,
    borderColor: ScreenTheme.greenDeep,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ScreenTheme.text,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  actionRow: {
    marginTop: 'auto',
    marginBottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  passButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#eeece3',
  },
  passButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6f6a5c',
  },
  pinButton: {
    flex: 1.4,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: ScreenTheme.greenDeep,
  },
  pinButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  desc: {
    fontSize: 14,
    lineHeight: 22,
    color: ScreenTheme.text,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Brand.green,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
