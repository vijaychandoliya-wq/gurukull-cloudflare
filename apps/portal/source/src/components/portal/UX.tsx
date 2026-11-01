import {useEffect,useState} from 'react';
import {Alert,App,Button,Collapse,InputNumber,Typography,type InputNumberProps} from 'antd';
import {currencyDigits,majorToMinor,minorToMajor} from '../../ux/format';
import {useNavigate} from 'react-router-dom';

export function ContextHelp({text}:{text:string}){return <Collapse ghost size="small" className="gk-context-help" items={[{key:'help',label:'How this works',children:<Typography.Paragraph>{text}</Typography.Paragraph>}]}/>;}

export function MoneyInput({currency,value,onChange,min=0,max,...props}:Omit<InputNumberProps<string>,'value'|'onChange'|'min'|'max'> & {currency?:string|null;value?:number|null;onChange?:(v:number|null)=>void;min?:number;max?:number}){
 const [problem,setProblem]=useState('');
 if(!currency)return <Alert type="warning" message="Save the school currency in Settings before entering amounts."/>;
 let digits:number;try{digits=currencyDigits(currency);}catch{return <Alert type="error" message="The school currency is invalid. Check Settings."/>;}
 return <><InputNumber {...props} stringMode value={value==null?null:minorToMajor(value,currency)} min={minorToMajor(min,currency)} max={max==null?undefined:minorToMajor(max,currency)} precision={digits} step={digits?String(1/10**digits):'1'} addonBefore={currency} disabled={props.disabled} style={{width:'100%',...props.style}} onChange={text=>{try{const minor=majorToMinor(text==null?'':String(text),currency);setProblem('');onChange?.(minor);}catch(e){setProblem((e as Error).message);}}}/>{problem&&<Typography.Text type="danger" role="alert">{problem}</Typography.Text>}</>;
}

/** Warn for browser reload/close. Route and dialog transitions have explicit guards. */
export function useDirtyForm(dirty:boolean){
 const {modal}=App.useApp();
 const navigate=useNavigate();
 useEffect(()=>{
  if(!dirty)return;
  const confirm=(proceed:()=>void)=>modal.confirm({title:'Leave without saving?',content:'Your changes have not been saved. Stay here to continue editing, or discard them.',okText:'Discard and leave',cancelText:'Keep editing',okButtonProps:{danger:true},onOk:proceed});
  const route=(event:Event)=>{event.preventDefault();confirm((event as CustomEvent<{proceed:()=>void}>).detail.proceed);};
  const link=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey)return;const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;const url=new URL(anchor.href);if(url.origin!==location.origin||url.pathname===location.pathname)return;event.preventDefault();event.stopImmediatePropagation();confirm(()=>navigate(url.pathname+url.search+url.hash));};
  window.addEventListener('gk-before-navigate',route);document.addEventListener('click',link,true);
  return()=>{window.removeEventListener('gk-before-navigate',route);document.removeEventListener('click',link,true);};
 },[dirty,modal,navigate]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};if(dirty)window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 return (close:()=>void)=>{if(!dirty){close();return;}modal.confirm({title:'Discard unsaved changes?',content:'Your changes have not been saved. Stay here to continue editing, or discard them.',okText:'Discard changes',cancelText:'Keep editing',okButtonProps:{danger:true},onOk:close});};
}

export function ErrorSummary({message,fields=[],onField}:{message:string;fields?:{name:string;label:string;errors:string[]}[];onField?:(name:string)=>void}){
 return <Alert type="error" showIcon role="alert" className="gk-form-error" message={message} description={fields.length?<ul className="gk-error-links">{fields.map(field=><li key={field.name}><Button type="link" onClick={()=>onField?.(field.name)}>{field.label}: {field.errors.join(' ')}</Button></li>)}</ul>:undefined}/>;
}
