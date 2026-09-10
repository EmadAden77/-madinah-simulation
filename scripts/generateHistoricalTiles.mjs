import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE = 512;
const OUT = path.join(process.cwd(), 'public', 'tiles');
const BOUNDS = { west: 39.585, south: 24.445, east: 39.640, north: 24.490 };
const CENTER = [39.6111, 24.4672];

function seed(n) { const x = Math.sin(n * 9187.123) * 43758.5453123; return x - Math.floor(x); }
function clamp(v, a = 0, b = 255) { return Math.max(a, Math.min(b, v)); }
function smooth(t) { return t * t * (3 - 2 * t); }
function hash2(x, y) { return seed(x * 157.31 + y * 911.73); }
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return ((a * (1-u) + b * u) * (1-v) + (c * (1-u) + d * u) * v) * 2 - 1;
}
function fbm(lon, lat, scale = 1) {
  let f = 0, amp = .58, freq = scale;
  for (let i = 0; i < 4; i++) {
    f += valueNoise((lon - 39.5) * 2200 * freq, (lat - 24.4) * 2200 * freq) * amp;
    freq *= 2.07; amp *= .48;
  }
  return f;
}
function lon2x(lon,z){return Math.floor(((lon+180)/360)*2**z);}
function lat2y(lat,z){const r=lat*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z);}
function tilePixelToLngLat(z,x,y,px,py){const n=2**z,wx=(x+px/TILE)/n,wy=(y+py/TILE)/n;return[wx*360-180,Math.atan(Math.sinh(Math.PI*(1-2*wy)))*180/Math.PI];}
function lngLatToTilePixel(z,x,y,lon,lat){const n=2**z,wx=((lon+180)/360)*n,r=lat*Math.PI/180,wy=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n;return[(wx-x)*TILE,(wy-y)*TILE];}
function metersToPixels(z,lat,meters){const mpp=156543.03392*Math.cos(lat*Math.PI/180)/2**z;return meters/mpp*(TILE/256);}
function rotOffset(dx,dy,a){const c=Math.cos(a),s=Math.sin(a);return[dx*c-dy*s,dx*s+dy*c];}
function pointInEllipse(lon,lat,cx,cy,rx,ry){const dx=(lon-cx)/rx,dy=(lat-cy)/ry;return dx*dx+dy*dy<1;}

// Spatial zones are reconstruction guides, not exact archaeological footprints.
const farms = [
  [39.6010,24.4690,.0077,.0061],[39.6168,24.4617,.0070,.0052],
  [39.6042,24.4790,.0062,.0048],[39.6125,24.4746,.0046,.0036]
];
const wadis = [
  [[39.590,24.485],[39.597,24.478],[39.602,24.470],[39.607,24.462],[39.612,24.452]],
  [[39.624,24.486],[39.619,24.477],[39.615,24.470],[39.612,24.462],[39.608,24.449]]
];
const routes = [
  [[39.592,24.457],[39.599,24.461],[39.605,24.465],[39.611,24.467],[39.618,24.471],[39.627,24.477]],
  [[39.600,24.482],[39.604,24.475],[39.608,24.470],[39.611,24.467],[39.616,24.460],[39.621,24.453]],
  [[39.594,24.470],[39.601,24.469],[39.607,24.468],[39.611,24.467],[39.619,24.466],[39.629,24.464]],
  [[39.603,24.462],[39.606,24.464],[39.608,24.467],[39.611,24.470],[39.614,24.473]],
  [[39.606,24.474],[39.609,24.471],[39.612,24.468],[39.616,24.465]]
];

const clusters = [
  [39.6111,24.4672,170,.0063,.0049],[39.6065,24.4700,76,.0039,.0030],
  [39.6160,24.4640,72,.0041,.0032],[39.6087,24.4632,58,.0033,.0027]
];
const compounds=[];let ci=0;
for(const[cx,cy,count,sx,sy]of clusters){for(let i=0;i<count;i++,ci++){
  const rr=Math.sqrt(seed(ci*19+1)),a=seed(ci*19+2)*Math.PI*2;
  const lon=cx+Math.cos(a)*sx*.5*rr,lat=cy+Math.sin(a)*sy*.5*rr;
  compounds.push({id:ci,lon,lat,w:13+seed(ci*19+3)*24,h:11+seed(ci*19+4)*21,ang:(seed(ci*19+5)-.5)*.46,parts:2+Math.floor(seed(ci*19+6)*4),tone:seed(ci*19+7),yard:seed(ci*19+8)>.16,wall:seed(ci*19+9)>.33,store:seed(ci*19+10)>.88});
}}

const palms=[];
for(let i=0;i<1320;i++){
  const f=farms[i%farms.length],a=seed(i*7+1)*Math.PI*2,r=Math.sqrt(seed(i*7+2));
  palms.push({lon:f[0]+Math.cos(a)*f[2]*r*.94,lat:f[1]+Math.sin(a)*f[3]*r*.94,size:2.2+seed(i*7+3)*3.6,rotation:seed(i*7+4)*Math.PI*2});
}

const farmPlots=[];
for(let i=0;i<150;i++){
  const f=farms[i%farms.length],a=seed(i*17+1)*Math.PI*2,rr=Math.sqrt(seed(i*17+2))*.83;
  farmPlots.push({lon:f[0]+Math.cos(a)*f[2]*rr,lat:f[1]+Math.sin(a)*f[3]*rr,w:23+seed(i*17+3)*72,h:16+seed(i*17+4)*58,ang:(seed(i*17+5)-.5)*.55,tone:seed(i*17+6)});
}

function setPixel(buf,x,y,r,g,b,a=255){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=TILE||y>=TILE)return;const i=(y*TILE+x)*4,k=a/255,ik=1-k;buf[i]=clamp(buf[i]*ik+r*k);buf[i+1]=clamp(buf[i+1]*ik+g*k);buf[i+2]=clamp(buf[i+2]*ik+b*k);buf[i+3]=255;}
function drawDisc(buf,cx,cy,rad,color,alpha=255){const r2=rad*rad;for(let yy=Math.floor(cy-rad);yy<=Math.ceil(cy+rad);yy++)for(let xx=Math.floor(cx-rad);xx<=Math.ceil(cx+rad);xx++){const dx=xx-cx,dy=yy-cy;if(dx*dx+dy*dy<=r2)setPixel(buf,xx,yy,color[0],color[1],color[2],alpha);}}
function drawLine(buf,x0,y0,x1,y1,width,color,alpha=255){const dx=x1-x0,dy=y1-y0,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));for(let i=0;i<=steps;i++){const t=i/steps;drawDisc(buf,x0+dx*t,y0+dy*t,width/2,color,alpha);}}
function drawPolyline(buf,pts,width,color,alpha=255){for(let i=0;i<pts.length-1;i++)drawLine(buf,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],width,color,alpha);}
function drawRotRect(buf,cx,cy,w,h,ang,color,alpha=255){const hw=w/2,hh=h/2,c=Math.cos(ang),s=Math.sin(ang),rad=Math.ceil(Math.sqrt(hw*hw+hh*hh));for(let yy=Math.floor(cy-rad);yy<=Math.ceil(cy+rad);yy++)for(let xx=Math.floor(cx-rad);xx<=Math.ceil(cx+rad);xx++){const dx=xx-cx,dy=yy-cy,rx=dx*c+dy*s,ry=-dx*s+dy*c;if(Math.abs(rx)<=hw&&Math.abs(ry)<=hh)setPixel(buf,xx,yy,color[0],color[1],color[2],alpha);}}

function drawCompound(buf,z,x,y,c){
  const[cx,cy]=lngLatToTilePixel(z,x,y,c.lon,c.lat),wp=metersToPixels(z,c.lat,c.w),hp=metersToPixels(z,c.lat,c.h);
  if(cx+wp*2<0||cy+hp*2<0||cx-wp*2>TILE||cy-hp*2>TILE)return;
  const edge=Math.max(.7,metersToPixels(z,c.lat,.62)),sx=Math.max(1,metersToPixels(z,c.lat,1.7)),sy=Math.max(1.2,metersToPixels(z,c.lat,2.1));
  if(c.wall&&z>=15){drawRotRect(buf,cx+sx*.55,cy+sy*.65,wp*1.13,hp*1.13,c.ang,[54,42,32],76);drawRotRect(buf,cx,cy,wp*1.12,hp*1.12,c.ang,[133,96,65],225);drawRotRect(buf,cx,cy,Math.max(1,wp*1.12-edge*2.5),Math.max(1,hp*1.12-edge*2.5),c.ang,[177,148,106],252);}
  const base=[148+c.tone*31,108+c.tone*23,73+c.tone*16];
  for(let p=0;p<c.parts;p++){
    const side=p%4,frac=.38+seed(c.id*31+p*7+1)*.24;let dx=0,dy=0,pw=wp*.34,ph=hp*.34;
    if(side===0){dy=-hp*.34;dx=(seed(c.id*37+p)-.5)*wp*.30;pw=wp*frac;ph=hp*.28;}
    if(side===1){dx=wp*.34;dy=(seed(c.id*41+p)-.5)*hp*.30;pw=wp*.28;ph=hp*frac;}
    if(side===2){dy=hp*.34;dx=(seed(c.id*43+p)-.5)*wp*.30;pw=wp*frac;ph=hp*.28;}
    if(side===3){dx=-wp*.34;dy=(seed(c.id*47+p)-.5)*hp*.30;pw=wp*.28;ph=hp*frac;}
    const[ox,oy]=rotOffset(dx,dy,c.ang),v=(seed(c.id*59+p)-.5)*18,roof=[clamp(base[0]+v),clamp(base[1]+v*.78),clamp(base[2]+v*.52)];
    drawRotRect(buf,cx+ox+sx,cy+oy+sy,pw*1.04,ph*1.04,c.ang,[48,37,29],112);drawRotRect(buf,cx+ox,cy+oy,pw,ph,c.ang,roof,255);
    if(z>=16){const[q1,r1]=rotOffset(-pw*.36,-ph*.34,c.ang),[q2,r2]=rotOffset(pw*.36,-ph*.34,c.ang);drawLine(buf,cx+ox+q1,cy+oy+r1,cx+ox+q2,cy+oy+r2,Math.max(.6,edge*.72),[207,168,119],105);}
  }
  if(c.yard){drawRotRect(buf,cx,cy,wp*.46,hp*.40,c.ang,[172,146,105],220);if(z>=16){for(let k=0;k<4;k++){const[ox,oy]=rotOffset((seed(c.id*71+k)-.5)*wp*.28,(seed(c.id*79+k)-.5)*hp*.24,c.ang);drawDisc(buf,cx+ox,cy+oy,Math.max(.55,metersToPixels(z,c.lat,.42)),[100,76,51],120);}}}
  if(c.store&&z>=16){const[ox,oy]=rotOffset(wp*.2,hp*.18,c.ang);drawRotRect(buf,cx+ox,cy+oy,wp*.18,hp*.14,c.ang,[119,86,58],220);}
}

function makeTile(z,x,y){
  const buf=Buffer.alloc(TILE*TILE*4);
  for(let py=0;py<TILE;py++)for(let px=0;px<TILE;px++){
    const[lon,lat]=tilePixelToLngLat(z,x,y,px,py);
    const broad=fbm(lon,lat,.42),mid=fbm(lon+.011,lat-.007,1.45),fine=fbm(lon-.009,lat+.013,5.1);
    const radial=Math.hypot((lon-CENTER[0])*88,(lat-CENTER[1])*111);
    let r=184+broad*17+mid*6+fine*2.8,g=160+broad*14+mid*5.3+fine*2.4,b=118+broad*10+mid*4+fine*2.0;
    if(radial<.9){r-=3;g-=2;b-=1;}
    let inFarm=false;
    for(const[cx,cy,rx,ry]of farms)if(pointInEllipse(lon,lat,cx,cy,rx,ry)){inFarm=true;const n=fbm(lon,lat,2.5),moist=fbm(lon+.02,lat-.015,.8);r=121+n*12+moist*5;g=118+n*16+moist*7;b=73+n*8+moist*3;break;}
    const grain=hash2(Math.floor(lon*1500000),Math.floor(lat*1500000));if(grain>.987){r-=16;g-=15;b-=12;}else if(grain<.01){r+=10;g+=9;b+=7;}
    setPixel(buf,px,py,r,g,b);
  }

  // Dry wadi beds with broad soft shoulders and a faint darker central trace.
  for(const w of wadis){const pts=w.map(([lon,lat])=>lngLatToTilePixel(z,x,y,lon,lat)),ww=metersToPixels(z,24.467,10);drawPolyline(buf,pts,ww*2.4,[145,126,96],26);drawPolyline(buf,pts,ww,[126,109,83],36);drawPolyline(buf,pts,Math.max(.8,ww*.18),[103,91,72],28);}

  if(z>=15){
    for(let i=0;i<farmPlots.length;i++){
      const p=farmPlots[i],[cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat),wp=metersToPixels(z,p.lat,p.w),hp=metersToPixels(z,p.lat,p.h);
      if(cx+wp<0||cy+hp<0||cx-wp>TILE||cy-hp>TILE)continue;
      const shade=88+p.tone*23;drawRotRect(buf,cx,cy,wp,hp,p.ang,[shade,104+p.tone*22,61+p.tone*10],34);
      const edge=Math.max(.55,metersToPixels(z,p.lat,.42));const[a1,b1]=rotOffset(-wp*.5,-hp*.5,p.ang),[a2,b2]=rotOffset(wp*.5,-hp*.5,p.ang);drawLine(buf,cx+a1,cy+b1,cx+a2,cy+b2,edge,[78,68,45],82);
      if(z>=16&&i%2===0){for(let k=-1;k<=1;k++){const[q1,r1]=rotOffset(-wp*.40,k*hp*.18,p.ang),[q2,r2]=rotOffset(wp*.40,k*hp*.18,p.ang);drawLine(buf,cx+q1,cy+r1,cx+q2,cy+r2,Math.max(.55,edge*.65),[75,69,47],70);}}
    }
  }

  for(let ri=0;ri<routes.length;ri++){
    const pts=routes[ri].map(([lon,lat])=>lngLatToTilePixel(z,x,y,lon,lat)),w=metersToPixels(z,24.467,ri<3?5.2:2.8);
    drawPolyline(buf,pts,w*1.95,[105,88,64],44);drawPolyline(buf,pts,w*1.25,[197,177,138],142);drawPolyline(buf,pts,Math.max(.65,w*.26),[219,199,160],50);
  }

  for(const c of compounds)drawCompound(buf,z,x,y,c);

  for(const p of palms){
    const[cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat),rad=Math.max(1.1,metersToPixels(z,p.lat,p.size));if(cx+rad*2<0||cy+rad*2<0||cx-rad*2>TILE||cy-rad*2>TILE)continue;
    drawDisc(buf,cx+rad*.70,cy+rad*.84,rad*.90,[38,33,25],72);
    if(z>=15)for(let j=0;j<12;j++){const a=p.rotation+j/12*Math.PI*2,len=rad*(.75+seed(j+p.lon*1000)*.42);drawLine(buf,cx,cy,cx+Math.cos(a)*len,cy+Math.sin(a)*len,Math.max(.56,rad*.17),j%3===0?[57,88,46]:[43,74,39],210);}
    drawDisc(buf,cx,cy,rad*.43,[61,91,48],205);drawDisc(buf,cx,cy,Math.max(.5,rad*.11),[98,71,41],230);
  }
  return png(buf,TILE,TILE);
}

function crc32(buf){let c=0xffffffff;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function png(rgba,w,h){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);}

fs.rmSync(OUT,{recursive:true,force:true});
let total=0;
for(const z of [13,14,15,16,17]){
  const minX=lon2x(BOUNDS.west,z),maxX=lon2x(BOUNDS.east,z),minY=lat2y(BOUNDS.north,z),maxY=lat2y(BOUNDS.south,z);
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
    const dir=path.join(OUT,String(z),String(x));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${y}.png`),makeTile(z,x,y));total++;
  }
}
console.log(`Generated ${total} natural-texture historical raster tiles.`);
