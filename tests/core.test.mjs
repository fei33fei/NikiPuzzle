import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,cleanSettings,allLayouts,cells,dimensions,validateDimensions,cropRect,crc32,zipStore,LAYOUTS,stitchSettings,pageRatio,makeSlot,swapSlots,clearSlots} from '../core.mjs';

test('there are 36 selectable layouts with 12 in each category',()=>{assert.equal(allLayouts.length,36);assert.equal(new Set(allLayouts).size,36);for(const list of Object.values(LAYOUTS))assert.equal(list.length,12);});
function inside(b,x,y){const X=(x-b.x)/b.w,Y=(y-b.y)/b.h;if(b.shape==='rect')return X>=0&&X<=1&&Y>=0&&Y<=1;if(b.shape!=='polygon')return false;let hit=false;for(let i=0,j=b.points.length-1;i<b.points.length;j=i++){const a=b.points[i],c=b.points[j];if((a[1]>Y)!==(c[1]>Y)&&X<(c[0]-a[0])*(Y-a[1])/(c[1]-a[1])+a[0])hit=!hit;}return hit;}
test('all irregular layouts cover the entire canvas without isolated white cutouts',()=>{for(const [layout]of LAYOUTS.shape)for(let count=1;count<=12;count++)for(const ratio of [[1,1],[9,16],[16,9]]){const [w,h]=dimensions(ratio,400),boxes=cells({...defaultSettings(),layout,count,margin:0,gap:0,radius:0},w,h);for(let row=0;row<29;row++)for(let col=0;col<29;col++){const x=(col+.271)/29*w,y=(row+.379)/29*h;assert.ok(boxes.some(b=>inside(b,x,y)),`${layout} ${count} ${ratio}: blank at ${x},${y}`);}for(const b of boxes.filter(b=>b.points)){const area=Math.abs(b.points.reduce((a,p,i)=>{const q=b.points[(i+1)%b.points.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;assert.ok(area>1e-8,`${layout}: empty polygon`);}}});
test('long stitches include more than 12 complete photos in both directions',()=>{const images=Array.from({length:37},(_,i)=>({width:400+i*20,height:300+i*3}));for(const direction of ['vertical','horizontal']){const s=stitchSettings(defaultSettings(),images,direction);assert.equal(s.count,37);assert.deepEqual(cleanSettings(s),s);const [w,h]=pageRatio(s).map(v=>v*100),boxes=cells(s,w,h);assert.equal(boxes.length,images.length);boxes.forEach((b,i)=>assert.ok(Math.abs(b.w/b.h-images[i].width/images[i].height)<1e-8));const last=boxes.at(-1);assert.ok(Math.abs(direction==='vertical'?last.y+last.h-h:last.x+last.w-w)<1e-8);}});
test('long stitch ratios are validated and original ordinary templates remain compatible',()=>{assert.deepEqual(cleanSettings(defaultSettings()),defaultSettings());assert.throws(()=>stitchSettings(defaultSettings(),[],'vertical'));const s=stitchSettings(defaultSettings(),[{width:400,height:300}],'vertical');assert.throws(()=>cleanSettings({...s,stitchAspects:[]}));assert.throws(()=>cleanSettings({...s,stitchAspects:[Infinity]}));assert.throws(()=>cleanSettings({...s,count:2001}));validateDimensions(1000,30000);assert.throws(()=>validateDimensions(1000,30001));});
test('every layout produces the requested number of usable cells at all counts and ratios',()=>{for(const layout of allLayouts)for(let count=1;count<=12;count++)for(const ratio of [[1,1],[9,16],[16,9]]){const s={...defaultSettings(),layout,count,ratio};const [w,h]=dimensions(ratio,4800),boxes=cells(s,w,h);assert.equal(boxes.length,count);for(const b of boxes){assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));assert.ok(b.w>0&&b.h>0);}}});
test('template validation rejects unsafe settings and retains only approved fields',()=>{const s=defaultSettings();assert.deepEqual(cleanSettings({...s,unexpected:1}),s);for(const bad of [{count:13},{ratio:[0,1]},{ratio:[1,1,1]},{layout:'invalid'},{background:'red'},{gap:-1},{radius:Infinity}])assert.throws(()=>cleanSettings({...s,...bad}));});
test('export dimensions preserve portrait and landscape ratios, guard memory',()=>{assert.deepEqual(dimensions([3,4],4800),[3600,4800]);assert.deepEqual(dimensions([16,9],8000),[8000,4500]);validateDimensions(8000,8000);assert.throws(()=>validateDimensions(12000,12000));assert.throws(()=>validateDimensions(0,100));assert.throws(()=>validateDimensions(100.5,100));});
test('cover fills the cell and contain preserves the complete image',()=>{const image={width:200,height:100},b={x:10,y:20,w:100,h:100};assert.deepEqual(cropRect(image,b,{fit:'cover',zoom:1}),{x:-40,y:20,w:200,h:100});assert.deepEqual(cropRect(image,b,{fit:'contain',zoom:1}),{x:10,y:45,w:100,h:50});});
test('panning in cover mode never exposes blank canvas inside a photo cell',()=>{for(const image of [{width:200,height:100},{width:100,height:200}])for(const x of [-3,0,3])for(const y of [-3,0,3]){const b={x:15,y:23,w:100,h:150},r=cropRect(image,b,{fit:'cover',zoom:2,x,y});assert.ok(r.x<=b.x&&r.y<=b.y);assert.ok(r.x+r.w>=b.x+b.w-1e-8&&r.y+r.h>=b.y+b.h-1e-8);}});
test('ZIP stores exact bytes with Unicode names and valid directory offsets',async()=>{const data=new TextEncoder().encode('123456789');assert.equal(crc32(data),0xcbf43926);const z=new Uint8Array(await zipStore([{name:'照片.png',data},{name:'second.png',data:new Uint8Array([0,255,12])}]).arrayBuffer());const v=new DataView(z.buffer);assert.equal(v.getUint32(0,true),0x04034b50);const len=v.getUint16(26,true);assert.equal(new TextDecoder().decode(z.slice(30,30+len)),'照片.png');assert.deepEqual(z.slice(30+len,30+len+data.length),data);const end=z.length-22;assert.equal(v.getUint32(end,true),0x06054b50);assert.equal(v.getUint16(end+10,true),2);const offset=v.getUint32(end+16,true);assert.equal(v.getUint32(offset,true),0x02014b50);assert.equal(v.getUint32(offset+42,true),0);});
test('dragging a photo between collage cells swaps filled cells and leaves the source vacant for empty targets',()=>{
 const photo={id:'a',zoom:2,x:.4,y:-.3,fit:'cover'},other={id:'b',zoom:1,x:0,y:0,fit:'contain'},slots=[photo,other,makeSlot()];
 const swapped=swapSlots(slots,0,1);
 assert.deepEqual(swapped.map(s=>s.id),['b','a',null]);
 assert.deepEqual(swapped[0],other);assert.deepEqual(swapped[1],photo);
 const moved=swapSlots(slots,0,2);
 assert.deepEqual(moved.map(s=>s.id),[null,'b','a']);
 assert.deepEqual(moved[2],photo);assert.deepEqual(moved[0],makeSlot());
 assert.deepEqual(swapSlots(slots,1,1).map(s=>s.id),['a','b',null]);
 assert.deepEqual(swapSlots(slots,0,9).map(s=>s.id),['a','b',null]);
 assert.deepEqual(slots.map(s=>s.id),['a','b',null]);
});
test('clearing photos empties every slot but keeps layouts, counts and page order',()=>{
 const pages=[{id:'p1',settings:{...defaultSettings(),layout:'hero-left',count:3},slots:[makeSlot('a'),makeSlot('b'),makeSlot()]},{id:'p2',settings:{...defaultSettings(),layout:'grid',count:2},slots:[makeSlot('c'),makeSlot('d')]}];
 const cleared=clearSlots(pages);
 assert.deepEqual(cleared.map(p=>p.slots.map(s=>s.id)),[[null,null,null],[null,null]]);
 assert.deepEqual(cleared.map(p=>p.settings.layout),['hero-left','grid']);
 assert.deepEqual(cleared.map(p=>p.settings.count),[3,2]);
 assert.deepEqual(cleared.map(p=>p.id),['p1','p2']);
 assert.deepEqual(cleared[0].slots[0],makeSlot());
 assert.equal(pages[0].slots[0].id,'a');
});
test('classic grid divides evenly into two columns and never repeats the square-rhythm layout',()=>{
 const geometry=(layout,count)=>{const [w,h]=dimensions([3,4],4800);const boxes=cells({...defaultSettings(),layout,count,margin:0,gap:0,radius:0},w,h);return {cols:new Set(boxes.map(b=>Math.round(b.x))).size,rows:new Set(boxes.map(b=>Math.round(b.y))).size,boxes:boxes.length};};
 assert.deepEqual(geometry('grid',6),{cols:2,rows:3,boxes:6});
 assert.deepEqual(geometry('balanced',6),{cols:3,rows:2,boxes:6});
 assert.deepEqual(geometry('grid',4),{cols:2,rows:2,boxes:4});
 assert.deepEqual(geometry('grid',12),{cols:3,rows:4,boxes:12});
 assert.deepEqual(geometry('grid',1),{cols:1,rows:1,boxes:1});
});
