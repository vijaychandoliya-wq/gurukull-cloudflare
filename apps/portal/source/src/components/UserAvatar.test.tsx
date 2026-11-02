// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect} from 'vitest';
import {AuthenticatedAvatar,UserAvatar} from './UserAvatar';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
describe('Photo proportions',()=>{
 it('uses a rectangular proportional crop for ID photos while retaining circular profile photos',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const photo='data:image/png;base64,iVBORw0KGgo=';
  try{
   await act(async()=>root.render(<AuthenticatedAvatar src={photo} name="Photo" portrait/>));
   let image=host.querySelector('img')!;expect(image).toBeTruthy();expect(image.style.objectFit).toBe('cover');expect(image.style.width).toBe('100%');expect(image.style.height).toBe('100%');expect(image.style.borderRadius).toBe('0px');
   await act(async()=>root.render(<UserAvatar src={photo} name="Photo"/>));
   image=host.querySelector('img')!;expect(image.style.borderRadius).toBe('50%');expect(image.style.objectPosition).toBe('center');
  }finally{await act(async()=>root.unmount());host.remove();}
 });
});
