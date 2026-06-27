import { StyleSheet, Text, View } from 'react-native';

import { Brand, Fonts } from '@/constants/theme';

const ScreenTheme = {
    background: '#f9f8f2',
    text: '#1A1A1A',
};

export default function MapScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>지도</Text>
            <Text style={styles.desc}>관광지 지도 기능이 들어갈 화면이에요.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 72,
        backgroundColor: ScreenTheme.background,
    },
    title: {
        fontFamily: Fonts.serif,
        fontSize: 28,
        fontWeight: '800',
        color: Brand.green,
    },
    desc: {
        marginTop: 12,
        fontSize: 14,
        lineHeight: 22,
        color: ScreenTheme.text,
    },
});