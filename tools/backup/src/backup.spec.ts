import { describe,it,expect } from 'vitest';
import { D1BackupEngine } from './backup.js';
import { amountToPaise } from '../../import/src/etl.js';

describe('Recovery integrity and exact monetary transformations',()=>{
 const engine=new D1BackupEngine();
 it('verifies an explicitly empty tenant package without inventing records',()=>{
  const tables={classes:[],students:[],fee_payments:[]};const manifest=engine.generateTenantManifest('BOUNDARY','boundary-school',tables);expect(engine.verifyBackup(manifest,tables)).toBe(true);expect(manifest.totalEntities).toBe(0);
 });
 it('detects tampered school identity, schema, total and export time',()=>{
  const tables={students:[]};const m=engine.generateTenantManifest('BOUNDARY','boundary-school',tables);
  for(const change of [{schoolId:'other-school'},{schoolCode:'OTHER'},{schemaVersion:2},{totalEntities:1},{exportedAt:'2000-01-01'}])expect(engine.verifyBackup({...m,...change},tables)).toBe(false);
 });
 it('detects removed, added and renamed empty tables',()=>{
  const m=engine.generateTenantManifest('BOUNDARY','boundary-school',{students:[]});const variants:Record<string,Record<string,unknown>[]>[]=[{},{students:[],classes:[]},{teachers:[]}];for(const tables of variants)expect(engine.verifyBackup(m,tables)).toBe(false);
 });
 it.each([['0',0],['0.01',1],['12.30',1230],['90071992547409.91',Number.MAX_SAFE_INTEGER]])('converts decimal %s exactly', (input,expected)=>{expect(amountToPaise(input)).toBe(expected);});
 it.each(['1.005','1e2','12.00junk','-1','NaN','Infinity','90071992547409.92'])('rejects invalid or ambiguous money %s',input=>{expect(()=>amountToPaise(input)).toThrow();});
});
