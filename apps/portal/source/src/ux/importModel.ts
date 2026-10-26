export type ImportRow=Record<string,string>;
export type ImportProblem={sheet:string;row:number;message:string};
export const importSheets=['classes','sections','teachers','students','parents'] as const;
export function validateImport(rows:Record<string,ImportRow[]>):ImportProblem[]{
 const errors:ImportProblem[]=[];
 const required:Record<string,string[]>={classes:['name'],sections:['name'],teachers:['name','email','mobile','designation','jobType','joiningDate'],students:['name','registrationNumber','rollNumber','className','sectionName','enrollmentDate'],parents:['firstName','mobile','linkedStudentAdmissions','relationship']};
 for(const sheet of importSheets){const seen=new Map<string,number>();(rows[sheet]||[]).forEach((r,i)=>{const row=i+2,add=(message:string)=>errors.push({sheet,row,message});
  for(const field of required[sheet])if(!r[field]?.trim())add(`${field} is required.`);
  if(sheet==='sections'&&!r.classCode&&!r.className)add('Choose a class code or class name.');
  if(sheet==='teachers'&&r.jobType&&!['full_time','part_time'].includes(r.jobType))add('Job type must be full_time or part_time. Contract status is not a working-hours category.');
  if(r.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))add('Enter a complete email address.');
  if(r.mobile&&!/^\+?\d{7,15}$/.test(r.mobile))add('Mobile must contain 7–15 digits with an optional leading +.');
  for(const f of ['joiningDate','enrollmentDate'])if(r[f]&&(!/^\d{4}-\d{2}-\d{2}$/.test(r[f])||Number.isNaN(Date.parse(r[f]))||new Date(r[f]).toISOString().slice(0,10)!==r[f]))add(`${f} must be a valid YYYY-MM-DD date.`);
  if(sheet==='parents'&&r.relationship&&!['father','mother','guardian'].includes(r.relationship))add('Relationship must be father, mother or guardian.');
  if(r.annualIncome&&!/^\d+$/.test(r.annualIncome))add('Annual income must be a whole number.');
  const ids=sheet==='teachers'?['email','mobile','employeeId']:sheet==='students'?['registrationNumber']:sheet==='parents'?['mobile']:sheet==='classes'?['code','name']:[];
  for(const f of ids)if(r[f]){const key=f+':'+r[f].trim().toLowerCase();if(seen.has(key))add(`${f} repeats row ${seen.get(key)}. Resolve the duplicate before importing.`);else seen.set(key,row);}
 });}return errors;
}
/** Same row, school and year share one command even after selecting the file again. */
export function importIdentity(scope:string,sheet:string,row:ImportRow):string{return JSON.stringify([scope,sheet,Object.keys(row).sort().map(k=>[k,row[k]])]);}
