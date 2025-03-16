import { RiskIndicator, TokenLocation } from "../models";

export type ParameterMetaData = {
  dataDate: number;
  dataTime: number;
  forecastTime: number;
  level: number;
  maximum: number;
  minimum: number;
  parameterName: string;
  parameterUnits: string;
  shortName: string;
  typeOfLevel: string;
  key: string;
};

export type PointForecastContent = {
  metadata: ParameterMetaData;
  units: string;
};

export interface PointForecastValue extends PointForecastContent {
  value: number | null;
  risk?: RiskIndicator;
}

export type LocalTimeValues = {
  timeZone: string;
  unixTimestamp: number;
  localTime: string;
};

export type SunRiseSetValues = {
  isDay: boolean;
  sunrise: string;
  sunset: string;
};

export interface WeatherMetaValues {
  timezone: string;
  date: string;
  closestCity: string;
}

export interface WeatherMeta extends SunRiseSetValues, WeatherMetaValues {}

export interface WeatherMetaContent extends SunRiseSetValues, LocalTimeValues {}

export interface PointForecastWeather {
  values: PointForecastValue[];
}

export interface PointForecastDetails
  extends WeatherMeta,
    PointForecastWeather {}

export type PointForecastDetailsCallback =
  | PointForecastDetails[]
  | string
  | {}
  | { progress: string };

export type ForecastParamSelect = {
  param_key: string;
  model?: string;
  level?: number;
  typeOfLevel?: string;
  measure_type?: string;
  stepType?: string;
};

export type WeatherRequest = {
  lat: number;
  lon: number;
  model?: string;
  param_keys: string | string[] | ForecastParamSelect[];
  level?: number;
  total_days?: number;
  step_hours?: number;
  start_hour_offset?: number;
};

export interface ForecastedWeatherValues {
  value: number;
  datetime: string;
}

export interface ForecastedWeatherValuesWithMeta
  extends ForecastedWeatherValues,
    WeatherMeta {}

export interface ForecastResponseDetails extends PointForecastContent {
  values: ForecastedWeatherValues[];
}

export interface ForecastSendDetails extends PointForecastContent {
  timeDetails: WeatherMetaValues & LocalTimeValues;
  values: ForecastedWeatherValuesWithMeta[];
}

export interface ForecastWarning {
  risk: Partial<RiskIndicator> & { onDate?: Date };
  datetime: string;
  value: number;
  forecast: ParameterMetaData;
  location: TokenLocation;
}
