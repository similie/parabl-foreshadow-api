import {
  ExpressRequest,
  ExpressResponse,
  ExpressNext,
} from '@similie/ellipsies';
export const BlockAllTraffic = async (
  _req: ExpressRequest,
  _res: ExpressResponse,
  next: ExpressNext
) => {
  return next('This route is unavailable');
};

export const TestOnlyTraffic = async (
  _req: ExpressRequest,
  _res: ExpressResponse,
  next: ExpressNext
) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return next('This route is unavailable');
};
