import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Brand, Fonts } from '@/constants/theme';

const HomeTheme = {
    background: '#f9f8f2',
    greenDeep: '#1a3a2a',
    text: '#1A1A1A',
};

export function HomeHeader() {
    return (
        <View style={styles.header}>
            <Text style={styles.logo}>쉼표</Text>

            <View style={styles.rightArea}>

                <TouchableOpacity
                    style={styles.settingButton}
                    activeOpacity={0.7}
                    onPress={() => {
                        // TODO: 설정 화면 연결 예정
                    }}
                >
                    <Text style={styles.settingIcon}>⚙︎</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        marginTop: 6,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    logo: {
        fontFamily: Fonts.serif,
        fontSize: 16,
        fontWeight: '700',
        color: Brand.green,
    },
    rightArea: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: HomeTheme.text,
    },
    settingButton: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingIcon: {
        fontSize: 16,
        color: Brand.muted,
    },
});