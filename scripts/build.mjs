import {build} from 'esbuild';
import {zipSync,strToU8} from 'fflate';
import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
await mkdir('dist/stage/content',{recursive:true});
await cp('addon','dist/stage',{recursive:true});
await build({entryPoints:['src/zotero/plugin.ts'],bundle:true,format:'iife',globalName:'PaperCompare',target:'firefox140',outfile:'dist/stage/content/plugin.js',legalComments:'eof',minifySyntax:true,define:{TEST_BUILD:process.argv.includes('--test')?'true':'false'}});
const files={};
async function collect(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())await collect(path.join(dir,e.name),name+'/');else files[name]=new Uint8Array(await readFile(path.join(dir,e.name)));}}
await collect('dist/stage');
const manifest=JSON.parse(await readFile('addon/manifest.json','utf8'));
if(process.argv.includes('--test')){
 const development={...manifest,version:manifest.version+'.'+Date.now()};
 files['manifest.json']=strToU8(JSON.stringify(development,null,2));
}
const packageName=`papercompare-${manifest.version}.xpi`;
const bytes=zipSync(files,{level:6});
await writeFile(`dist/${packageName}`,bytes);
if(!process.argv.includes('--test')){
 const hash=createHash('sha256').update(bytes).digest('hex');
 await writeFile(`dist/${packageName}.sha256`,`${hash}  ${packageName}\n`);
 const target=manifest.applications.zotero;
 const updates={addons:{[target.id]:{updates:[{version:manifest.version,update_link:`https://github.com/luxun-spec/zotero-papercompare/releases/download/v${manifest.version}/${packageName}`,update_hash:`sha256:${hash}`,applications:{zotero:{strict_min_version:target.strict_min_version,strict_max_version:target.strict_max_version}}}]}}};
 await writeFile('dist/updates.json',JSON.stringify(updates,null,2)+'\n');
}
console.log(`Built dist/papercompare-${manifest.version}.xpi (${Object.keys(files).length} files)`);
