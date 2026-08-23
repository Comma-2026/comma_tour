export type SpotCategory = 'nature' | 'history' | 'culture' | 'experience' | 'etc';

export interface SpotMarker {
    id: string;
    contentId: string;
    place_name: string;
    region: string;
    category: SpotCategory;
    latitude: number;
    longitude: number;
    description: string;
}
