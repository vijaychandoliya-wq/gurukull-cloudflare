import {it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {deliveryHealthQuery} from './monitor-query.mjs';
it('alerts for real held messages and delayed work while ignoring explicit owner cancellation',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE outbox(status TEXT,last_error TEXT,created_at INTEGER)');
  const row=db.prepare('INSERT INTO outbox VALUES(?,?,unixepoch()-?)');
  row.run('dead_letter','Credential replaced by account owner',10000);
  expect(db.prepare(deliveryHealthQuery).get()).toMatchObject({held:0,delayed:0});
  row.run('dead_letter','PROVIDER_ACCEPTANCE_UNKNOWN',10000);
  row.run('pending',null,1000);
  row.run('pending',null,10);
  expect(db.prepare(deliveryHealthQuery).get()).toMatchObject({held:1,delayed:1});
 }finally{db.close();}
});
