/* eslint-disable @typescript-eslint/no-explicit-any */
export type LocationCoordinates = {
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  altitudeAccuracy?: number;
  heading?: number;
  latitude: number;
};

export type TokenCoordinates = {
  coords: LocationCoordinates;
  user: string;
};

export interface PushMessage {
  to: string;
  sound?: string;
  title: string;
  body: string;
  data?: any;
}
