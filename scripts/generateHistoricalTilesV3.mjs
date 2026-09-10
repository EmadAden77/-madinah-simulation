import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE=512;
const ROOT=path.join(process.cwd(),'public','tiles');
const bounds={west:39.585,south:24.445,east:39.640,north:24.490};
const center={lon:39.6114,lat:24.4675};
const epochs=[622,627,632];

function seed(n){const x=Math.sin(n*9187.123)*43758.5453;return x-Math.floor(x)}
function clamp(v,a=0,b=255){return Math.max(a,Math.min(b,v))}
function lon2x(lon,z){return Math.floor(((lon+180)/360)*2**z)}
function lat2y(lat,z){const r=lat*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z)}
function tilePixelToLngLat(z,x,y,px,py){const n=2**z,wx=(x+px/TILE)/n,wy=(y+py/TILE)/n;return[wx*360-180,Math.atan(Math.sinh(Math.PI*(1-2*wy)))*180/Math.PI]}
function lngLatToTilePixel(z,x,y,lon,lat){const n=2**z,wx=((lon+180)/360)*n,r=lat*Math.PI/180,wy=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n;return[(wx-x)*TILE,(wy-y)*TILE]}
function metersToPixels(z,lat,m){const mpp=156543.03392*Math.cos(lat*Math.PI/180)/2**z;return m/mpp*(TILE/256)}
function noise2(lon,lat,s=1){const a=Math.sin((lon*511.73+lat*829.11)*s),b=Math.sin((lon*1731.17-lat*1291.37)*s*.63),c=Math.sin((lon*6321.9+lat*2711.4)*s*.21),d=Math.cos((lon*11129.2-lat*7439.4)*s*.11);return(a+b*.55+c*.28+d*.16)/1.99}
function ellipse(lon,lat,cx,cy,rx,ry){const dx=(lon-cx)/rx,dy=(lat-cy)/ry;return dx*dx+dy*dy<1}
function distM(aLon,aLat,bLon,bLat){const x=(aLon-bLon)*101500,y=(aLat-bLat)*111320;return Math.hypot(x,y)}
function rotOffset(dx,dy,a){const c=Math.cos(a),s=Math.sin(a);return[dx*c-dy*s,dx*s+dy*c]}

const farms=[[39.6010,24.4690,.0075,.0060],[39.6168,24.4617,.0068,.0050],[39.6042,24.4790,.0060,.0046],[39.6125,24.4746,.0044,.0034]];
const routes=[[[39.592,24.457],[39.599,24.461],[39.605,24.465],[39.611,24.467],[39.618,24.471],[39.627,24.477]],[[39.600,24.482],[39.604,24.475],[39.608,24.470],[39.611,24.467],[39.616,24.460],[39.621,24.453]],[[39.594,24.470],[39.601,24.469],[39.607,24.468],[39.611,24.467],[39.619,24.466],[39.629,24.464]]];
const centralPaths=[[[39.60925,24.46710],[39.61015,24.46720],[39.61100,24.46735],[39.61140,24.46750]],[[39.61140,24.46750],[39.61220,24.46722],[39.61320,24.46685]],[[39.61138,24.46750],[39.61110,24.46680],[39.61078,24.46618]],[[39.61142,24.46752],[39.61148,24.46810],[39.61158,24.46868]]];
const clusters=[[39.6111,24.4672,155,.0062,.0048],[39.6065,24.4700,72,.0038,.0029],[39.6160,24.4640,68,.0040,.0031],[39.6142,24.4708,55,.0032,.0026]];

const compounds=[];let ci=0;
for(const[cx,cy,count,sx,sy]of clusters){for(let i=0;i<count;i++,ci++){
  const lon=cx+(seed(ci*23+1)-.5)*sx,lat=cy+(seed(ci*23+2)-.5)*sy;
  if(distM(lon,lat,center.lon,center.lat)<72){i--;continue}
  const born=seed(ci*29+11)<.58?622:(seed(ci*29+12)<.57?627:632);
  compounds.push({lon,lat,w:13+seed(ci*23+3)*22,h:11+seed(ci*23+4)*19,ang:(seed(ci*23+5)-.5)*.36,parts:2+Math.floor(seed(ci*23+6)*4),tone:seed(ci*23+7),yard:seed(ci*23+8)>.22,wall:seed(ci*23+9)>.38,id:ci,born});
}}

const palms=[];for(let i=0;i<1200;i++){const f=farms[i%farms.length],a=seed(i*7+1)*Math.PI*2,r=Math.sqrt(seed(i*7+2));palms.push({lon:f[0]+Math.cos(a)*f[2]*r*.94,lat:f[1]+Math.sin(a)*f[3]*r*.94,size:2.3+seed(i*7+3)*3.4,rotation:seed(i*7+4)*Math.PI*2})}
const farmPlots=[];for(let i=0;i<110;i++){const f=farms[i%farms.length],a=seed(i*17+1)*Math.PI*2,r=Math.sqrt(seed(i*17+2))*.82;farmPlots.push({lon:f[0]+Math.cos(a)*f[2]*r,lat:f[1]+Math.sin(a)*f[3]*r,w:25+seed(i*17+3)*70,h:18+seed(i*17+4)*55,ang:(seed(i*17+5)-.5)*.5,tone:seed(i*17+6)})}

function setPixel(buf,x,y,r,g,b,a=255){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=TILE||y>=TILE)return;const i=(y*TILE+x)*4,k=a/255,ik=1-k;buf[i]=clamp(buf[i]*ik+r*k);buf[i+1]=clamp(buf[i+1]*ik+g*k);buf[i+2]=clamp(buf[i+2]*ik+b*k);buf[i+3]=255}
function drawDisc(buf,cx,cy,rad,color,a=255){const r2=rad*rad;for(let yy=Math.floor(cy-rad);yy<=Math.ceil(cy+rad);yy++)for(let xx=Math.floor(cx-rad);xx<=Math.ceil(cx+rad);xx++){const dx=xx-cx,dy=yy-cy;if(dx*dx+dy*dy<=r2)setPixel(buf,xx,yy,color[0],color[1],color[2],a)}}
function drawLine(buf,x0,y0,x1,y1,w,c,a=255){const dx=x1-x0,dy=y1-y0,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));for(let i=0;i<=steps;i++){const t=i/steps;drawDisc(buf,x0+dx*t,y0+dy*t,w/2,c,a)}}
function drawPolyline(buf,pts,w,c,a=255){for(let i=0;i<pts.length-1;i++)drawLine(buf,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],w,c,a)}
function drawRotRect(buf,cx,cy,w,h,ang,color,a=255){const hw=w/2,hh=h/2,c=Math.cos(ang),s=Math.sin(ang),rad=Math.ceil(Math.sqrt(hw*hw+hh*hh));for(let yy=Math.floor(cy-rad);yy<=Math.ceil(cy+rad);yy++)for(let xx=Math.floor(cx-rad);xx<=Math.ceil(cx+rad);xx++){const dx=xx-cx,dy=yy-cy,rx=dx*c+dy*s,ry=-dx*s+dy*c;if(Math.abs(rx)<=hw&&Math.abs(ry)<=hh)setPixel(buf,xx,yy,color[0],color[1],color[2],a)}}
function drawOutlinedRect(buf,cx,cy,w,h,ang,outer,inner,wall){drawRotRect(buf,cx,cy,w,h,ang,outer,255);drawRotRect(buf,cx,cy,Math.max(1,w-wall*2),Math.max(1,h-wall*2),ang,inner,255)}

function drawCompound(buf,z,x,y,c){const[cx,cy]=lngLatToTilePixel(z,x,y,c.lon,c.lat),wp=metersToPixels(z,c.lat,c.w),hp=metersToPixels(z,c.lat,c.h);if(cx+wp*2<0||cy+hp*2<0||cx-wp*2>TILE||cy-hp*2>TILE)return;const wall=Math.max(.7,metersToPixels(z,c.lat,.6)),sx=Math.max(1,metersToPixels(z,c.lat,1.5)),sy=Math.max(1.2,metersToPixels(z,c.lat,1.9));if(c.wall&&z>=15){drawRotRect(buf,cx+sx*.6,cy+sy*.7,wp*1.12,hp*1.12,c.ang,[58,45,34],62);drawOutlinedRect(buf,cx,cy,wp*1.1,hp*1.1,c.ang,[132,95,65],[176,146,101],wall)}const roof=[148+c.tone*30,108+c.tone*23,73+c.tone*16];for(let p=0;p<c.parts;p++){const side=p%4,frac=.38+seed(c.id*31+p*7+1)*.22;let dx=0,dy=0,pw=wp*.34,ph=hp*.34;if(side===0){dy=-hp*.34;dx=(seed(c.id*37+p)-.5)*wp*.28;pw=wp*frac;ph=hp*.28}if(side===1){dx=wp*.34;dy=(seed(c.id*41+p)-.5)*hp*.28;pw=wp*.28;ph=hp*frac}if(side===2){dy=hp*.34;dx=(seed(c.id*43+p)-.5)*wp*.28;pw=wp*frac;ph=hp*.28}if(side===3){dx=-wp*.34;dy=(seed(c.id*47+p)-.5)*hp*.28;pw=wp*.28;ph=hp*frac}const[ox,oy]=rotOffset(dx,dy,c.ang),v=(seed(c.id*59+p)-.5)*16;drawRotRect(buf,cx+ox+sx,cy+oy+sy,pw*1.03,ph*1.03,c.ang,[48,38,30],95);drawRotRect(buf,cx+ox,cy+oy,pw,ph,c.ang,[roof[0]+v,roof[1]+v*.8,roof[2]+v*.55],255)}if(c.yard)drawRotRect(buf,cx,cy,wp*.44,hp*.39,c.ang,[172,146,103],210)}

function drawCentralComplex(buf,z,x,y,epoch){
  const ang=.02,wall=Math.max(.9,metersToPixels(z,center.lat,.62));
  const[mcx,mcy]=lngLatToTilePixel(z,x,y,center.lon,center.lat),scale=epoch===622?1:epoch===627?1.07:1.13,mw=metersToPixels(z,center.lat,34*scale),mh=metersToPixels(z,center.lat,31*scale),sx=metersToPixels(z,center.lat,1.9),sy=metersToPixels(z,center.lat,2.3);
  drawRotRect(buf,mcx+sx,mcy+sy,mw*1.05,mh*1.05,ang,[46,37,30],105);drawOutlinedRect(buf,mcx,mcy,mw,mh,ang,[139,100,68],[184,155,111],wall);drawRotRect(buf,mcx,mcy,mw*.69,mh*.66,ang,[172,146,104],245);
  if(z>=16){for(let k=0;k<7;k++){const px=mcx-mw*.28+k*mw*.093;drawDisc(buf,px,mcy-mh*.29,Math.max(.7,wall*.8),[116,82,56],190)}drawLine(buf,mcx-mw*.36,mcy+mh*.27,mcx+mw*.36,mcy+mh*.27,Math.max(.8,wall*.9),[119,83,56],180)}
  const chamberCount=epoch===622?7:9;for(let i=0;i<chamberCount;i++){const lon=39.61179,lat=24.46777-i*.000075,[cx,cy]=lngLatToTilePixel(z,x,y,lon,lat),w=metersToPixels(z,lat,5.1),h=metersToPixels(z,lat,4.1);drawRotRect(buf,cx+sx*.55,cy+sy*.6,w,h,ang,[52,41,31],90);drawOutlinedRect(buf,cx,cy,w,h,ang,[145,103,70],[181,143,97],Math.max(.55,wall*.45))}
  const[mkx,mky]=lngLatToTilePixel(z,x,y,39.60988,24.46710),mkw=metersToPixels(z,center.lat,104),mkh=metersToPixels(z,center.lat,49);drawRotRect(buf,mkx,mky,mkw,mkh,-.08,[188,165,124],80);if(z>=16){const stalls=epoch===622?8:epoch===627?12:16;for(let i=0;i<stalls;i++){const dx=(seed(700+i*5)-.5)*mkw*.82,dy=(seed(701+i*5)-.5)*mkh*.68,[ox,oy]=rotOffset(dx,dy,-.08);drawRotRect(buf,mkx+ox,mky+oy,Math.max(1.4,metersToPixels(z,center.lat,2.2+seed(i)*2.4)),Math.max(1,metersToPixels(z,center.lat,1.4)),(seed(900+i)-.5)*.8,[124,91,59],115)}}
  for(const p of centralPaths){const pts=p.map(([lon,lat])=>lngLatToTilePixel(z,x,y,lon,lat)),w=metersToPixels(z,center.lat,3);drawPolyline(buf,pts,w*1.65,[104,87,64],40);drawPolyline(buf,pts,w,[205,183,143],150)}
}

function makeTile(z,x,y,epoch){const buf=Buffer.alloc(TILE*TILE*4);
  for(let py=0;py<TILE;py++)for(let px=0;px<TILE;px++){const[lon,lat]=tilePixelToLngLat(z,x,y,px,py),broad=noise2(lon,lat,.67),mid=noise2(lon,lat,3.1),fine=noise2(lon,lat,15.7),micro=noise2(lon,lat,54);let r=184+broad*17+mid*7+fine*3+micro*1.6,g=160+broad*14+mid*5.5+fine*2.6+micro*1.2,b=118+broad*10+mid*4+fine*2+micro*.9;let inFarm=false;for(const[cx,cy,rx,ry]of farms)if(ellipse(lon,lat,cx,cy,rx,ry)){inFarm=true;const fn=noise2(lon,lat,9.8),rows=Math.sin(lon*9100+lat*6550);r=123+fn*13+rows*3.5;g=118+fn*16+rows*5;b=74+fn*8+rows*2;break}const central=distM(lon,lat,center.lon,center.lat);if(central<115&&!inFarm){const k=1-central/115;r+=7*k;g+=6*k;b+=4*k}const w1=Math.abs(Math.sin((lon-39.599)*124+(lat-24.456)*79)),w2=Math.abs(Math.sin((lon-39.615)*96-(lat-24.462)*117));if(!inFarm&&(w1<.032||w2<.021)&&lat<24.480){r-=11;g-=9;b-=6}const grain=seed(Math.floor((lon+180)*1700000)+Math.floor((lat+90)*1900000));if(grain>.986){r-=15;g-=14;b-=12}setPixel(buf,px,py,r,g,b)}
  if(z>=15){for(const p of farmPlots){const[cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat),wp=metersToPixels(z,p.lat,p.w),hp=metersToPixels(z,p.lat,p.h);if(cx+wp<0||cy+hp<0||cx-wp>TILE||cy-hp>TILE)continue;const shade=90+p.tone*18;drawRotRect(buf,cx,cy,wp,hp,p.ang,[shade,105+p.tone*18,63+p.tone*8],26)}}
  for(let ri=0;ri<routes.length;ri++){const pts=routes[ri].map(([lon,lat])=>lngLatToTilePixel(z,x,y,lon,lat)),w=metersToPixels(z,24.467,5.2);drawPolyline(buf,pts,w*1.75,[105,87,63],42);drawPolyline(buf,pts,w*1.15,[198,177,137],140)}
  for(const c of compounds)if(c.born<=epoch)drawCompound(buf,z,x,y,c);drawCentralComplex(buf,z,x,y,epoch);
  const palmLimit=epoch===622?1050:epoch===627?1125:1200;for(let pi=0;pi<palmLimit;pi++){const p=palms[pi],[cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat),rad=Math.max(1.15,metersToPixels(z,p.lat,p.size));if(cx+rad*2<0||cy+rad*2<0||cx-rad*2>TILE||cy-rad*2>TILE)continue;drawDisc(buf,cx+rad*.68,cy+rad*.82,rad*.86,[39,34,26],66);if(z>=15)for(let j=0;j<11;j++){const a=p.rotation+j/11*Math.PI*2,len=rad*(.78+seed(j+p.lon*1000)*.38);drawLine(buf,cx,cy,cx+Math.cos(a)*len,cy+Math.sin(a)*len,Math.max(.58,rad*.18),[45,76,40],205)}drawDisc(buf,cx,cy,rad*.46,[61,92,49],205);drawDisc(buf,cx,cy,Math.max(.5,rad*.11),[96,70,41],225)}
  return png(buf,TILE,TILE)}

function crc32(buf){let c=0xffffffff;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
function png(rgba,w,h){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4)}const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))])}

fs.rmSync(ROOT,{recursive:true,force:true});let total=0;
for(const epoch of epochs){for(const z of[13,14,15,16,17]){const minX=lon2x(bounds.west,z),maxX=lon2x(bounds.east,z),minY=lat2y(bounds.north,z),maxY=lat2y(bounds.south,z);for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){const dir=path.join(ROOT,String(epoch),String(z),String(x));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${y}.png`),makeTile(z,x,y,epoch));total++}}}
console.log(`Generated ${total} temporal historical raster tiles for ${epochs.join(', ')}.`);
