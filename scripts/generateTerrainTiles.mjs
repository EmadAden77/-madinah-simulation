import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE = 256;
const OUT = path.join(process.cwd(), 'public', 'terrain');
const bounds = { west: 39.57, south: 24.43, east: 39.655, north: 24.505 };

function lon2x(lon,z){return Math.floor(((lon+180)/360)*2**z)}
function lat2y(lat,z){const r=lat*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z)}
function tilePixelToLngLat(z,x,y,px,py){const n=2**z,wx=(x+px/TILE)/n,wy=(y+py/TILE)/n;return [wx*360-180,Math.atan(Math.sinh(Math.PI*(1-2*wy)))*180/Math.PI]}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

function smoothNoise(lon,lat){
  const a=Math.sin((lon*37.1+lat*53.7)*2.2);
  const b=Math.sin((lon*91.3-lat*71.9)*1.1);
  const c=Math.cos((lon*17.8+lat*29.4)*4.1);
  return (a*.52+b*.31+c*.17);
}

function gaussian(lon,lat,cx,cy,sx,sy,h){
  const dx=(lon-cx)/sx,dy=(lat-cy)/sy;
  return h*Math.exp(-(dx*dx+dy*dy)*1.55);
}

function elevationAt(lon,lat){
  // Educational terrain reconstruction: subdued relief around the oasis core.
  let e=620;
  e += smoothNoise(lon,lat)*7;

  // Broad surrounding rises, deliberately kept outside the central settlement.
  e += gaussian(lon,lat,39.646,24.480,.010,.015,46);
  e += gaussian(lon,lat,39.575,24.482,.013,.018,33);
  e += gaussian(lon,lat,39.631,24.446,.018,.010,28);
  e += gaussian(lon,lat,39.592,24.500,.016,.012,24);

  // Oasis bowl and dry drainage tendencies.
  e -= gaussian(lon,lat,39.611,24.468,.018,.014,11);
  const wadi1=Math.exp(-Math.pow(Math.sin((lon-39.596)*95+(lat-24.453)*58)/.16,2));
  const wadi2=Math.exp(-Math.pow(Math.sin((lon-39.618)*74-(lat-24.460)*86)/.17,2));
  e -= (wadi1*3.8 + wadi2*2.6);

  // Keep the central settlement gently graded rather than dramatically sculpted.
  const dx=(lon-39.6114)*101500,dy=(lat-24.4675)*111320;
  const d=Math.hypot(dx,dy);
  if(d<420){
    const k=1-d/420;
    e=e*(1-k*.55)+619.5*(k*.55);
  }
  return e;
}

function encodeTerrainRGB(elev){
  const value=Math.round((elev+10000)*10);
  return [(value>>16)&255,(value>>8)&255,value&255,255];
}

function crc32(buf){let c=0xffffffff;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
function png(rgba,w,h){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4)}const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:7})),chunk('IEND',Buffer.alloc(0))])}

function makeTile(z,x,y){
  const buf=Buffer.alloc(TILE*TILE*4);
  for(let py=0;py<TILE;py++)for(let px=0;px<TILE;px++){
    const [lon,lat]=tilePixelToLngLat(z,x,y,px,py);
    const [r,g,b,a]=encodeTerrainRGB(elevationAt(lon,lat));
    const i=(py*TILE+px)*4;buf[i]=r;buf[i+1]=g;buf[i+2]=b;buf[i+3]=a;
  }
  return png(buf,TILE,TILE);
}

fs.rmSync(OUT,{recursive:true,force:true});
let total=0;
for(const z of [11,12,13,14,15]){
  const minX=lon2x(bounds.west,z),maxX=lon2x(bounds.east,z),minY=lat2y(bounds.north,z),maxY=lat2y(bounds.south,z);
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
    const dir=path.join(OUT,String(z),String(x));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${y}.png`),makeTile(z,x,y));total++;
  }
}
console.log(`Generated ${total} local Terrain-RGB DEM tiles.`);
