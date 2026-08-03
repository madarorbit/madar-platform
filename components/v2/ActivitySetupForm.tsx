"use client";

import { useState } from "react";
import { completeV2Setup } from "@/app/actions/v2-operations";
import V2ActionForm from "@/components/v2/V2ActionForm";

export type ActivityQuestion = {
  key: string;
  label_ar: string;
  help_ar: string | null;
  field_type: "text" | "number" | "boolean" | "select" | "multiselect";
  options: unknown;
  condition: Record<string, unknown>;
  validation: Record<string, unknown>;
  is_required: boolean;
};
type Answer = string | string[] | boolean;

const fieldClass = "field w-full rounded-xl p-3";
const list = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export default function ActivitySetupForm({
  questions,
  currency,
}: {
  questions: ActivityQuestion[];
  currency: string;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const visible = (question: ActivityQuestion) => {
    const field =
      typeof question.condition.field === "string"
        ? question.condition.field
        : null;
    if (!field) return true;
    const value = answers[field];
    if ("equals" in question.condition)
      return value === question.condition.equals;
    if (Array.isArray(question.condition.in))
      return question.condition.in.includes(value);
    return true;
  };
  const set = (key: string, value: Answer) =>
    setAnswers((current) => ({ ...current, [key]: value }));
  return (
    <V2ActionForm
      action={completeV2Setup}
      title="أسئلة إعداد النشاط"
      description="تُستخدم الإجابات لتهيئة وحدات ولوحة وتقارير قطاعك. يمكنك تعديلها لاحقًا."
      submitLabel="حفظ وإكمال الإعداد"
    >
      <label className="grid gap-2 text-sm font-bold">
        العملة الأساسية
        <select name="currency" defaultValue={currency} className={fieldClass}>
          <option value="SAR">الريال السعودي SAR</option>
          <option value="USD">الدولار USD</option>
          <option value="YER">الريال اليمني YER</option>
        </select>
      </label>
      {questions.filter(visible).map((question) => (
        <label key={question.key} className="grid gap-2 text-sm font-bold">
          <span>
            {question.label_ar}
            {question.is_required && <b className="text-amber-200"> *</b>}
          </span>
          {question.help_ar && (
            <small className="font-normal text-slate-400">
              {question.help_ar}
            </small>
          )}
          {question.field_type === "boolean" ? (
            <select
              required={question.is_required}
              name={`answer:${question.key}`}
              className={fieldClass}
              value={String(answers[question.key] ?? "")}
              onChange={(event) =>
                set(
                  question.key,
                  event.target.value === ""
                    ? ""
                    : event.target.value === "true",
                )
              }
            >
              <option value="">اختر</option>
              <option value="true">نعم</option>
              <option value="false">لا</option>
            </select>
          ) : question.field_type === "select" ? (
            <select
              required={question.is_required}
              name={`answer:${question.key}`}
              className={fieldClass}
              value={String(answers[question.key] ?? "")}
              onChange={(event) => set(question.key, event.target.value)}
            >
              <option value="">اختر</option>
              {list(question.options).map((option) => (
                <option key={option} value={JSON.stringify(option)}>
                  {option}
                </option>
              ))}
            </select>
          ) : question.field_type === "multiselect" ? (
            <>
              <select
                multiple
                required={question.is_required}
                className={fieldClass}
                value={list(answers[question.key])}
                onChange={(event) =>
                  set(
                    question.key,
                    [...event.target.selectedOptions].map(
                      (option) => option.value,
                    ),
                  )
                }
              >
                {list(question.options).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <input
                type="hidden"
                name={`answer:${question.key}`}
                value={JSON.stringify(list(answers[question.key]))}
              />
            </>
          ) : (
            <input
              required={question.is_required}
              name={`answer:${question.key}`}
              type={question.field_type === "number" ? "number" : "text"}
              min={
                typeof question.validation.min === "number"
                  ? question.validation.min
                  : undefined
              }
              max={
                typeof question.validation.max === "number"
                  ? question.validation.max
                  : undefined
              }
              maxLength={
                typeof question.validation.maxLength === "number"
                  ? question.validation.maxLength
                  : undefined
              }
              className={fieldClass}
              value={String(answers[question.key] ?? "")}
              onChange={(event) => set(question.key, event.target.value)}
            />
          )}
        </label>
      ))}
    </V2ActionForm>
  );
}
