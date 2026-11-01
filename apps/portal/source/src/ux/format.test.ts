import {describe,it,expect} from 'vitest';
import {majorToMinor,minorToMajor,money,humanize,displayValue} from './format';
describe('school money presentation boundary',()=>{
 it('stores rupee decimals exactly as paise',()=>{expect(majorToMinor('1250.50','INR')).toBe(125050);expect(majorToMinor('0.29','INR')).toBe(29);expect(minorToMajor(29,'INR')).toBe('0.29');expect(minorToMajor(-29,'INR')).toBe('-0.29');});
 it('respects zero and three decimal currencies',()=>{expect(majorToMinor('1250','JPY')).toBe(1250);expect(()=>majorToMinor('1.2','JPY')).toThrow();expect(majorToMinor('1.005','KWD')).toBe(1005);});
 it('rejects ambiguous/unsafe amounts instead of rounding',()=>{for(const v of ['1,000','-1','1e5','12.345','Infinity'])expect(()=>majorToMinor(v,'INR')).toThrow();expect(()=>majorToMinor('9007199254740992','INR')).toThrow();expect(majorToMinor('','INR')).toBeNull();});
 it('does not turn missing data into zero',()=>{expect(money(null,'INR')).toBe('—');expect(money(0,'INR')).toContain('0.00');expect(money(100,null)).toBe('Currency setup required');});
});
describe('human record labels',()=>{it('formats enums, amounts and dates',()=>{expect(humanize('amountMinor')).toBe('Amount');expect(displayValue('jobType','part_time')).toBe('Part time');expect(displayValue('dateOfBirth','2000-01-02')).toContain('Jan');expect(displayValue('status',null)).toBe('Not supplied');});});
