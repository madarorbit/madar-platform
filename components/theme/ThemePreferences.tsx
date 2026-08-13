"use client";

import { useTheme, type MadarTheme } from "@/components/theme/ThemeProvider";
import { Icon } from "@/components/ui/Icons";

const options: Array<{ value: MadarTheme; label: string; description: string }> = [
  { value: "light", label: "فاتح", description: "أسطح فاتحة ونصوص داكنة" },
  { value: "dark", label: "داكن", description: "أسطح داكنة ونصوص فاتحة" },
  { value: "system", label: "حسب النظام", description: "يتبع إعداد جهازك تلقائيًا" },
];

export default function ThemePreferences() {
  const { preference, resolvedTheme, setTheme } = useTheme();
  return (
    <fieldset className="md-theme-preferences">
      <legend className="sr-only">اختيار مظهر مَدار</legend>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={preference === option.value} onClick={() => setTheme(option.value)} className={preference === option.value ? "is-selected" : ""}>
          <span className="md-theme-choice-icon"><Icon name={option.value === "system" ? "layers" : "settings"} /></span>
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
          {preference === option.value ? <Icon name="check" className="md-theme-choice-check" /> : null}
        </button>
      ))}
      <p>المظهر المعروض الآن: <strong>{resolvedTheme === "dark" ? "داكن" : "فاتح"}</strong></p>
    </fieldset>
  );
}
