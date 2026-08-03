import V2ActionForm from "@/components/v2/V2ActionForm";
import {
  checkInHotelReservation,
  checkOutHotelStay,
  createHotelReservation,
  createHotelRoomRate,
  manageHotelMaintenance,
  postHotelFolioCharge,
  updateHousekeepingTask,
} from "@/app/actions/v2-operations";
import { businessMoney, requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "تشغيل الفندق | مَدار" };
const field = "field w-full rounded-xl p-3";

export default async function HotelPage() {
  const { workspace, sector } = await requireBusinessWorkspace();
  if (sector.extension !== "hospitality")
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black">هذه الوحدة مخصصة للفنادق</h1>
      </main>
    );
  const id = encodeURIComponent(workspace.id);
  const [
      properties,
      rooms,
      rates,
      reservations,
      stays,
      folios,
      tasks,
      maintenance,
      report,
    ] = await Promise.all([
      supabaseFetch(
        `/rest/v1/hotel_properties?organization_id=eq.${id}&is_active=eq.true&select=id,name,code`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_rooms?organization_id=eq.${id}&select=id,property_id,room_number,room_type,status,capacity&order=room_number`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_rates?organization_id=eq.${id}&is_active=eq.true&select=id,property_id,code,name,room_type,currency,nightly_amount&order=name`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_reservations?organization_id=eq.${id}&select=id,confirmation_number,property_id,room_id,guest_name,check_in_date,check_out_date,status,currency,room_total&order=check_in_date.desc&limit=100`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_stays?organization_id=eq.${id}&select=id,reservation_id,room_id,stay_number,status,checked_in_at&order=checked_in_at.desc&limit=50`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_folios?organization_id=eq.${id}&select=id,stay_id,folio_number,currency,status,total_charges,total_payments&order=folio_number.desc&limit=50`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_housekeeping_tasks?organization_id=eq.${id}&status=in.(PENDING,ASSIGNED,IN_PROGRESS,INSPECTION,BLOCKED)&select=id,room_id,service_date,task_type,status,notes&order=service_date`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_maintenance_requests?organization_id=eq.${id}&status=in.(OPEN,ASSIGNED,IN_PROGRESS)&select=id,room_id,title,priority,status,created_at&order=created_at.desc`,
      ),
      supabaseFetch(
        `/rest/v1/hotel_daily_report?organization_id=eq.${id}&select=*`,
      ).catch(() => []),
    ]),
    stats = report?.[0] || {};
  const roomLabel = (roomId: string | null) =>
    rooms.find((room: { id: string }) => room.id === roomId)?.room_number ||
    "غير معينة";
  return (
    <main className="mx-auto max-w-7xl p-5 py-8">
      <header>
        <p className="font-bold text-emerald-300">Hospitality Extension</p>
        <h1 className="mt-2 text-4xl font-black">
          الحجوزات والإقامة وتشغيل الغرف
        </h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-300">
          الحجز والإقامة وحساب النزيل والتنظيف كيانات فندقية مستقلة، مع تحقق من
          تعارض الغرف والتوفر وإغلاق الحساب.
        </p>
      </header>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["إجمالي الغرف", stats.total_rooms || 0],
          ["المشغولة", stats.occupied_rooms || 0],
          [
            "الإشغال",
            `${Number(stats.occupancy || 0).toLocaleString("ar-SA")}%`,
          ],
          [
            "إيراد الغرف",
            businessMoney(stats.room_revenue || 0, workspace.currency),
          ],
        ].map(([label, value]) => (
          <article key={String(label)} className="md-card p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <strong className="mt-2 block text-2xl">{value}</strong>
          </article>
        ))}
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <V2ActionForm
          action={createHotelRoomRate}
          title="إضافة غرفة وسعر"
          submitLabel="إنشاء الغرفة والسعر"
        >
          <select required name="property_id" className={field}>
            {properties.map((item: { id: string; name: string }) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-3">
            <input
              required
              name="room_number"
              className={field}
              placeholder="رقم الغرفة"
            />
            <input
              required
              name="room_type"
              className={field}
              placeholder="نوع الغرفة"
            />
            <input
              name="capacity"
              type="number"
              min="1"
              defaultValue="2"
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              name="rate_code"
              className={field}
              placeholder="رمز السعر"
            />
            <input
              required
              name="rate_name"
              className={field}
              placeholder="اسم السعر"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              name="currency"
              defaultValue={workspace.currency}
              className={field}
            >
              <option>SAR</option>
              <option>USD</option>
              <option>YER</option>
            </select>
            <input
              required
              name="nightly_amount"
              type="number"
              min="0"
              step="0.01"
              className={field}
              placeholder="سعر الليلة"
            />
          </div>
        </V2ActionForm>
        <V2ActionForm
          action={createHotelReservation}
          title="حجز جديد"
          submitLabel="تأكيد الحجز"
        >
          <select required name="property_id" className={field}>
            {properties.map((item: { id: string; name: string }) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select required name="rate_id" className={field}>
            <option value="">السعر</option>
            {rates.map(
              (item: {
                id: string;
                name: string;
                room_type: string;
                currency: string;
                nightly_amount: number;
              }) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.room_type} ·{" "}
                  {businessMoney(item.nightly_amount, item.currency)}
                </option>
              ),
            )}
          </select>
          <select name="room_id" className={field}>
            <option value="">تعيين لاحقًا</option>
            {rooms
              .filter((room: { status: string }) => room.status === "AVAILABLE")
              .map(
                (room: {
                  id: string;
                  room_number: string;
                  room_type: string;
                }) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} · {room.room_type}
                  </option>
                ),
              )}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              name="guest_name"
              className={field}
              placeholder="اسم النزيل"
            />
            <input name="guest_phone" className={field} placeholder="الجوال" />
          </div>
          <input
            name="guest_email"
            type="email"
            className={field}
            placeholder="البريد"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              name="check_in_date"
              type="date"
              className={field}
            />
            <input
              required
              name="check_out_date"
              type="date"
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="adults"
              type="number"
              min="1"
              defaultValue="1"
              className={field}
            />
            <input
              name="children"
              type="number"
              min="0"
              defaultValue="0"
              className={field}
            />
          </div>
        </V2ActionForm>
      </section>
      <section className="mt-8 max-w-2xl">
        <V2ActionForm
          action={manageHotelMaintenance}
          title="فتح طلب صيانة"
          description="تُحجز الغرفة تلقائيًا للصيانة عند أولوية عالية أو طارئة، ولا تعود للخدمة قبل إغلاق آخر طلب نشط."
          submitLabel="فتح الطلب"
        >
          <select name="room_id" className={field}>
            <option value="">صيانة عامة للمنشأة</option>
            {rooms.map(
              (room: {
                id: string;
                room_number: string;
                room_type: string;
              }) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} · {room.room_type}
                </option>
              ),
            )}
          </select>
          <input
            required
            name="title"
            minLength={2}
            className={field}
            placeholder="عنوان المشكلة"
          />
          <textarea
            name="description"
            rows={3}
            className={field}
            placeholder="وصف المشكلة"
          />
          <select name="priority" className={field}>
            <option value="LOW">منخفضة</option>
            <option value="NORMAL">عادية</option>
            <option value="HIGH">عالية</option>
            <option value="EMERGENCY">طارئة</option>
          </select>
        </V2ActionForm>
      </section>
      <section className="mt-9 grid gap-7 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-black">الوصول والمغادرة</h2>
          <div className="mt-4 grid gap-4">
            {reservations
              .filter((item: { status: string }) => item.status === "CONFIRMED")
              .map(
                (reservation: {
                  id: string;
                  confirmation_number: string;
                  guest_name: string;
                  room_id: string | null;
                  check_in_date: string;
                }) => (
                  <V2ActionForm
                    key={reservation.id}
                    action={checkInHotelReservation}
                    title={`${reservation.confirmation_number} · ${reservation.guest_name}`}
                    description={`وصول ${reservation.check_in_date}`}
                    submitLabel="تسجيل الدخول"
                  >
                    <input
                      type="hidden"
                      name="reservation_id"
                      value={reservation.id}
                    />
                    <select
                      name="room_id"
                      className={field}
                      defaultValue={reservation.room_id || ""}
                    >
                      <option value="">اختر غرفة</option>
                      {rooms
                        .filter(
                          (room: { status: string }) =>
                            room.status === "AVAILABLE",
                        )
                        .map(
                          (room: {
                            id: string;
                            room_number: string;
                            room_type: string;
                          }) => (
                            <option key={room.id} value={room.id}>
                              {room.room_number} · {room.room_type}
                            </option>
                          ),
                        )}
                    </select>
                  </V2ActionForm>
                ),
              )}
            {stays
              .filter((stay: { status: string }) => stay.status === "IN_HOUSE")
              .map(
                (stay: {
                  id: string;
                  stay_number: string;
                  room_id: string;
                }) => {
                  const folio = folios.find(
                    (item: { stay_id: string }) => item.stay_id === stay.id,
                  );
                  return (
                    <V2ActionForm
                      key={stay.id}
                      action={checkOutHotelStay}
                      title={`${stay.stay_number} · غرفة ${roomLabel(stay.room_id)}`}
                      description={
                        folio
                          ? `الرصيد ${businessMoney(Number(folio.total_charges) - Number(folio.total_payments), folio.currency)}`
                          : "حساب مفتوح"
                      }
                      submitLabel="تأكيد المغادرة"
                    >
                      <input type="hidden" name="stay_id" value={stay.id} />
                      <input
                        name="payment_amount"
                        type="number"
                        min="0"
                        step="0.01"
                        className={field}
                        defaultValue={
                          folio
                            ? Math.max(
                                0,
                                Number(folio.total_charges) -
                                  Number(folio.total_payments),
                              )
                            : 0
                        }
                      />
                    </V2ActionForm>
                  );
                },
              )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black">التنظيف والصيانة</h2>
          <div className="mt-4 grid gap-4">
            {tasks.map(
              (task: {
                id: string;
                room_id: string;
                task_type: string;
                status: string;
                service_date: string;
              }) => (
                <V2ActionForm
                  key={task.id}
                  action={updateHousekeepingTask}
                  title={`غرفة ${roomLabel(task.room_id)} · ${task.task_type}`}
                  description={`${task.status} · ${task.service_date}`}
                  submitLabel="تحديث المهمة"
                >
                  <input type="hidden" name="task_id" value={task.id} />
                  <select name="next_status" className={field}>
                    <option value="ASSIGNED">مسندة</option>
                    <option value="IN_PROGRESS">قيد التنفيذ</option>
                    <option value="INSPECTION">فحص</option>
                    <option value="COMPLETED">مكتملة</option>
                    <option value="BLOCKED">متعطلة</option>
                  </select>
                  <input name="notes" className={field} placeholder="ملاحظات" />
                </V2ActionForm>
              ),
            )}
            {maintenance.map(
              (item: {
                id: string;
                room_id: string | null;
                title: string;
                priority: string;
                status: string;
              }) => (
                <V2ActionForm
                  key={item.id}
                  action={manageHotelMaintenance}
                  title={item.title}
                  description={`غرفة ${roomLabel(item.room_id)} · ${item.priority} · ${item.status}`}
                  submitLabel="تحديث الصيانة"
                >
                  <input
                    type="hidden"
                    name="maintenance_request_id"
                    value={item.id}
                  />
                  <select name="next_status" className={field}>
                    <option value="ASSIGNED">مسندة</option>
                    <option value="IN_PROGRESS">قيد التنفيذ</option>
                    <option value="RESOLVED">تم الحل</option>
                    <option value="CLOSED">مغلقة</option>
                    <option value="CANCELLED">ملغاة</option>
                  </select>
                </V2ActionForm>
              ),
            )}
          </div>
        </div>
      </section>
      <section className="mt-9">
        <h2 className="text-2xl font-black">رسوم حساب النزيل</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {folios
            .filter((folio: { status: string }) => folio.status === "OPEN")
            .map(
              (folio: {
                id: string;
                folio_number: string;
                currency: string;
                total_charges: number;
                total_payments: number;
              }) => (
                <V2ActionForm
                  key={folio.id}
                  action={postHotelFolioCharge}
                  title={`${folio.folio_number} · ${businessMoney(folio.total_charges, folio.currency)}`}
                  submitLabel="إضافة الرسم"
                >
                  <input type="hidden" name="folio_id" value={folio.id} />
                  <select name="charge_type" className={field}>
                    <option value="ROOM_SERVICE">خدمة غرف</option>
                    <option value="MINIBAR">ميني بار</option>
                    <option value="LAUNDRY">غسيل</option>
                    <option value="TAX">ضريبة</option>
                    <option value="FEE">رسم</option>
                    <option value="ADJUSTMENT">تسوية</option>
                  </select>
                  <input
                    required
                    name="description"
                    className={field}
                    placeholder="الوصف"
                  />
                  <input
                    required
                    name="amount"
                    type="number"
                    step="0.01"
                    className={field}
                    placeholder="المبلغ"
                  />
                </V2ActionForm>
              ),
            )}
        </div>
      </section>
    </main>
  );
}
