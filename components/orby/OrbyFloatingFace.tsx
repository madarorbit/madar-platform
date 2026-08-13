'use client';

import Image from 'next/image';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';

type Position={x:number;y:number};
const SIZE=58,MARGIN=14,STORAGE='madar-orby-floating-position-v1';
const hidden=(path:string)=>path.startsWith('/orby')||path.startsWith('/admin')||path.startsWith('/login')||path.startsWith('/register')||path.startsWith('/forgot-password')||path.startsWith('/reset-password')||path.startsWith('/auth/');
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export default function OrbyFloatingFace(){
 const path=usePathname(),router=useRouter(),[position,setPosition]=useState<Position|null>(null),[dragging,setDragging]=useState(false),pointer=useRef<{id:number;startX:number;startY:number;originX:number;originY:number;started:number;moved:boolean}|null>(null);
 useEffect(()=>{
  const resolveInitial=()=>{const saved=localStorage.getItem(STORAGE);let y=window.innerHeight-SIZE-110,side:'left'|'right'='right';try{const parsed=saved?JSON.parse(saved):null;if(parsed?.side==='left'||parsed?.side==='right')side=parsed.side;if(typeof parsed?.y==='number')y=parsed.y;}catch{}const x=side==='left'?MARGIN:window.innerWidth-SIZE-MARGIN;setPosition({x,y:clamp(y,MARGIN,window.innerHeight-SIZE-MARGIN)});};
  const frame=requestAnimationFrame(resolveInitial);
  const resize=()=>setPosition(current=>current?{x:current.x<window.innerWidth/2?MARGIN:window.innerWidth-SIZE-MARGIN,y:clamp(current.y,MARGIN,window.innerHeight-SIZE-MARGIN)}:current);
  window.addEventListener('resize',resize);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
 },[]);
 if(!position||hidden(path))return null;
 function down(event:React.PointerEvent<HTMLButtonElement>){event.currentTarget.setPointerCapture(event.pointerId);pointer.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,originX:position!.x,originY:position!.y,started:Date.now(),moved:false};}
 function move(event:React.PointerEvent<HTMLButtonElement>){const state=pointer.current;if(!state||state.id!==event.pointerId)return;const dx=event.clientX-state.startX,dy=event.clientY-state.startY,dist=Math.hypot(dx,dy),longPress=Date.now()-state.started>160;if(dist>6)state.moved=true;if(!state.moved&&!longPress)return;if(dist<3)return;setDragging(true);setPosition({x:clamp(state.originX+dx,MARGIN,window.innerWidth-SIZE-MARGIN),y:clamp(state.originY+dy,MARGIN,window.innerHeight-SIZE-MARGIN)});}
 function end(event:React.PointerEvent<HTMLButtonElement>){const state=pointer.current;if(!state||state.id!==event.pointerId)return;pointer.current=null;try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{}if(state.moved||dragging){const y=clamp(position!.y,MARGIN,window.innerHeight-SIZE-MARGIN),side=position!.x+SIZE/2<window.innerWidth/2?'left':'right',x=side==='left'?MARGIN:window.innerWidth-SIZE-MARGIN;setPosition({x,y});localStorage.setItem(STORAGE,JSON.stringify({side,y}));setDragging(false);return;}const destination=path.startsWith('/retail/workspace')?'/retail/workspace/orby':path.startsWith('/workspace')?'/workspace/orby':'/orby';router.push(destination);}
 return <button type="button" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{pointer.current=null;setDragging(false);}} className={`md-orby-floating ${dragging?'is-dragging':''}`} aria-label="فتح ORBY" title="ORBY" style={{left:position.x,top:position.y,width:SIZE,height:SIZE}}><Image src="/brand/orby-assistant.svg" width={44} height={44} alt="" draggable={false}/></button>;
}
