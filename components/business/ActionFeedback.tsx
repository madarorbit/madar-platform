export default function ActionFeedback({success,error}:{success?:string;error?:string}){
 if(!success&&!error)return null;
 return <p role={error?'alert':'status'} className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${error?'border-red-400/20 bg-red-400/10 text-red-100':'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'}`}>{error||success}</p>;
}
