"use client";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="surface p-8">
      <p className="eyebrow">تعذر تحميل القسم</p><h2 className="mt-2 text-2xl font-black">بياناتك لم تتغير.</h2>
      <p className="muted mt-2">حدث خطأ أثناء القراءة. أعد المحاولة، وإذا استمر الخطأ راجع سجل النظام.</p>
      <button className="button-primary mt-5" onClick={reset}>إعادة المحاولة</button>
    </div>
  );
}
