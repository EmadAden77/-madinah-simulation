import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE = 512;
const OUT = path.join(process.cwd(), 'public', 'tiles');
const bounds = { west: 39.585, south: 24.445, east: 39.640, north: 24.490 };

function seed(n) { const x = Math.sin(n * 9187.123) * 43758.5453; return x - Math.floor(x); }
function clamp(v, a = 0, b = 255) { return Math.max(a, Math.min(b, v)); }
function lon2x(lon, z) { return Math.floor(((lon + 180) / 360) * 2 ** z); }
function lat2y(lat, z) { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); }
function tilePixelToLngLat(z, x, y, px, py) {
  const n = 2 ** z, wx = (x + px / TILE) / n, wy = (y + py / TILE) / n;
  return [wx * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI];
}
function lngLatToTilePixel(z, x, y, lon, lat) {
  const n = 2 ** z, wx = ((lon + 180) / 360) * n, r = lat * Math.PI / 180;
  const wy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  return [(wx - x) * TILE, (wy - y) * TILE];
}
function metersToPixels(z, lat, meters) {
  const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;
  return meters / mpp * (TILE / 256);
}
function noise2(lon, lat, scale = 1) {
  const a = Math.sin((lon * 511.73 + lat * 829.11) * scale);
  const b = Math.sin((lon * 1731.17 - lat * 1291.37) * scale * .63);
  const c = Math.sin((lon * 6321.9 + lat * 2711.4) * scale * .21);
  const d = Math.cos((lon * 11129.2 - lat * 7439.4) * scale * .11);
  return (a + b * .55 + c * .28 + d * .16) / 1.99;
}
function pointInEllipse(lon, lat, cx, cy, rx, ry) {
  const dx = (lon - cx) / rx, dy = (lat - cy) / ry;
  return dx * dx + dy * dy < 1;
}

const farms = [
  [39.6010, 24.4690, 0.0075, 0.0060],
  [39.6168, 24.4617, 0.0068, 0.0050],
  [39.6042, 24.4790, 0.0060, 0.0046],
  [39.6125, 24.4746, 0.0044, 0.0034],
];

const routes = [
  [[39.592,24.457],[39.599,24.461],[39.605,24.465],[39.611,24.467],[39.618,24.471],[39.627,24.477]],
  [[39.600,24.482],[39.604,24.475],[39.608,24.470],[39.611,24.467],[39.616,24.460],[39.621,24.453]],
  [[39.594,24.470],[39.601,24.469],[39.607,24.468],[39.611,24.467],[39.619,24.466],[39.629,24.464]],
  [[39.603,24.462],[39.606,24.464],[39.608,24.467],[39.611,24.470],[39.614,24.473]],
  [[39.606,24.474],[39.609,24.471],[39.612,24.468],[39.616,24.465]],
];

const buildingClusters = [
  [39.6111, 24.4672, 165, 0.0062, 0.0048],
  [39.6065, 24.4700, 72, 0.0038, 0.0029],
  [39.6160, 24.4640, 68, 0.0040, 0.0031],
  [39.6087, 24.4632, 54, 0.0032, 0.0026],
];

const compounds = [];
let ci = 0;
for (const [cx, cy, count, sx, sy] of buildingClusters) {
  for (let i = 0; i < count; i++, ci++) {
    const lon = cx + (seed(ci * 23 + 1) - .5) * sx;
    const lat = cy + (seed(ci * 23 + 2) - .5) * sy;
    const w = 13 + seed(ci * 23 + 3) * 22;
    const h = 11 + seed(ci * 23 + 4) * 19;
    const ang = (seed(ci * 23 + 5) - .5) * .36;
    const parts = 2 + Math.floor(seed(ci * 23 + 6) * 4);
    compounds.push({ lon, lat, w, h, ang, parts, tone: seed(ci * 23 + 7), yard: seed(ci * 23 + 8) > .22, wall: seed(ci * 23 + 9) > .38, id: ci });
  }
}

const palms = [];
for (let i = 0; i < 1180; i++) {
  const f = farms[i % farms.length];
  const a = seed(i * 7 + 1) * Math.PI * 2, r = Math.sqrt(seed(i * 7 + 2));
  palms.push({
    lon: f[0] + Math.cos(a) * f[2] * r * .94,
    lat: f[1] + Math.sin(a) * f[3] * r * .94,
    size: 2.3 + seed(i * 7 + 3) * 3.4,
    rotation: seed(i * 7 + 4) * Math.PI * 2,
  });
}

const farmPlots = [];
for (let i = 0; i < 110; i++) {
  const f = farms[i % farms.length];
  const a = seed(i * 17 + 1) * Math.PI * 2, rr = Math.sqrt(seed(i * 17 + 2)) * .82;
  farmPlots.push({
    lon: f[0] + Math.cos(a) * f[2] * rr,
    lat: f[1] + Math.sin(a) * f[3] * rr,
    w: 25 + seed(i * 17 + 3) * 70,
    h: 18 + seed(i * 17 + 4) * 55,
    ang: (seed(i * 17 + 5) - .5) * .5,
    tone: seed(i * 17 + 6)
  });
}

function setPixel(buf, x, y, r, g, b, a = 255) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const i = (y * TILE + x) * 4, k = a / 255, ik = 1 - k;
  buf[i] = clamp(buf[i] * ik + r * k); buf[i+1] = clamp(buf[i+1] * ik + g * k); buf[i+2] = clamp(buf[i+2] * ik + b * k); buf[i+3] = 255;
}
function drawDisc(buf, cx, cy, rad, color, alpha = 255) {
  const r2 = rad * rad;
  for (let yy = Math.floor(cy-rad); yy <= Math.ceil(cy+rad); yy++) for (let xx = Math.floor(cx-rad); xx <= Math.ceil(cx+rad); xx++) {
    const dx = xx-cx, dy = yy-cy; if (dx*dx+dy*dy <= r2) setPixel(buf,xx,yy,color[0],color[1],color[2],alpha);
  }
}
function drawLine(buf,x0,y0,x1,y1,width,color,alpha=255) {
  const dx=x1-x0,dy=y1-y0,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));
  for(let i=0;i<=steps;i++){const t=i/steps;drawDisc(buf,x0+dx*t,y0+dy*t,width/2,color,alpha);}
}
function drawPolyline(buf,points,width,color,alpha=255){for(let i=0;i<points.length-1;i++)drawLine(buf,points[i][0],points[i][1],points[i+1][0],points[i+1][1],width,color,alpha);}
function drawRotRect(buf,cx,cy,w,h,ang,color,alpha=255){
  const hw=w/2,hh=h/2,c=Math.cos(ang),s=Math.sin(ang),rad=Math.ceil(Math.sqrt(hw*hw+hh*hh));
  for(let yy=Math.floor(cy-rad);yy<=Math.ceil(cy+rad);yy++)for(let xx=Math.floor(cx-rad);xx<=Math.ceil(cx+rad);xx++){
    const dx=xx-cx,dy=yy-cy,rx=dx*c+dy*s,ry=-dx*s+dy*c;if(Math.abs(rx)<=hw&&Math.abs(ry)<=hh)setPixel(buf,xx,yy,color[0],color[1],color[2],alpha);
  }
}
function rotOffset(dx,dy,a){const c=Math.cos(a),s=Math.sin(a);return [dx*c-dy*s,dx*s+dy*c];}

function drawCompound(buf,z,x,y,c){
  const [cx,cy]=lngLatToTilePixel(z,x,y,c.lon,c.lat);
  const wp=metersToPixels(z,c.lat,c.w), hp=metersToPixels(z,c.lat,c.h);
  if(cx+wp*2<0||cy+hp*2<0||cx-wp*2>TILE||cy-hp*2>TILE)return;
  const wallPx=Math.max(.7,metersToPixels(z,c.lat,.6));
  const sx=Math.max(1.1,metersToPixels(z,c.lat,1.6)), sy=Math.max(1.3,metersToPixels(z,c.lat,2.0));

  if(c.wall&&z>=15){
    drawRotRect(buf,cx+sx*.6,cy+sy*.7,wp*1.12,hp*1.12,c.ang,[64,49,37],70);
    drawRotRect(buf,cx,cy,wp*1.1,hp*1.1,c.ang,[133,96,65],215);
    drawRotRect(buf,cx,cy,Math.max(1,wp*1.1-wallPx*2.2),Math.max(1,hp*1.1-wallPx*2.2),c.ang,[176,146,101],245);
  }

  const t=c.tone, roof=[clamp(148+t*32),clamp(108+t*24),clamp(73+t*17)];
  for(let p=0;p<c.parts;p++){
    const side=p%4;
    const frac=.38+seed(c.id*31+p*7+1)*.22;
    let dx=0,dy=0,pw=wp*.34,ph=hp*.34;
    if(side===0){dy=-hp*.34;dx=(seed(c.id*37+p)-.5)*wp*.28;pw=wp*frac;ph=hp*.28;}
    if(side===1){dx=wp*.34;dy=(seed(c.id*41+p)-.5)*hp*.28;pw=wp*.28;ph=hp*frac;}
    if(side===2){dy=hp*.34;dx=(seed(c.id*43+p)-.5)*wp*.28;pw=wp*frac;ph=hp*.28;}
    if(side===3){dx=-wp*.34;dy=(seed(c.id*47+p)-.5)*hp*.28;pw=wp*.28;ph=hp*frac;}
    const [ox,oy]=rotOffset(dx,dy,c.ang);
    drawRotRect(buf,cx+ox+sx,cy+oy+sy,pw*1.03,ph*1.03,c.ang,[51,40,31],105);
    const variation=(seed(c.id*59+p)-.5)*16;
    const rc=[clamp(roof[0]+variation),clamp(roof[1]+variation*.8),clamp(roof[2]+variation*.55)];
    drawRotRect(buf,cx+ox,cy+oy,pw,ph,c.ang,rc,255);
    if(z>=16){
      const [bx1,by1]=rotOffset(-pw*.35,-ph*.33,c.ang),[bx2,by2]=rotOffset(pw*.35,-ph*.33,c.ang);
      drawLine(buf,cx+ox+bx1,cy+oy+by1,cx+ox+bx2,cy+oy+by2,Math.max(.6,wallPx*.7),[201,160,111],95);
    }
  }
  if(c.yard){
    drawRotRect(buf,cx,cy,wp*.44,hp*.39,c.ang,[171,145,103],205);
    if(z>=16){
      for(let k=0;k<3;k++){
        const [ox,oy]=rotOffset((seed(c.id*71+k)-.5)*wp*.26,(seed(c.id*79+k)-.5)*hp*.22,c.ang);
        drawDisc(buf,cx+ox,cy+oy,Math.max(.6,metersToPixels(z,c.lat,.45)),[101,77,51],120);
      }
    }
  }
}

function makeTile(z,x,y){
  const buf=Buffer.alloc(TILE*TILE*4);
  for(let py=0;py<TILE;py++)for(let px=0;px<TILE;px++){
    const [lon,lat]=tilePixelToLngLat(z,x,y,px,py);
    const broad=noise2(lon,lat,.72),mid=noise2(lon,lat,3.7),fine=noise2(lon,lat,16.5);
    let r=184+broad*18+mid*7+fine*3.5,g=160+broad*14+mid*6+fine*3,b=118+broad*10+mid*4+fine*2.4;
    let inFarm=false;
    for(const [cx,cy,rx,ry] of farms)if(pointInEllipse(lon,lat,cx,cy,rx,ry)){
      inFarm=true;const fn=noise2(lon,lat,11),rows=Math.sin(lon*9400+lat*6800);r=121+fn*13+rows*4;g=116+fn*16+rows*6;b=73+fn*8+rows*2;break;
    }
    const w1=Math.abs(Math.sin((lon-39.599)*124+(lat-24.456)*79)),w2=Math.abs(Math.sin((lon-39.615)*96-(lat-24.462)*117));
    if(!inFarm&&(w1<.035||w2<.024)&&lat<24.480){r-=13;g-=10;b-=7;}
    const grain=seed(Math.floor((lon+180)*1700000)+Math.floor((lat+90)*1900000));if(grain>.985){r-=18;g-=17;b-=14;}
    setPixel(buf,px,py,clamp(r),clamp(g),clamp(b));
  }

  // Agricultural parcels: subtle plot boundaries and irrigation channels embedded in the aerial raster.
  if(z>=15){
    for(let i=0;i<farmPlots.length;i++){
      const p=farmPlots[i],[cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat);
      const wp=metersToPixels(z,p.lat,p.w),hp=metersToPixels(z,p.lat,p.h);
      if(cx+wp<0||cy+hp<0||cx-wp>TILE||cy-hp>TILE)continue;
      const shade=90+p.tone*18;
      drawRotRect(buf,cx,cy,wp,hp,p.ang,[shade,105+p.tone*18,63+p.tone*8],28);
      const edge=Math.max(.6,metersToPixels(z,p.lat,.45));
      const [a1,b1]=rotOffset(-wp*.5,-hp*.5,p.ang),[a2,b2]=rotOffset(wp*.5,-hp*.5,p.ang);
      drawLine(buf,cx+a1,cy+b1,cx+a2,cy+b2,edge,[87,75,48],75);
      if(z>=16&&i%3===0){
        const [q1,r1]=rotOffset(-wp*.42,0,p.ang),[q2,r2]=rotOffset(wp*.42,0,p.ang);
        drawLine(buf,cx+q1,cy+r1,cx+q2,cy+r2,Math.max(.7,edge*.7),[79,72,48],85);
      }
    }
  }

  // Worn routes with soft dusty shoulders.
  for(let ri=0;ri<routes.length;ri++){
    const pts=routes[ri].map(([lon,lat])=>lngLatToTilePixel(z,x,y,lon,lat));
    const baseW=metersToPixels(z,24.467,ri<3?5.4:3.0);
    drawPolyline(buf,pts,baseW*1.8,[105,87,63],48);drawPolyline(buf,pts,baseW*1.18,[198,177,137],145);drawPolyline(buf,pts,Math.max(.7,baseW*.3),[218,197,157],58);
  }

  for(const c of compounds)drawCompound(buf,z,x,y,c);

  // Date palms: radial crowns, trunk cores and directional shadows.
  for(const p of palms){
    const [cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat),rad=Math.max(1.15,metersToPixels(z,p.lat,p.size));
    if(cx+rad*2<0||cy+rad*2<0||cx-rad*2>TILE||cy-rad*2>TILE)continue;
    drawDisc(buf,cx+rad*.68,cy+rad*.82,rad*.86,[39,34,26],68);
    if(z>=15)for(let j=0;j<11;j++){
      const a=p.rotation+j/11*Math.PI*2,len=rad*(.78+seed(j+p.lon*1000)*.38);
      drawLine(buf,cx,cy,cx+Math.cos(a)*len,cy+Math.sin(a)*len,Math.max(.58,rad*.18),[45,76,40],205);
    }
    drawDisc(buf,cx,cy,rad*.46,[61,92,49],205);drawDisc(buf,cx,cy,Math.max(.5,rad*.11),[96,70,41],225);
  }
  return png(buf,TILE,TILE);
}

function crc32(buf){let c=0xffffffff;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function png(rgba,w,h){
  const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
  const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
}

fs.rmSync(OUT,{recursive:true,force:true});
let total=0;
for(const z of [13,14,15,16,17]){
  const minX=lon2x(bounds.west,z),maxX=lon2x(bounds.east,z),minY=lat2y(bounds.north,z),maxY=lat2y(bounds.south,z);
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
    const dir=path.join(OUT,String(z),String(x));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${y}.png`),makeTile(z,x,y));total++;
  }
}
console.log(`Generated ${total} high-detail historical raster tiles with compounds and irrigation.`);
