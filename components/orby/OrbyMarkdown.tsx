'use client';

import {useState, type ReactNode} from 'react';
import {IconButton} from '@/components/ui/Enterprise';
import {Icon} from '@/components/ui/Icons';

const safeHref=(value:string)=>{
 try{
  const url=new URL(value,'https://madar.local');
  return ['http:','https:','mailto:'].includes(url.protocol)?value:null;
 }catch{return null;}
};

function Inline({text}:{text:string}){
 const parts=text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
 return <>{parts.map((part,index)=>{
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={index}>{part.slice(2,-2)}</strong>;
  if(part.startsWith('`')&&part.endsWith('`'))return <code key={index} dir="ltr" className="md-orby-inline-code">{part.slice(1,-1)}</code>;
  const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if(link){const href=safeHref(link[2]);return href?<a key={index} href={href} target={href.startsWith('http')?'_blank':undefined} rel={href.startsWith('http')?'noreferrer':undefined}>{link[1]}</a>:<span key={index}>{link[1]}</span>;}
  return part;
 })}</>;
}

function CodeBlock({code,language}:{code:string;language:string}){
 const[copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(code);setCopied(true);window.setTimeout(()=>setCopied(false),1600);}catch{/* Clipboard permission can be denied without affecting the response. */}}
 return <figure className="md-orby-code">
  <figcaption><span>{language||'نص'}</span><IconButton label={copied?'تم نسخ الكود':'نسخ الكود'} onClick={()=>void copy()}><Icon name={copied?'check':'copy'} className="h-4 w-4"/></IconButton></figcaption>
  <pre dir="ltr" className="md-orby-code-block"><code>{code}</code></pre>
 </figure>;
}

const tableDivider=(line:string)=>line.split('|').filter(Boolean).every(cell=>/^\s*:?-{3,}:?\s*$/.test(cell));
const tableCells=(line:string)=>line.replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());

function TextBlocks({text}:{text:string}){
 const lines=text.split('\n'),blocks:ReactNode[]=[];
 let index=0;
 while(index<lines.length){
  const line=lines[index],clean=line.trim();
  if(!clean){index+=1;continue;}
  const heading=clean.match(/^(#{1,4})\s+(.+)$/);
  if(heading){const level=Math.min(heading[1].length+1,4),Tag=`h${level}` as 'h2'|'h3'|'h4';blocks.push(<Tag key={`h-${index}`}><Inline text={heading[2]}/></Tag>);index+=1;continue;}
  if(line.includes('|')&&lines[index+1]&&tableDivider(lines[index+1])){
   const headers=tableCells(line),rows:string[][]=[];index+=2;
   while(index<lines.length&&lines[index].includes('|')&&lines[index].trim()){rows.push(tableCells(lines[index]));index+=1;}
   blocks.push(<div className="md-orby-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell,cellIndex)=><th key={cellIndex} scope="col"><Inline text={cell}/></th>)}</tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={rowIndex}>{headers.map((_,cellIndex)=><td key={cellIndex}><Inline text={row[cellIndex]||''}/></td>)}</tr>)}</tbody></table></div>);continue;
  }
  if(/^>\s?/.test(clean)){
   const quote:string[]=[];while(index<lines.length&&/^>\s?/.test(lines[index].trim())){quote.push(lines[index].trim().replace(/^>\s?/,''));index+=1;}
   blocks.push(<blockquote key={`quote-${index}`}>{quote.map((item,itemIndex)=><span key={itemIndex}><Inline text={item}/></span>)}</blockquote>);continue;
  }
  if(/^[-*•]\s+/.test(clean)){
   const items:string[]=[];while(index<lines.length&&/^[-*•]\s+/.test(lines[index].trim())){items.push(lines[index].trim().replace(/^[-*•]\s+/,''));index+=1;}
   blocks.push(<ul key={`ul-${index}`}>{items.map((item,itemIndex)=><li key={itemIndex}><Inline text={item}/></li>)}</ul>);continue;
  }
  if(/^\d+[.)]\s+/.test(clean)){
   const items:string[]=[];while(index<lines.length&&/^\d+[.)]\s+/.test(lines[index].trim())){items.push(lines[index].trim().replace(/^\d+[.)]\s+/,''));index+=1;}
   blocks.push(<ol key={`ol-${index}`}>{items.map((item,itemIndex)=><li key={itemIndex}><Inline text={item}/></li>)}</ol>);continue;
  }
  const paragraph:string[]=[];
  while(index<lines.length&&lines[index].trim()&&!/^(#{1,4}\s+|>\s?|[-*•]\s+|\d+[.)]\s+)/.test(lines[index].trim())&&!(lines[index].includes('|')&&lines[index+1]&&tableDivider(lines[index+1]))){paragraph.push(lines[index]);index+=1;}
  blocks.push(<p key={`p-${index}`}>{paragraph.map((item,itemIndex)=><span key={itemIndex}><Inline text={item}/>{itemIndex<paragraph.length-1?<br/>:null}</span>)}</p>);
 }
 return <>{blocks}</>;
}

export default function OrbyMarkdown({content}:{content:string}){
 const blocks:ReactNode[]=[];let cursor=0;const fence=/```([^\n`]*)\n?([\s\S]*?)```/g;let match:RegExpExecArray|null;
 while((match=fence.exec(content))){
  if(match.index>cursor)blocks.push(<TextBlocks key={`text-${cursor}`} text={content.slice(cursor,match.index)}/>);
  blocks.push(<CodeBlock key={`code-${match.index}`} language={match[1].trim()} code={match[2].replace(/\n$/,'')}/>);cursor=fence.lastIndex;
 }
 if(cursor<content.length)blocks.push(<TextBlocks key={`text-${cursor}`} text={content.slice(cursor)}/>);
 return <div className="md-orby-markdown">{blocks}</div>;
}
