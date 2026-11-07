import {describe,it,expect} from 'vitest';
import {csvCell,directoryCsv} from './DirectoryDownload';
describe('directory CSV',()=>{
 it('quotes values and neutralizes spreadsheet formulas',()=>{
  expect(csvCell('=SUM(1,2)')).toBe('"\'=SUM(1,2)"');
  expect(csvCell('  @value')).toBe('"\'  @value"');
  expect(csvCell('A "name"')).toBe('"A ""name"""');
 });
 it('exports only the selected directory fields',()=>{
  const csv=directoryCsv('students',[{fullName:'Test',className:'Class A',password:'do not export'}]);
  expect(csv).toContain('Class A');expect(csv).not.toContain('do not export');
 });
});
