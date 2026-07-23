'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireBusinessWorkspace,numberValue} from '@/src/lib/business';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {required} from '@/src/lib/validation';

const clean=(value:FormDataEntryValue|null)=>String(value||'').trim()||null;

async function runAction(path:string,success:string,fallback:string,work:()=>Promise<void>){
 let errorMessage:string|undefined;
 try{await work()}catch(error){errorMessage=error instanceof Error?error.message:fallback}
 redirect(`${path}?${errorMessage?'error':'success'}=${encodeURIComponent(errorMessage||success)}`);
}

export async function createBusinessProduct(form:FormData){
 return runAction('/workspace/products','تمت إضافة المنتج.','تعذر إضافة المنتج.',async()=>{
  const{user,workspace}=await requireBusinessWorkspace();
  const opening=numberValue(form.get('opening_stock'),'المخزون الافتتاحي');
  const rows=await supabaseFetch('/rest/v1/business_products',{method:'POST',body:JSON.stringify({organization_id:workspace.id,name:required(form.get('name'),'اسم المنتج'),sku:clean(form.get('sku')),description:clean(form.get('description')),category:clean(form.get('category')),cost:numberValue(form.get('cost'),'التكلفة'),price:numberValue(form.get('price'),'السعر'),stock_quantity:0,low_stock_threshold:numberValue(form.get('low_stock_threshold'),'حد التنبيه'),created_by:user.id})});
  const product=rows?.[0];
  if(opening>0&&product?.id)await supabaseFetch('/rest/v1/rpc/adjust_inventory',{method:'POST',body:JSON.stringify({target_product:product.id,quantity_change:opening,adjustment_note:'الرصيد الافتتاحي'})});
  revalidatePath('/workspace/products');revalidatePath('/workspace/inventory');revalidatePath('/workspace');
 });
}

export async function adjustBusinessInventory(form:FormData){
 return runAction('/workspace/inventory','تم تحديث المخزون.','تعذر تحديث المخزون.',async()=>{
  await requireBusinessWorkspace();
  await supabaseFetch('/rest/v1/rpc/adjust_inventory',{method:'POST',body:JSON.stringify({target_product:required(form.get('product_id'),'المنتج'),quantity_change:numberValue(form.get('quantity_change'),'الكمية',{min:-1000000,allowZero:false}),adjustment_note:clean(form.get('note'))})});
  revalidatePath('/workspace/inventory');revalidatePath('/workspace/products');revalidatePath('/workspace');
 });
}

export async function createBusinessCustomer(form:FormData){
 return runAction('/workspace/customers','تمت إضافة العميل.','تعذر إضافة العميل.',async()=>{
  const{user,workspace}=await requireBusinessWorkspace();
  await supabaseFetch('/rest/v1/business_customers',{method:'POST',body:JSON.stringify({organization_id:workspace.id,name:required(form.get('name'),'اسم العميل'),phone:clean(form.get('phone')),email:clean(form.get('email')),address:clean(form.get('address')),status:String(form.get('status')||'active'),notes:clean(form.get('notes')),created_by:user.id})});
  revalidatePath('/workspace/customers');revalidatePath('/workspace');
 });
}

export async function createBusinessSupplier(form:FormData){
 return runAction('/workspace/suppliers','تمت إضافة المورد.','تعذر إضافة المورد.',async()=>{
  const{user,workspace}=await requireBusinessWorkspace();
  await supabaseFetch('/rest/v1/business_suppliers',{method:'POST',body:JSON.stringify({organization_id:workspace.id,name:required(form.get('name'),'اسم المورد'),contact_name:clean(form.get('contact_name')),phone:clean(form.get('phone')),email:clean(form.get('email')),address:clean(form.get('address')),notes:clean(form.get('notes')),balance_due:numberValue(form.get('balance_due'),'الرصيد المستحق'),created_by:user.id})});
  revalidatePath('/workspace/suppliers');
 });
}

export async function createBusinessExpense(form:FormData){
 return runAction('/workspace/expenses','تم تسجيل المصروف.','تعذر تسجيل المصروف.',async()=>{
  const{user,workspace}=await requireBusinessWorkspace();
  await supabaseFetch('/rest/v1/business_expenses',{method:'POST',body:JSON.stringify({organization_id:workspace.id,supplier_id:clean(form.get('supplier_id')),title:required(form.get('title'),'المصروف'),category:clean(form.get('category'))||'other',amount:numberValue(form.get('amount'),'المبلغ',{allowZero:false}),currency:workspace.currency,incurred_at:required(form.get('incurred_at'),'التاريخ'),payment_status:String(form.get('payment_status')||'paid'),notes:clean(form.get('notes')),created_by:user.id})});
  revalidatePath('/workspace/expenses');revalidatePath('/workspace');
 });
}

export async function recordBusinessSale(form:FormData){
 return runAction('/workspace/sales','تم تسجيل عملية البيع وتحديث المخزون.','تعذر تسجيل البيع.',async()=>{
  const{workspace}=await requireBusinessWorkspace();
  const productId=required(form.get('product_id'),'المنتج');
  const quantity=numberValue(form.get('quantity'),'الكمية',{allowZero:false});
  await supabaseFetch('/rest/v1/rpc/record_business_sale',{method:'POST',body:JSON.stringify({target_organization:workspace.id,sale_customer:clean(form.get('customer_id')),items:[{product_id:productId,quantity}],sale_discount:numberValue(form.get('discount'),'الخصم'),sale_payment_status:String(form.get('payment_status')||'paid'),sale_notes:clean(form.get('notes'))})});
  revalidatePath('/workspace/sales');revalidatePath('/workspace/products');revalidatePath('/workspace/inventory');revalidatePath('/workspace/customers');revalidatePath('/workspace');
 });
}

export async function createBusinessTask(form:FormData){
 return runAction('/workspace/tasks','تمت إضافة المهمة.','تعذر إضافة المهمة.',async()=>{
  const{user,workspace}=await requireBusinessWorkspace();
  await supabaseFetch('/rest/v1/business_tasks',{method:'POST',body:JSON.stringify({organization_id:workspace.id,title:required(form.get('title'),'المهمة'),description:clean(form.get('description')),assigned_to:clean(form.get('assigned_to')),priority:String(form.get('priority')||'medium'),due_at:clean(form.get('due_at')),created_by:user.id})});
  revalidatePath('/workspace/tasks');revalidatePath('/workspace');
 });
}

export async function updateBusinessTaskStatus(form:FormData){
 return runAction('/workspace/tasks','تم تحديث المهمة.','تعذر تحديث المهمة.',async()=>{
  const{workspace}=await requireBusinessWorkspace();
  const id=required(form.get('id'),'المهمة'),status=String(form.get('status'));
  if(!['todo','in_progress','done','cancelled'].includes(status))throw new Error('حالة المهمة غير صالحة.');
  await supabaseFetch(`/rest/v1/business_tasks?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(workspace.id)}`,{method:'PATCH',body:JSON.stringify({status})});
  revalidatePath('/workspace/tasks');revalidatePath('/workspace');
 });
}
