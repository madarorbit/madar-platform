import type { OperatingMode } from "./account";

export const LAUNCH_SPECIALIZATIONS = [
  {
    code: "GENERAL_COMMERCE",
    nameAr: "تجارة عامة",
    family: "COMMERCE",
    extension: "commerce",
  },
  {
    code: "WHOLESALE",
    nameAr: "بيع بالجملة",
    family: "COMMERCE",
    extension: "commerce",
  },
  {
    code: "RETAIL",
    nameAr: "بيع بالتجزئة",
    family: "COMMERCE",
    extension: "commerce",
  },
  {
    code: "WHOLESALE_RETAIL",
    nameAr: "جملة وتجزئة",
    family: "COMMERCE",
    extension: "commerce",
  },
  {
    code: "GROCERY_WHOLESALE",
    nameAr: "تموينات غذائية",
    family: "COMMERCE",
    extension: "commerce",
  },
  {
    code: "RESTAURANT",
    nameAr: "مطعم",
    family: "FOOD_SERVICE",
    extension: "food_service",
  },
  {
    code: "HOTEL",
    nameAr: "فندق",
    family: "HOSPITALITY",
    extension: "hospitality",
  },
] as const;
export type LaunchSpecializationCode =
  (typeof LAUNCH_SPECIALIZATIONS)[number]["code"];
export type VerticalExtension =
  (typeof LAUNCH_SPECIALIZATIONS)[number]["extension"];

export function isLaunchSpecialization(
  value: unknown,
): value is LaunchSpecializationCode {
  return (
    typeof value === "string" &&
    LAUNCH_SPECIALIZATIONS.some((item) => item.code === value)
  );
}
export function verticalByCode(code: string | null | undefined) {
  return LAUNCH_SPECIALIZATIONS.find((item) => item.code === code) || null;
}
export function sourceOfTruth(mode: OperatingMode) {
  return mode === "CONNECTED_EXTERNAL" ? "EXTERNAL" : "MADAR";
}
