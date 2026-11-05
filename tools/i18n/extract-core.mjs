// Extract only checked-in interface copy. Never read a database or school records.
import ts from 'typescript';
import fs from 'node:fs';
const base='apps/portal/source/src/i18n/';
const catalog={};
function pairs(object){return object.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.text,p.initializer]);}
function read(file){return ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);}
function literalObject(file,name){let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText()===name){let v=n.initializer;while(v&&ts.isAsExpression(v))v=v.expression;found=v;}ts.forEachChild(n,visit);}visit(read(file));if(!found)throw Error(`Missing ${name}`);return found;}
for(const [key] of pairs(literalObject(base+'dashboard.ts','en')))catalog[key]=key;
const messages=literalObject(base+'messages.ts','messages');
for(const [,value] of pairs(pairs(messages).find(([key])=>key==='en')[1]))catalog[value.text]=value.text;
for(const [key] of pairs(literalObject(base+'navigation.ts','hindiNavigation')))catalog[key]=key;
function assignments(n){if(ts.isCallExpression(n)&&n.expression.getText()==='Object.assign'&&ts.isObjectLiteralExpression(n.arguments[1]))for(const [key] of pairs(n.arguments[1]))catalog[key]=key;ts.forEachChild(n,assignments);}
assignments(read(base+'navigation.ts'));
function english(n){if(ts.isStringLiteral(n))catalog[n.text]=n.text;else ts.forEachChild(n,english);}
english(literalObject(base+'en.ts','en'));
const out=process.argv[2];if(!out)throw Error('Output path required');
fs.writeFileSync(out,JSON.stringify(catalog,null,2)+'\n');
console.log(`${Object.keys(catalog).length} interface phrases extracted`);
