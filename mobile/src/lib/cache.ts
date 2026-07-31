import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DashboardSnapshot } from '@/types';

const key = 'madar-mobile-dashboard-v1';

export async function readDashboardCache() {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DashboardSnapshot;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function writeDashboardCache(snapshot: DashboardSnapshot) {
  await AsyncStorage.setItem(key, JSON.stringify(snapshot));
}

export async function clearDashboardCache() {
  await AsyncStorage.removeItem(key);
}
