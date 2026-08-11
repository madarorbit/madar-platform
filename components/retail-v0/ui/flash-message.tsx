export function FlashMessage({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  const message = error ?? success;
  if (!message) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`surface-soft px-4 py-3 text-sm ${error ? "text-red-300" : "text-emerald-200"}`}
    >
      {message}
    </div>
  );
}
