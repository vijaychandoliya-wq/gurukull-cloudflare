import {useEffect} from 'react';
import {Tabs, type TabsProps} from 'antd';
import {useSearchParams} from 'react-router-dom';
/** Peer views are deep-linkable. Active forms stay mounted so switching tabs retains input. */
export function ModuleTabs({activeKey,defaultActiveKey,onChange,items,...props}:TabsProps){
  const [query,setQuery]=useSearchParams();
  const requested=query.get('tab'), valid=items?.some(item=>item?.key===requested);
  const selected=valid?requested!:activeKey||defaultActiveKey||items?.[0]?.key;
  useEffect(()=>{if(activeKey!==undefined&&selected&&activeKey!==selected)onChange?.(selected);},[selected,activeKey,onChange]);
  return <Tabs {...props} className={['gk-module-tabs',props.className].filter(Boolean).join(' ')} activeKey={selected} items={items} onChange={key=>{setQuery(current=>{const next=new URLSearchParams(current);next.set('tab',key);return next;});onChange?.(key);}}/>;
}
