import 'expo-sqlite/localStorage/install';
import type { DashboardSnapshot } from '@/types';

const key = 'madar-mobile-dashboard-v1';

export async function readDashboardCache() {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DashboardSnapshot;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export async function writeDashboardCache(snapshot: DashboardSnapshot) {
  localStorage.setItem(key, JSON.stringify(snapshot));
}

export async function clearDashboardCache() {
  localStorage.removeItem(key);
}
