export const bankTransfer = {
  bankName: 'بنك القطيبي',
  accountNumber: '488119337',
  reviewStatus: 'PAYMENT_UNDER_REVIEW',
  temporaryAccountNotice:
    'يُستخدم هذا الحساب مؤقتاً لاستقبال التحويلات إلى حين اعتماد الحساب التجاري الرسمي باسم مَدار. تُراجع كل عملية تحويل يدوياً قبل التسليم.',
} as const;

export type OrderStatus = 'PENDING_PAYMENT' | 'PAYMENT_UNDER_REVIEW' | 'PAID' | 'PAYMENT_REJECTED' | 'FULFILLED' | 'CANCELLED';

export function whatsappOrderMessage(input: { name: string; orderNumber: string; items: string; total: string; status: OrderStatus }) {
  return `مرحباً مَدار، أنا ${input.name}. رقم طلبي: ${input.orderNumber}. المحتويات: ${input.items}. الإجمالي: ${input.total}. حالة الدفع: ${input.status}.`;
}
