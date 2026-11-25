export const RATIOS = [['1:1',1,1],['3:4',3,4],['4:3',4,3],['9:16',9,16],['16:9',16,9],['2:3',2,3]];
export const LAYOUTS = {
  grid: [['grid','经典宫格'],['rows','横向叙事'],['columns','竖向长廊'],['balanced','方形节奏'],['alternating','砖墙交错'],['strips','宽窄条幅'],['grid-wide','横向宫格'],['grid-tall','纵向宫格'],['recursive','交替切分'],['thirds','三分节奏'],['two-bands','双层画册'],['rhythm','大小律动']],
  mosaic: [['hero-left','左侧主图'],['hero-top','封面时刻'],['hero-right','右侧主图'],['hero-bottom','下方主图'],['feature','焦点大片'],['stagger','错落画报'],['magazine-left','侧栏画报'],['magazine-top','横版画报'],['center-strip','中轴主图'],['top-banner','宽幅封面'],['bottom-banner','底部宽景'],['split-focus','双主角']],
  shape: [['diagonal','斜线切片'],['diamond','钻石切面'],['hexagon','蜂巢满铺'],['circle','圆形叠映'],['heart','心动叠映'],['slant','反向斜拼'],['diagonal-h','横向斜切'],['zigzag-cut','折线拼接'],['shards','不规则碎片'],['fan','放射扇面'],['overlap','错层叠放'],['steps','阶梯拼接']]
};
export const allLayouts = Object.values(LAYOUTS).flat().map(x=>x[0]);
export const isStitch=s=>['stitch-v','stitch-h'].includes(s.layout);
export const isShape=s=>LAYOUTS.shape.some(([id])=>id===s.layout);
export function pageRatio(s){if(!isStitch(s))return s.ratio;const aspects=s.stitchAspects||Array(s.count).fill(1);return s.layout==='stitch-v'?[1,aspects.reduce((t,a)=>t+1/a,0)]:[aspects.reduce((t,a)=>t+a,0),1];}
export function stitchSettings(settings,images,direction){if(!images.length||images.length>2000)throw Error('长拼需要 1–2000 张照片');return {...settings,layout:direction==='horizontal'?'stitch-h':'stitch-v',count:images.length,margin:0,gap:0,radius:0,stitchAspects:images.map(im=>im.width/im.height)};}
export function defaultSettings(){return {ratio:[3,4],count:3,layout:'hero-left',margin:4,gap:1.5,radius:0,background:'#ffffff'};}
export function cleanSettings(s){
  if(!s || !Array.isArray(s.ratio) || s.ratio.length!==2 || s.ratio.some(x=>!Number.isFinite(x)||x<1||x>100) || !Number.isInteger(s.count)||s.count<1||s.count>(isStitch(s)?2000:12)||(!allLayouts.includes(s.layout)&&!isStitch(s))||!/^#[0-9a-f]{6}$/i.test(s.background)) throw Error('模板配置无效');
  for(const [k,max] of [['margin',12],['gap',8],['radius',50]]) if(!Number.isFinite(s[k])||s[k]<0||s[k]>max)throw Error('模板数值无效');
  const result={ratio:[...s.ratio],count:s.count,layout:s.layout,margin:s.margin,gap:s.gap,radius:s.radius,background:s.background};
  if(isStitch(s)){if(!Array.isArray(s.stitchAspects)||s.stitchAspects.length!==s.count||s.stitchAspects.some(a=>!Number.isFinite(a)||a<.00001||a>100000))throw Error('长拼照片比例无效');result.stitchAspects=[...s.stitchAspects];}
  return result;
}
export function dimensions(ratio,longEdge){const r=ratio[0]/ratio[1];return r>=1?[longEdge,Math.round(longEdge/r)]:[Math.round(longEdge*r),longEdge];}
export function validateDimensions(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>30000||h>30000||w*h>64000000)throw Error('尺寸需为 1–30000 像素，且总像素不超过 6400 万');}
export function cells(s,w,h){
 if(isStitch(s)){const aspects=s.stitchAspects||Array(s.count).fill(1),vertical=s.layout==='stitch-v',weights=aspects.map(a=>vertical?1/a:a),total=weights.reduce((a,b)=>a+b,0);let offset=0;return weights.map((weight,i)=>{const end=i===weights.length-1?(vertical?h:w):(offset+weight/total*(vertical?h:w));const b=vertical?{x:0,y:offset,w,h:end-offset,shape:'rect'}:{x:offset,y:0,w:end-offset,h,shape:'rect'};offset=end;return b;});}
 if(isShape(s))return shapeCells(s,w,h);
 const n=s.count,m=Math.min(w,h)*s.margin/100,g=Math.min(w,h)*s.gap/100,W=w-2*m,H=h-2*m;let boxes=[];const rect=(x,y,a,b,shape='rect')=>({x:m+x*W+g/2,y:m+y*H+g/2,w:Math.max(1,a*W-g),h:Math.max(1,b*H-g),shape});
 const grid=(count,x,y,a,b,cols)=>{let rows=Math.ceil(count/cols);for(let i=0;i<count;i++){let row=Math.floor(i/cols),inRow=Math.min(cols,count-row*cols);boxes.push(rect(x+(i%cols)*a/inRow,y+row*b/rows,a/inRow,b/rows));}};
 const l=s.layout;
 if(n===1)boxes=[rect(0,0,1,1)];
 else if(l==='center-strip'){boxes.push(rect(.22,0,.56,1));const left=Math.ceil((n-1)/2);grid(left,0,0,.22,1,1);if(n-1-left)grid(n-1-left,.78,0,.22,1,1);else boxes[0]=rect(.22,0,.78,1);}
 else if(l==='split-focus'){if(n===2){grid(n,0,0,1,1,2);}else{boxes.push(rect(0,0,.5,.7),rect(.5,0,.5,.7));grid(n-2,0,.7,1,.3,n-2);}}
 else if(l.startsWith('hero-')||['feature','magazine-left','magazine-top','top-banner','bottom-banner'].includes(l)){const vertical=['hero-left','hero-right','feature','magazine-left'].includes(l),reverse=['hero-right','hero-bottom','bottom-banner'].includes(l),hero=l==='feature'?.72:l.startsWith('magazine')?.45:l.includes('banner')?.35:.6;if(vertical){boxes.push(rect(reverse?1-hero:0,0,hero,1));grid(n-1,reverse?0:hero,0,1-hero,1,l==='magazine-left'?Math.min(2,n-1):n>5?2:1);}else{boxes.push(rect(0,reverse?1-hero:0,1,hero));grid(n-1,0,reverse?0:hero,1,1-hero,l==='magazine-top'?Math.ceil(Math.sqrt(n-1)):n>5?Math.ceil((n-1)/2):n-1);}}
 else if(['recursive','rhythm','stagger'].includes(l)){const split=(count,x,y,a,b,depth)=>{if(count===1){boxes.push(rect(x,y,a,b));return;}const first=l==='rhythm'?1:Math.ceil(count/2),part=l==='stagger'?.38:first/count,vertical=depth%2===0;if(vertical){split(first,x,y,a*part,b,depth+1);split(count-first,x+a*part,y,a*(1-part),b,depth+1);}else{split(first,x,y,a,b*part,depth+1);split(count-first,x,y+b*part,a,b*(1-part),depth+1);}};split(n,0,0,1,1,0);}
 else if(l==='alternating'||l==='two-bands'){let rows=l==='two-bands'?2:Math.max(2,Math.round(Math.sqrt(n)));rows=Math.min(rows,n);let remaining=n,y=0;for(let r=0;r<rows;r++){const count=Math.ceil(remaining/(rows-r)),height=r===rows-1?1-y:1/rows;const weights=Array.from({length:count},(_,i)=>l==='alternating'?(i===0?(r%2?.6:1.4):1):1),sum=weights.reduce((a,b)=>a+b,0);let x=0;weights.forEach(weight=>{boxes.push(rect(x,y,weight/sum,height));x+=weight/sum;});remaining-=count;y+=height;}}
 else if(l==='strips'||l==='thirds'){const weights=Array.from({length:n},(_,i)=>l==='strips'?(i%2?1:2):(i%3===0?2:1)),sum=weights.reduce((a,b)=>a+b,0);let x=0;weights.forEach(weight=>{boxes.push(rect(x,0,weight/sum,1));x+=weight/sum;});}
 else if(l==='diagonal'){for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,tilt=.16;boxes.push({x:m,y:m,w:W,h:H,shape:'polygon',points:[[Math.max(0,a-tilt),0],[i===n-1?1:b-tilt,0],[Math.min(1,b+tilt),1],[i===0?0:a+tilt,1]],inset:g/2});}}
 else {let cols=l==='rows'?1:l==='columns'?n:l==='balanced'?Math.ceil(Math.sqrt(n)):l==='grid-wide'?Math.ceil(Math.sqrt(n*2)):l==='grid-tall'?Math.max(1,Math.floor(Math.sqrt(n/2))):Math.ceil(n/Math.ceil(Math.sqrt(n)));cols=Math.max(1,Math.min(n,cols));grid(n,0,0,1,1,cols);}
 if(['circle','heart','hexagon','diamond','slant'].includes(l))boxes.forEach(b=>b.shape=l);
 return boxes;
}
// Convex clipping partitions the full canvas without gaps or detached cutouts.
function clipHalfPlane(points,a,b,c){const out=[];for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],dp=a*p[0]+b*p[1]-c,dq=a*q[0]+b*q[1]-c;if(dp<=1e-10)out.push(p);if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}return out;}
function shapeCells(s,w,h){const n=s.count,m=Math.min(w,h)*s.margin/100,g=Math.min(w,h)*s.gap/100,W=w-2*m,H=h-2*m,l=s.layout;
 const poly=points=>({x:m,y:m,w:W,h:H,shape:'polygon',points,inset:g/2});const full={x:m,y:m,w:W,h:H,shape:'rect'};if(n===1)return [full];
 if(['circle','heart','overlap'].includes(l)){const result=[full];const cols=Math.ceil(Math.sqrt(n-1)),rows=Math.ceil((n-1)/cols);for(let i=1;i<n;i++){const col=(i-1)%cols,row=Math.floor((i-1)/cols),bw=.84/cols,bh=.84/rows,x=.08+col*.84/cols+(i%2?.025:-.025),y=.08+row*.84/rows;const b={x:m+x*W,y:m+y*H,w:bw*W,h:bh*H,shape:l==='overlap'?'polygon':l,inset:g/2};if(l==='overlap')b.points=i%2?[[0,.04],[.92,0],[1,.94],[.06,1]]:[[.08,0],[1,.07],[.92,1],[0,.94]];result.push(b);}return result;}
 if(['diagonal','slant','diagonal-h','zigzag-cut','steps'].includes(l)){const horizontal=l==='diagonal-h';const boundary=(i,t)=>{if(i===0)return 0;if(i===n)return 1;const v=i/n,amp=Math.min(.15,.7/n);if(l==='steps')return v+(t<.35?-amp:t<.7?0:amp);if(l==='zigzag-cut')return v+(t===0||t===1?-amp:amp);return v+(t-.5)*amp*2*(l==='slant'?-1:1);};const ts=l==='steps'?[0,.34999,.35,.69999,.7,1]:l==='zigzag-cut'?[0,.5,1]:[0,1];return Array.from({length:n},(_,i)=>{let points=[...ts.map(t=>[boundary(i,t),t]),...ts.slice().reverse().map(t=>[boundary(i+1,t),t])];if(horizontal)points=points.map(([a,b])=>[b,a]);return poly(points);});}
 if(l==='fan'||l==='diamond'){const cx=l==='fan'?.35:.5,cy=l==='fan'?.6:.5,point=t=>{const angle=t*Math.PI*2-Math.PI*.75,dx=Math.cos(angle),dy=Math.sin(angle),scale=Math.min(dx>0?(1-cx)/dx:dx<0?-cx/dx:Infinity,dy>0?(1-cy)/dy:dy<0?-cy/dy:Infinity);return [cx+dx*scale,cy+dy*scale];};const cornerAngles=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{let a=(Math.atan2(y-cy,x-cx)+Math.PI*.75)/(2*Math.PI);return (a+1)%1;});return Array.from({length:n},(_,i)=>{const start=i/n,end=(i+1)/n,between=cornerAngles.filter(t=>t>start+1e-9&&t<end-1e-9).sort((a,b)=>a-b);return poly([[cx,cy],point(start),...between.map(point),point(end)]);});}
 const cols=Math.ceil(Math.sqrt(n*W/H)),rows=Math.ceil(n/cols),seeds=Array.from({length:n},(_,i)=>{const row=Math.floor(i/cols),col=i%cols;return l==='hexagon'?[(col+.5+(row%2?.22:-.05))/cols,(row+.5)/rows]:[(col+.3+((i*7)%5)*.1)/cols,(row+.3+((i*3)%5)*.1)/rows];});
 return seeds.map((p,i)=>{let points=[[0,0],[1,0],[1,1],[0,1]];seeds.forEach((q,j)=>{if(j!==i)points=clipHalfPlane(points,2*(q[0]-p[0]),2*(q[1]-p[1]),q[0]**2+q[1]**2-p[0]**2-p[1]**2);});return poly(points);});
}
export function cropRect(image,box,slot){const cover=slot.fit!=='contain';let scale=(cover?Math.max:Math.min)(box.w/image.width,box.h/image.height)*(slot.zoom||1);const w=image.width*scale,h=image.height*scale;let x=box.x+(box.w-w)/2+(slot.x||0)*box.w,y=box.y+(box.h-h)/2+(slot.y||0)*box.h;if(cover){x=Math.max(box.x+box.w-w,Math.min(box.x,x));y=Math.max(box.y+box.h-h,Math.min(box.y,y));}return {x,y,w,h};}
export function makeSlot(id=null){return {id,zoom:1,x:0,y:0,fit:'cover'};}
// Moving a photo to another collage cell: a filled target swaps whole cells, an empty target leaves the source vacant.
export function swapSlots(slots,from,to){
  if(!Array.isArray(slots)||from===to||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=slots.length||to>=slots.length)return slots.slice();
  const out=slots.slice(),a=out[from],b=out[to];
  if(!a||!a.id)return out;
  if(!b||!b.id){out[to]={...a};out[from]=makeSlot();}
  else{out[from]={...b};out[to]={...a};}
  return out;
}
export function polygonFor(shape){return {diamond:[[.5,0],[1,.5],[.5,1],[0,.5]],hexagon:[[.25,0],[.75,0],[1,.5],[.75,1],[.25,1],[0,.5]],slant:[[.12,0],[1,0],[.88,1],[0,1]]}[shape];}
export function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export function zipStore(files){let chunks=[],central=[],offset=0;const enc=new TextEncoder();for(const f of files){const name=enc.encode(f.name),data=f.data,crc=crc32(data),head=new Uint8Array(30+name.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);head.set(name,30);chunks.push(head,data);const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=head.length+data.length;}const size=central.reduce((a,b)=>a+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});}
