import {fail} from './security.js';
import type {Env} from './context.js';

export type WhatsAppDelivery={status:'sent';messageId:string|null};

/**
 * Send the approved WhatsApp password template. The template must contain
 * four body variables in this order: school name, login mobile, password and
 * login URL. The access token is a Worker secret and is never returned or
 * logged.
 */
export async function sendWhatsAppPassword(env:Env,input:{schoolName:string;schoolCode:string;mobile:string;password:string;loginUrl:string}):Promise<WhatsAppDelivery>{
  const base=(env.WHATSAPP_GRAPH_API_URL||'https://graph.facebook.com/v20.0').replace(/\/$/,'');
  if(!env.WHATSAPP_ACCESS_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID||!env.WHATSAPP_PASSWORD_TEMPLATE)fail(503,'WHATSAPP_NOT_CONFIGURED','WhatsApp delivery is not configured. Add the approved template and Cloud API secret before sending.');
  if(!/^\+?[0-9]{7,15}$/.test(input.mobile))fail(409,'MEMBER_CONTACT_REQUIRED');
  const country=(env.WHATSAPP_DEFAULT_COUNTRY_CODE||'91').replace(/\D/g,'');
  const destination=input.mobile.startsWith('+')?input.mobile:`+${country}${input.mobile}`;
  const response=await fetch(`${base}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:destination,type:'template',template:{name:env.WHATSAPP_PASSWORD_TEMPLATE,language:{code:env.WHATSAPP_TEMPLATE_LANGUAGE||'en_US'},components:[{type:'body',parameters:[{type:'text',text:input.schoolName},{type:'text',text:input.mobile},{type:'text',text:input.password},{type:'text',text:input.loginUrl}]}]}})});
  if(!response.ok){await response.text();fail(502,'WHATSAPP_DELIVERY_FAILED','WhatsApp could not accept the message. The account password was generated; retry delivery from the administrator page.');}
  const body=await response.json().catch(()=>({})) as {messages?:Array<{id?:string}>};
  return {status:'sent',messageId:body.messages?.[0]?.id||null};
}
