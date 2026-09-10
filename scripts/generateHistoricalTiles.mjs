import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE = 512;
const OUT = path.join(process.cwd(), 'public', 'tiles');
const bounds = { west: 39.585, south: 24.445, east: 39.640, north: 24.490 };

function seed(n) {
  const x = Math.sin(n * 9187.123) * 43758.5453;
  return x - Math.floor(x);
}
function clamp(v, a = 0, b = 255) { return Math.max(a, Math.min(b, v)); }
function lon2x(lon, z) { return Math.floor(((lon + 180) / 360) * 2 ** z); }
function lat2y(lat, z) {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z);
}
function tilePixelToLngLat(z, x, y, px, py) {
  const n = 2 ** z;
  const wx = (x + px / TILE) / n;
  const wy = (y + py / TILE) / n;
  const lon = wx * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI;
  return [lon, lat];
}
function lngLatToTilePixel(z, x, y, lon, lat) {
  const n = 2 ** z;
  const wx = ((lon + 180) / 360) * n;
  const r = lat * Math.PI / 180;
  const wy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  return [(wx - x) * TILE, (wy - y) * TILE];
}

function noise2(lon, lat, scale = 1) {
  const a = Math.sin((lon * 511.73 + lat * 829.11) * scale);
  const b = Math.sin((lon * 1731.17 - lat * 1291.37) * scale * 0.63);
  const c = Math.sin((lon * 6321.9 + lat * 2711.4) * scale * 0.21);
  return (a + b * 0.55 + c * 0.28) / 1.83;
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

const buildingClusters = [
  [39.6111, 24.4672, 210, 0.0060, 0.0046],
  [39.6065, 24.4700, 95, 0.0033, 0.0027],
  [39.6160, 24.4640, 85, 0.0035, 0.0028],
  [39.6087, 24.4632, 65, 0.0028, 0.0023],
];
const buildings = [];
let bi = 0;
for (const [cx, cy, count, sx, sy] of buildingClusters) {
  for (let i = 0; i < count; i++, bi++) {
    const lon = cx + (seed(bi * 11 + 1) - .5) * sx;
    const lat = cy + (seed(bi * 11 + 2) - .5) * sy;
    const w = 7 + seed(bi * 11 + 3) * 14;
    const h = 6 + seed(bi * 11 + 4) * 12;
    const ang = (seed(bi * 11 + 5) - .5) * 0.55;
    buildings.push({ lon, lat, w, h, ang, tone: seed(bi * 11 + 6) });
  }
}

const palms = [];
for (let i = 0; i < 760; i++) {
  const f = farms[i % farms.length];
  const a = seed(i * 7 + 1) * Math.PI * 2;
  const r = Math.sqrt(seed(i * 7 + 2));
  const lon = f[0] + Math.cos(a) * f[2] * r * 0.92;
  const lat = f[1] + Math.sin(a) * f[3] * r * 0.92;
  palms.push({ lon, lat, size: 2.2 + seed(i * 7 + 3) * 2.8 });
}

function setPixel(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  if (a === 255) { buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255; return; }
  const k = a / 255, ik = 1 - k;
  buf[i] = buf[i] * ik + r * k;
  buf[i+1] = buf[i+1] * ik + g * k;
  buf[i+2] = buf[i+2] * ik + b * k;
  buf[i+3] = 255;
}
function drawDisc(buf, cx, cy, rad, color, alpha = 255) {
  const r2 = rad * rad;
  for (let y = Math.floor(cy-rad); y <= Math.ceil(cy+rad); y++) {
    for (let x = Math.floor(cx-rad); x <= Math.ceil(cx+rad); x++) {
      const dx=x-cx, dy=y-cy;
      if (dx*dx+dy*dy <= r2) setPixel(buf,x,y,color[0],color[1],color[2],alpha);
    }
  }
}
function drawRotRect(buf, cx, cy, w, h, ang, color, alpha = 255) {
  const hw=w/2, hh=h/2, c=Math.cos(ang), s=Math.sin(ang);
  const rad=Math.ceil(Math.sqrt(hw*hw+hh*hh));
  for(let y=Math.floor(cy-rad);y<=Math.ceil(cy+rad);y++){
    for(let x=Math.floor(cx-rad);x<=Math.ceil(cx+rad);x++){
      const dx=x-cx,dy=y-cy;
      const rx=dx*c+dy*s, ry=-dx*s+dy*c;
      if(Math.abs(rx)<=hw && Math.abs(ry)<=hh) setPixel(buf,x,y,color[0],color[1],color[2],alpha);
    }
  }
}

function metersToPixels(z, lat, meters) {
  const mpp = 156543.03392 * Math.cos(lat * Math.PI/180) / 2 ** z;
  return meters / mpp * (TILE / 256);
}

function makeTile(z,x,y){
  const buf = Buffer.alloc(TILE*TILE*4);
  for(let py=0;py<TILE;py++){
    for(let px=0;px<TILE;px++){
      const [lon,lat]=tilePixelToLngLat(z,x,y,px,py);
      let n=noise2(lon,lat,1.0), fine=noise2(lon,lat,6.0);
      let r=181+n*16+fine*6, g=157+n*13+fine*5, b=115+n*8+fine*4;
      for(const [cx,cy,rx,ry] of farms){
        if(pointInEllipse(lon,lat,cx,cy,rx,ry)){
          const fn=noise2(lon,lat,9);
          r=126+fn*16; g=118+fn*19; b=72+fn*11;
          break;
        }
      }
      const wadi = Math.abs(Math.sin((lon-39.599)*120 + (lat-24.456)*75));
      if(wadi<0.045 && lat<24.478){ r-=14; g-=11; b-=8; }
      setPixel(buf,px,py,clamp(r),clamp(g),clamp(b));
    }
  }

  for(const b of buildings){
    const [cx,cy]=lngLatToTilePixel(z,x,y,b.lon,b.lat);
    const wp=metersToPixels(z,b.lat,b.w), hp=metersToPixels(z,b.lat,b.h);
    if(cx+wp<0||cy+hp<0||cx-wp>TILE||cy-hp>TILE) continue;
    drawRotRect(buf,cx+Math.max(1,wp*0.14),cy+Math.max(1,hp*0.18),wp,hp,b.ang,[69,51,39],90);
    const t=b.tone;
    drawRotRect(buf,cx,cy,wp,hp,b.ang,[clamp(157+t*22),clamp(116+t*17),clamp(78+t*12)],255);
    if(wp>8 && hp>8) drawRotRect(buf,cx-wp*0.12,cy-hp*0.12,wp*0.38,hp*0.33,b.ang,[185,143,97],110);
  }

  for(const p of palms){
    const [cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat);
    const rad=Math.max(1.2,metersToPixels(z,p.lat,p.size));
    if(cx+rad<0||cy+rad<0||cx-rad>TILE||cy-rad>TILE) continue;
    drawDisc(buf,cx+rad*.55,cy+rad*.7,rad*.9,[45,39,28],80);
    drawDisc(buf,cx,cy,rad,[49,82,44],230);
    drawDisc(buf,cx-rad*.15,cy-rad*.1,rad*.55,[75,105,58],160);
    drawDisc(buf,cx+rad*.12,cy+rad*.08,Math.max(.7,rad*.18),[92,67,39],220);
  }

  return png(buf,TILE,TILE);
}

function crc32(buf){
  let c=0xffffffff;
  for(const byte of buf){
    c^=byte;
    for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0);
  }
  return (c^0xffffffff)>>>0;
}
function chunk(type,data){
  const t=Buffer.from(type); const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([len,t,data,crc]);
}
function png(rgba,w,h){
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){
    raw[y*(w*4+1)]=0;
    rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
  }
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:7})),chunk('IEND',Buffer.alloc(0))]);
}

fs.rmSync(OUT,{recursive:true,force:true});
let total=0;
for(const z of [13,14,15,16]){
  const minX=lon2x(bounds.west,z), maxX=lon2x(bounds.east,z);
  const minY=lat2y(bounds.north,z), maxY=lat2y(bounds.south,z);
  for(let x=minX;x<=maxX;x++) for(let y=minY;y<=maxY;y++){
    const dir=path.join(OUT,String(z),String(x)); fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,`${y}.png`),makeTile(z,x,y)); total++;
  }
}
console.log(`Generated ${total} historical raster tiles.`);
