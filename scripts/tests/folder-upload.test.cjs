const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../../apps/web/node_modules/typescript');
const source = fs.readFileSync(require('node:path').join(__dirname,'../../apps/web/src/folder-upload.ts'),'utf8');
const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};new Function('exports',output)(api);
const file=name=>({name});
const entry=name=>({isFile:true,isDirectory:false,file:resolve=>resolve(file(name))});
function directory(batches){return {isFile:false,isDirectory:true,createReader(){let index=0;return {readEntries(resolve){resolve(batches[index++]||[]);}};}};}
const transfer=root=>({items:[{kind:'file',webkitGetAsEntry:()=>root,getAsFile:()=>null}],files:[]});
test('nested directories include every readEntries batch',async()=>{
 const tree=directory([[entry('first.pdf')],[directory([[entry('nested.md')],[entry('last.txt')]])]]);
 assert.deepEqual((await api.droppedFiles(transfer(tree))).files.map(f=>f.name),['first.pdf','nested.md','last.txt']);
});
test('file-list fallback works when entries are unavailable',async()=>{
 assert.deepEqual((await api.droppedFiles({items:[],files:[file('note.pdf')]})).files.map(f=>f.name),['note.pdf']);
});
test('unreadable folders reject and empty folders resolve',async()=>{
 const result=await api.droppedFiles(transfer({isDirectory:true,createReader:()=>({readEntries:(resolve,reject)=>reject(new Error('Denied'))})})); assert.equal(result.errors.length,1);
 assert.deepEqual((await api.droppedFiles(transfer(directory([])))).files,[]);
});
test('only supported note extensions are selected',()=>{
 assert.equal(api.isSupportedNote(file('notes.PDF')),true);
 assert.equal(api.isSupportedNote(file('lecture.md')),true);
 assert.equal(api.isSupportedNote(file('notes.txt')),true);
 assert.equal(api.isSupportedNote(file('notes.pdf.exe')),false);
});

test('one unreadable entry keeps readable siblings',async()=>{const result=await api.droppedFiles(transfer(directory([[entry('valid.pdf'),{isFile:true,file:(resolve,reject)=>reject(new Error('Denied')),name:'locked.pdf'}]])));assert.equal(result.files.length,1);assert.equal(result.errors.length,1);});

test('file drops prevent native navigation and invoke the same-page importer once',()=>{
 const target=new EventTarget();let imports=0;const cleanup=api.installFileDropHandlers(target,()=>imports++,()=>{});
 const event=new Event('drop',{cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{types:['Files']}});
 target.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(imports,1);
 cleanup();const next=new Event('drop',{cancelable:true});Object.defineProperty(next,'dataTransfer',{value:{types:['Files']}});target.dispatchEvent(next);assert.equal(imports,1);
});
test('text drops retain normal textarea behavior',()=>{
 const target=new EventTarget();let imports=0;const cleanup=api.installFileDropHandlers(target,()=>imports++,()=>{});
 const event=new Event('drop',{cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{types:['text/plain']}});target.dispatchEvent(event);assert.equal(event.defaultPrevented,false);assert.equal(imports,0);cleanup();
});
