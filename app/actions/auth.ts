"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseConfig, siteUrl } from "@/src/lib/env";
import { safeReturnTo } from "@/src/lib/auth";
import { email, password } from "@/src/lib/validation";
import { validateMagicBytes } from "@/src/lib/file-signatures.mjs";
type AuthState = {
  error?: string;
  success?: string;
  phone?: string;
  destination?: string;
};
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
const arabicAuthError = (
  payload: {
    code?: string;
    error_code?: string;
    msg?: string;
    error_description?: string;
  } | null,
  status: number,
) => {
  const code = payload?.code || payload?.error_code || "",
    message = (payload?.msg || payload?.error_description || "").toLowerCase();
  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  )
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed"))
    return "لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التأكيد ثم حاول مجددًا.";
  if (code === "user_already_exists" || message.includes("already registered"))
    return "يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.";
  if (code === "weak_password")
    return "كلمة المرور ضعيفة. استخدم ثمانية أحرف على الأقل وتجنب الكلمات الشائعة.";
  if (code.includes("rate_limit") || message.includes("rate limit"))
    return "تمت محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.";
  if (code === "otp_expired" || message.includes("expired"))
    return "انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.";
  if (message.includes("token not found") || message.includes("invalid token"))
    return "رمز التحقق غير صحيح أو استُخدم من قبل.";
  if (
    message.includes("phone provider") ||
    message.includes("phone signups are disabled")
  )
    return "تسجيل الدخول بالجوال غير مفعّل مؤقتًا. يرجى المحاولة بالبريد الإلكتروني.";
  if (message.includes("sms") || message.includes("whatsapp"))
    return "تعذر إرسال رمز واتساب الآن. تحقق من الرقم ثم حاول مجددًا.";
  if (code === "captcha_failed" || message.includes("captcha"))
    return "تعذر اجتياز التحقق الأمني. أعد المحاولة.";
  if (message.includes("invalid format") || code === "validation_failed")
    return "تحقق من صحة البيانات المدخلة.";
  if (status >= 500)
    return "خدمة تسجيل الدخول غير متاحة مؤقتًا. حاول بعد قليل.";
  return "تعذر إتمام عملية المصادقة. تحقق من البيانات وحاول مجددًا.";
};
async function auth(path: string, body: unknown) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }),
    json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(arabicAuthError(json, response.status));
  return json;
}
const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
const rememberedPath = (value: string | undefined) => {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return "";
  }
};
export async function setSession(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  const jar = await cookies();
  jar.set(
    "madar-access-token",
    session.access_token,
    cookieOptions(session.expires_in),
  );
  jar.set(
    "madar-refresh-token",
    session.refresh_token,
    cookieOptions(SESSION_MAX_AGE),
  );
}
export async function login(_previous: AuthState, form: FormData) {
  let destination = "/account";
  try {
    const result = await auth("token?grant_type=password", {
      email: email(String(form.get("email") || "")),
      password: password(String(form.get("password") || "")),
    });
    await setSession(result);
    const jar = await cookies(),
      last = rememberedPath(jar.get("madar-last-path")?.value);
    destination = safeReturnTo(
      String(form.get("next") || last || ""),
      "/account",
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر تسجيل الدخول.",
    };
  }
  redirect(destination);
}
export async function register(_previous: AuthState, form: FormData) {
  try {
    const full_name = String(form.get("full_name") || "").trim();
    if (full_name.length < 2)
      throw new Error("الاسم الكامل يجب أن يكون حرفين على الأقل.");
    const userEmail = email(String(form.get("email") || "")),
      userPassword = password(
        String(form.get("password") || ""),
        String(form.get("confirm") || ""),
      );
    if (form.get("terms") !== "on") throw new Error("يلزم قبول الشروط.");
    const redirectTo = encodeURIComponent(
      `${siteUrl()}/auth/callback?next=/account`,
    );
    await auth(`signup?redirect_to=${redirectTo}`, {
      email: userEmail,
      password: userPassword,
      data: { full_name },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر إنشاء الحساب.",
    };
  }
  redirect("/login?registered=1");
}
export async function forgotPassword(_previous: AuthState, form: FormData) {
  try {
    const userEmail = String(form.get("email") || "").trim();
    if (/^\S+@\S+\.\S+$/.test(userEmail)) {
      const redirectTo = encodeURIComponent(
        `${siteUrl()}/auth/callback?next=/reset-password`,
      );
      await auth(`recover?redirect_to=${redirectTo}`, { email: userEmail });
    }
    return { success: "إذا كان البريد مسجلاً، ستصلك رسالة استعادة." };
  } catch {
    return { success: "إذا كان البريد مسجلاً، ستصلك رسالة استعادة." };
  }
}
export async function resetPassword(_previous: AuthState, form: FormData) {
  try {
    const value = password(
      String(form.get("password") || ""),
      String(form.get("confirm") || ""),
    );
    const { currentUser, supabaseFetch } =
      await import("@/src/lib/supabase/server");
    if (!(await currentUser()))
      throw new Error("انتهت جلسة الاستعادة؛ اطلب رابطاً جديداً.");
    await supabaseFetch("/auth/v1/user", {
      method: "PUT",
      body: JSON.stringify({ password: value }),
    });
    return {
      success: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول بها الآن.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر تغيير كلمة المرور.",
    };
  }
}
export async function logout() {
  const jar = await cookies(),
    token = jar.get("madar-access-token")?.value;
  if (token) {
    const { url, key } = supabaseConfig();
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  jar.set("madar-access-token", "", { ...cookieOptions(0), maxAge: 0 });
  jar.set("madar-refresh-token", "", { ...cookieOptions(0), maxAge: 0 });
  redirect("/");
}
export async function updateProfile(_previous: unknown, form: FormData) {
  const { currentUser, supabaseFetch, serverToken } =
    await import("@/src/lib/supabase/server");
  const user = await currentUser();
  if (!user) return { error: "يجب تسجيل الدخول." };
  try {
    const full_name = String(form.get("full_name") || "").trim();
    if (full_name.length < 2)
      throw new Error("الاسم الكامل يجب أن يكون حرفين على الأقل.");
    const values: {
      full_name: string;
      phone: string | null;
      avatar_url?: string;
    } = { full_name, phone: String(form.get("phone") || "").trim() || null };
    const avatar = form.get("avatar");
    if (avatar instanceof File && avatar.size) {
      const allowed: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        },
        ext = allowed[avatar.type];
      if (!ext || avatar.size > 5 * 1024 * 1024)
        throw new Error(
          "الصورة يجب أن تكون JPEG أو PNG أو WebP وبحجم لا يتجاوز 5 ميجابايت.",
        );
      if (!(await validateMagicBytes(avatar)))
        throw new Error("محتوى الصورة لا يطابق نوع الملف.");
      const { url, key } = supabaseConfig(),
        token = await serverToken(),
        path = `${user.id}/profile.${ext}`,
        response = await fetch(`${url}/storage/v1/object/avatars/${path}`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            "Content-Type": avatar.type,
            "x-upsert": "true",
          },
          body: avatar,
          cache: "no-store",
        });
      if (!response.ok) throw new Error("تعذر رفع صورة الحساب.");
      values.avatar_url = path;
    }
    await supabaseFetch(`/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    });
    revalidatePath("/account");
    revalidatePath("/account/profile");
    revalidatePath("/");
    return { success: "تم حفظ الملف الشخصي وصورة الحساب." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر حفظ الملف الشخصي.",
    };
  }
}
