import { ExpressRequest } from '@similie/ellipsies';

export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const requestBodyParser = <T>(req: ExpressRequest): Promise<T> => {
  return new Promise<T>((resolve) => {
    if (req.body && Object.keys(req.body).length) {
      resolve(req.body as T);
    }

    let body = '';
    req.on('data', (chunk: string) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        return resolve(body as unknown as T);
      }
      console.log('Raw body:', body);
      resolve(JSON.parse(body) as T);
    });
  });
};
