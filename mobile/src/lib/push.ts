import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { mobileApi } from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerMadarPush(accessToken: string, workspaceId: string) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('madar-operations', {
      name: 'عمليات مَدار وأوربي',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  await mobileApi.registerPushToken(accessToken, workspaceId, result.data, Platform.OS);
}
