import {WorkflowPage,type WorkflowSpec} from './SchoolWorkflowPages';
const spec:WorkflowSpec={path:'discipline',title:'Student conduct',addLabel:'Add conduct record',archive:true,columns:['studentName','admissionNo','className','teacherName','type','incidentDate','incidentTime','incidentDetail','response','actionTaken','visibleToParents','version'],notice:'Record actual incidents and actions. Dates and times use the school’s timezone. Parent visibility makes the record available in the linked child’s portal; it does not send a push notification. PDF attachments are not yet included. Student and class remain fixed after saving.',fields:[
 {name:'studentId',label:'Actual enrolled student',required:true,type:'select',options:'students',immutable:true},
 {name:'sectionId',label:'Actual class and section',required:true,type:'select',options:'sections',immutable:true},
 {name:'teacherId',label:'Reporting teacher',required:true,type:'select',options:'teachers'},
 {name:'type',label:'Record type',required:true,type:'select',options:[{value:'discipline',label:'Discipline'},{value:'performance',label:'Performance'},{value:'others',label:'Other'}]},
 {name:'incidentDate',label:'Actual incident date',required:true,type:'date'},
 {name:'incidentTime',label:'Incident time in school timezone (HH:mm)',required:true,max:5},
 {name:'incidentDetail',label:'Incident details',required:true,type:'long',max:3000},
 {name:'response',label:'Response / action details',type:'long',max:255},
 {name:'actionTaken',label:'Action taken?',required:true,type:'boolean'},
 {name:'visibleToParents',label:'Make visible to the student and linked parents?',required:true,type:'boolean'}
]};
export const DisciplineManagementPage=()=> <WorkflowPage spec={spec}/>;
