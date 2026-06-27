export type RecentPin = {
    id: string;
    title: string;
    region: string;
    memo: string;
    icon: string;
};

export const recentPins: RecentPin[] = [
    {
        id: '1',
        title: '청량산 도립공원',
        region: '봉화군',
        memo: '아무도 없던 그 길',
        icon: '▲',
    },
    {
        id: '2',
        title: '봉화 송이밸리',
        region: '봉화군',
        memo: '향이 오래 남는 곳',
        icon: '🍄',
    },
    {
        id: '3',
        title: '영양 자작나무숲',
        region: '영양군',
        memo: '하얀 나무들이 빛났어',
        icon: '🌲',
    },
];