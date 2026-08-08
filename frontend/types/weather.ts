export type Weather = {
    latitude: number;
    longitude: number;
    nx: number;
    ny: number;

    temperature: number | null;
    precipitationProbability: number | null;
    minTemperature: number | null;
    maxTemperature: number | null;

    sky: string | null;
    precipitationType: string | null;
    forecastTime: string | null;
};