import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {crc32,defaultSettings,makeSlot} from '../core.mjs';
const dir=new URL('./fixtures/',import.meta.url);await mkdir(dir,{recursive:true});
function chunk(name,bytes){const type=Buffer.from(name),data=Buffer.from(bytes),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([len,type,data,crc]);}
const assets=[];
for(let i=0;i<15;i++){const w=400+(i%3)*100,h=300+(i%4)*70,raw=Buffer.alloc(h*(1+w*3));for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;const palette=[[113,147,139],[185,147,113],[151,162,119],[162,139,161],[129,158,184]][i%5];const mountain=y>h*.65+Math.sin(x/w*7+i)*h*.12,light=.8+(1-y/h)*.3;for(let k=0;k<3;k++)raw[o+k]=Math.min(255,palette[k]*light*(mountain?.65:1));}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',[])]);const name=`sample-${i+1}.png`;await writeFile(new URL(name,dir),png);assets.push({id:`fixture-${i}`,name,data:`data:image/png;base64,${png.toString('base64')}`});}
await writeFile(new URL('sample.nikipuzzle',dir),JSON.stringify({type:'NikiPuzzle-project',version:1,assets,pages:[{id:'test',settings:defaultSettings(),slots:assets.slice(0,3).map(a=>makeSlot(a.id))}]}));
console.log('Created 15 local synthetic PNG test fixtures and a project.');
