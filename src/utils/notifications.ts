import { PushMessage } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const sendPushNotification = async (
  expoPushToken: string,
  title: string,
  body: string,
  data?: any
) => {
  const message: PushMessage = {
    to: expoPushToken,
    sound: 'default', // Optional: the sound to play on the device
    title,
    body,
    data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const responseData = await response.json();
    console.log('Push notification response:', responseData);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};
