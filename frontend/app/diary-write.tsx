import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createDiary, diaryPhotoSource, fetchDiaryByPin } from '@/api/diary';
import { Brand, Fonts } from '@/constants/theme';
import { getToken } from '@/utils/authStorage';

const ScreenTheme = {
  background: '#f9f8f2',
  card: '#ffffff',
  text: '#1A1A1A',
  greenDeep: '#1a3a2a',
  muted: '#9AA0A6',
};

/**
 * 일기 작성/수정 화면.
 * 다이어리 탭에서 핀 정보를 파라미터로 받아 진입한다. 장소명은 핀에서 자동으로 채워진다.
 * 같은 핀에 이미 일기가 있으면(수정 진입) 기존 제목/내용/사진을 불러와 미리 채운다.
 * 사진은 갤러리에서 골라 base64로 백엔드에 보내고, 백엔드가 MySQL(LONGBLOB)에 저장한다.
 */
export default function DiaryWriteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pinId: string;
    contentId?: string;
    placeName: string;
    region?: string;
    visitedAt?: string;
  }>();

  const { pinId, contentId, placeName, region, visitedAt } = params;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 이미 저장된 사진 존재 여부(수정 진입 시) — 서버 이미지로 미리보기.
  const [hasSavedPhoto, setHasSavedPhoto] = useState(false);
  // 이번에 새로 고른 사진(미리보기용 로컬 uri + 전송용 base64).
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [newPhotoMime, setNewPhotoMime] = useState<string | null>(null);
  // 저장된 사진 미리보기 요청에 붙일 로그인 토큰.
  const [token, setToken] = useState<string | null>(null);

  // 이미 작성된 일기가 있으면 불러와 미리 채운다(수정 모드) + 토큰 로드.
  useEffect(() => {
    getToken().then(setToken);
    if (!pinId) {
      setLoading(false);
      return;
    }
    fetchDiaryByPin(pinId).then((existing) => {
      if (existing) {
        setTitle(existing.title);
        setContent(existing.content);
        setHasSavedPhoto(existing.has_photo);
      }
      setLoading(false);
    });
  }, [pinId]);

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진을 첨부하려면 갤러리 접근 권한이 필요해요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // allowsEditing를 켜면 '자르기'를 눌러야만 적용됨 → 끄고 고른 즉시 적용되게 한다.
      quality: 0.5, // 용량 절감(base64 전송/DB 저장 부담 완화)
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setNewPhotoUri(asset.uri);
    setNewPhotoBase64(asset.base64 ?? null);
    setNewPhotoMime(asset.mimeType ?? 'image/jpeg');
  };

  const handleRemoveNewPhoto = () => {
    setNewPhotoUri(null);
    setNewPhotoBase64(null);
    setNewPhotoMime(null);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!content.trim()) {
      Alert.alert('알림', '일기 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    const res = await createDiary({
      pin_id: pinId,
      content_id: contentId ?? null,
      place_name: placeName,
      region: region ?? '',
      title: title.trim(),
      content: content.trim(),
      visited_at: visitedAt ?? null,
      // 새로 고른 사진이 있을 때만 전송(없으면 백엔드가 기존 사진 유지).
      photo_base64: newPhotoBase64,
      photo_mime: newPhotoMime,
    });
    setSaving(false);

    if (res.success) {
      Alert.alert('저장 완료', '일기가 저장됐어요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('저장 실패', res.message ?? '잠시 후 다시 시도해주세요.');
    }
  };

  // 미리보기에 쓸 이미지: 새로 고른 사진(로컬) 우선, 없으면 저장된 서버 사진(토큰 필요).
  const previewSource = newPhotoUri
    ? { uri: newPhotoUri }
    : hasSavedPhoto
      ? diaryPhotoSource(pinId, token)
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>일기 작성</Text>
        <View style={styles.headerIcon} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Brand.green} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 핀에서 자동으로 가져온 장소 정보 */}
            <View style={styles.placeCard}>
              <Text style={styles.placeLabel}>📍 이 핀에 남기는 일기</Text>
              <Text style={styles.placeName}>{placeName}</Text>
              {!!region && <Text style={styles.placeRegion}>{region}</Text>}
              {!!visitedAt && (
                <Text style={styles.placeDate}>방문일 · {visitedAt}</Text>
              )}
            </View>

            <Text style={styles.fieldLabel}>사진</Text>
            {previewSource ? (
              <View style={styles.photoBox}>
                <Image
                  source={previewSource}
                  style={styles.photo}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={styles.photoActionButton}
                    activeOpacity={0.85}
                    onPress={handlePickPhoto}
                  >
                    <Text style={styles.photoActionText}>사진 변경</Text>
                  </TouchableOpacity>
                  {newPhotoUri && (
                    <TouchableOpacity
                      style={styles.photoActionButton}
                      activeOpacity={0.85}
                      onPress={handleRemoveNewPhoto}
                    >
                      <Text style={styles.photoActionText}>취소</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoAddButton}
                activeOpacity={0.85}
                onPress={handlePickPhoto}
              >
                <Text style={styles.photoAddIcon}>＋</Text>
                <Text style={styles.photoAddText}>사진 추가</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>제목</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="제목을 입력하세요 (선택)"
              placeholderTextColor={Brand.placeholder}
              maxLength={60}
            />

            <Text style={styles.fieldLabel}>내용</Text>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="이곳에서의 하루를 기록해보세요."
              placeholderTextColor={Brand.placeholder}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>저장하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ScreenTheme.background,
  },
  flex: {
    flex: 1,
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
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  placeCard: {
    borderRadius: 16,
    backgroundColor: '#eef5ee',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 22,
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
  fieldLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: ScreenTheme.text,
  },
  fieldLabelSpaced: {
    marginTop: 20,
  },
  photoBox: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: ScreenTheme.card,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  photo: {
    width: '100%',
    height: 200,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  photoActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#eef5ee',
  },
  photoActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: ScreenTheme.greenDeep,
  },
  photoAddButton: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    borderStyle: 'dashed',
    backgroundColor: ScreenTheme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddIcon: {
    fontSize: 28,
    color: ScreenTheme.muted,
  },
  photoAddText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: ScreenTheme.muted,
  },
  titleInput: {
    borderRadius: 12,
    backgroundColor: ScreenTheme.card,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: ScreenTheme.text,
    marginBottom: 20,
  },
  contentInput: {
    minHeight: 220,
    borderRadius: 12,
    backgroundColor: ScreenTheme.card,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 22,
    color: ScreenTheme.text,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Brand.green,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
