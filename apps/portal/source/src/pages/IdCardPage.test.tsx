// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {IdCardPage} from './IdCardPage';

vi.mock('../components/UserAvatar',()=>({AuthenticatedAvatar:()=>null}));
vi.mock('../services/api',()=>({API:{idCardOptionsApi:'/options',idCardStudentsApi:'/students',teacherIdCardStudentsApi:'/teachers',staffIdCardStudentsApi:'/staff'},apiClient:{get:vi.fn(async(path:string)=>path==='/options'?{data:{data:{school:{name:'School',address:null,academicYear:null},classes:[]}}}:{data:{data:[{id:'1',fullName:'Student',bloodGroup:null,readyToPrint:false,missingFields:['bloodGroup']}]}})}}));
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});});
afterEach(()=>{document.body.innerHTML='';});
it('allows printing a card with missing blood group and school details',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const print=vi.spyOn(window,'print').mockImplementation(()=>{});
 try{await act(async()=>{root.render(<IdCardPage/>);});const preview=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Preview & print'))!;await act(async()=>preview.click());const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Print 1 card(s)'))!;expect(button.disabled).toBe(false);expect(document.body.textContent).toContain('Some card details are missing');await act(async()=>button.click());expect(print).toHaveBeenCalledOnce();}finally{await act(async()=>root.unmount());print.mockRestore();}
});
