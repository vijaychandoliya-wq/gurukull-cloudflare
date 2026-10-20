import React from 'react';
import {PersonFormDrawer} from './PersonFormDrawer';
export const TeacherFormDrawer:React.FC<{open:boolean;mode:'create'|'edit';teacherId?:string|number|null;onClose:()=>void;onSaved:()=>void}> = ({open,mode,teacherId,...rest})=><PersonFormDrawer open={open} kind="teachers" id={mode==='edit'?teacherId:null} {...rest}/>;
