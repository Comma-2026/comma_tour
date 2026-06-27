import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Brand, Fonts } from '@/constants/theme';

const HomeTheme = {
    greenDeep: '#1a3a2a',
    greenSub: '#4a7c5f',
    card: '#ffffff',
    text: '#1A1A1A',
};

export function HomeActionCards() {
    const handleRandomPress = () => {
        Alert.alert('준비 중', '쉼표 뽑기 기능은 곧 연결될 예정이에요.');
    };

    const handleSearchPress = () => {
        Alert.alert('준비 중', '장소 검색 기능은 곧 연결될 예정이에요.');
    };

    return (
        <View style={styles.section}>
            <Text style={styles.title}>
                오늘 어디로{'\n'}
                떠나볼까요?
            </Text>

            <View style={styles.cardRow}>
                <TouchableOpacity
                    style={[styles.card, styles.mainCard]}
                    activeOpacity={0.86}
                    onPress={handleRandomPress}
                >
                    <View style={styles.mainPattern}>
                        <Text style={styles.patternText}>쉼</Text>
                    </View>

                    <View style={styles.mainCardContent}>
                        <Text style={styles.smallLabel}>랜덤 추천</Text>
                        <Text style={styles.mainCardTitle}>쉼표 뽑기</Text>
                        <Text style={styles.mainCardDesc}>지금 바로 출발 →</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, styles.searchCard]}
                    activeOpacity={0.86}
                    onPress={handleSearchPress}
                >
                    <Text style={styles.searchIcon}>🔍</Text>
                    <Text style={styles.smallLabelDark}>장소 검색</Text>
                    <Text style={styles.searchTitle}>
                        갈 곳이{'\n'}
                        있어요
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const CARD_SHADOW = {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
};

const styles = StyleSheet.create({
    section: {
        marginTop: 4,
    },
    title: {
        marginBottom: 18,
        fontFamily: Fonts.serif,
        fontSize: 25,
        lineHeight: 35,
        fontWeight: '800',
        color: HomeTheme.text,
        letterSpacing: -0.5,
    },
    cardRow: {
        flexDirection: 'row',
        gap: 12,
    },
    card: {
        borderRadius: 24,
        ...CARD_SHADOW,
    },
    mainCard: {
        flex: 1.35,
        height: 116,
        overflow: 'hidden',
        backgroundColor: HomeTheme.greenDeep,
    },
    mainPattern: {
        position: 'absolute',
        right: -4,
        top: -18,
        opacity: 0.08,
    },
    patternText: {
        fontFamily: Fonts.serif,
        fontSize: 88,
        fontWeight: '900',
        color: '#ffffff',
    },
    mainCardContent: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 18,
    },
    smallLabel: {
        marginBottom: 4,
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.62)',
    },
    mainCardTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
    },
    mainCardDesc: {
        marginTop: 5,
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.72)',
    },
    searchCard: {
        width: 104,
        height: 116,
        padding: 16,
        backgroundColor: HomeTheme.card,
        justifyContent: 'center',
    },
    searchIcon: {
        marginBottom: 10,
        fontSize: 22,
    },
    smallLabelDark: {
        marginBottom: 4,
        fontSize: 10,
        fontWeight: '700',
        color: Brand.muted,
    },
    searchTitle: {
        fontFamily: Fonts.serif,
        fontSize: 17,
        lineHeight: 22,
        fontWeight: '800',
        color: HomeTheme.text,
    },
});