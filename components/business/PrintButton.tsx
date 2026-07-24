'use client';

export default function PrintButton(){return <button onClick={()=>window.print()} className="print:hidden rounded-xl bg-slate-950 px-5 py-3 font-black text-white">طباعة أو حفظ PDF</button>}
