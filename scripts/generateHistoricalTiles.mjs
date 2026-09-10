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
  return [wx * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI];
}
function lngLatToTilePixel(z, x, y, lon, lat) {
  const n = 2 ** z;
  const wx = ((lon + 180) / 360) * n;
  const r = lat * Math.PI / 180;
  const wy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  return [(wx - x) * TILE, (wy - y) * TILE];
}
function metersToPixels(z, lat, meters) {
  const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;
  return meters / mpp * (TILE / 256);
}

function noise2(lon, lat, scale = 1) {
  const a = Math.sin((lon * 511.73 + lat * 829.11) * scale);
  const b = Math.sin((lon * 1731.17 - lat * 1291.37) * scale * 0.63);
  const c = Math.sin((lon * 6321.9 + lat * 2711.4) * scale * 0.21);
  const d = Math.cos((lon * 11129.2 - lat * 7439.4) * scale * 0.11);
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
  [39.6111, 24.4672, 250, 0.0061, 0.0048],
  [39.6065, 24.4700, 110, 0.0036, 0.0028],
  [39.6160, 24.4640, 100, 0.0038, 0.0030],
  [39.6087, 24.4632, 78, 0.0030, 0.0025],
];
const buildings = [];
let bi = 0;
for (const [cx, cy, count, sx, sy] of buildingClusters) {
  for (let i = 0; i < count; i++, bi++) {
    const lon = cx + (seed(bi * 13 + 1) - .5) * sx;
    const lat = cy + (seed(bi * 13 + 2) - .5) * sy;
    const w = 7 + seed(bi * 13 + 3) * 15;
    const h = 6 + seed(bi * 13 + 4) * 13;
    const ang = (seed(bi * 13 + 5) - .5) * 0.42;
    buildings.push({
      lon, lat, w, h, ang,
      tone: seed(bi * 13 + 6),
      courtyard: seed(bi * 13 + 7) > .58,
      roofPatch: seed(bi * 13 + 8),
      wall: seed(bi * 13 + 9) > .72,
    });
  }
}

const palms = [];
for (let i = 0; i < 980; i++) {
  const f = farms[i % farms.length];
  const a = seed(i * 7 + 1) * Math.PI * 2;
  const r = Math.sqrt(seed(i * 7 + 2));
  palms.push({
    lon: f[0] + Math.cos(a) * f[2] * r * .92,
    lat: f[1] + Math.sin(a) * f[3] * r * .92,
    size: 2.3 + seed(i * 7 + 3) * 3.2,
    rotation: seed(i * 7 + 4) * Math.PI,
  });
}

function setPixel(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const i = (Math.floor(y) * TILE + Math.floor(x)) * 4;
  const k = a / 255, ik = 1 - k;
  buf[i] = clamp(buf[i] * ik + r * k);
  buf[i + 1] = clamp(buf[i + 1] * ik + g * k);
  buf[i + 2] = clamp(buf[i + 2] * ik + b * k);
  buf[i + 3] = 255;
}
function drawDisc(buf, cx, cy, rad, color, alpha = 255) {
  const r2 = rad * rad;
  for (let yy = Math.floor(cy-rad); yy <= Math.ceil(cy+rad); yy++) {
    for (let xx = Math.floor(cx-rad); xx <= Math.ceil(cx+rad); xx++) {
      const dx = xx-cx, dy = yy-cy;
      if (dx*dx+dy*dy <= r2) setPixel(buf,xx,yy,color[0],color[1],color[2],alpha);
    }
  }
}
function drawLine(buf, x0, y0, x1, y1, width, color, alpha = 255) {
  const dx = x1-x0, dy = y1-y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx,dy)));
  for (let i=0;i<=steps;i++) {
    const t=i/steps;
    drawDisc(buf,x0+dx*t,y0+dy*t,width/2,color,alpha);
  }
}
function drawPolyline(buf, points, width, color, alpha = 255) {
  for (let i=0;i<points.length-1;i++) drawLine(buf,points[i][0],points[i][1],points[i+1][0],points[i+1][1],width,color,alpha);
}
function drawRotRect(buf, cx, cy, w, h, ang, color, alpha = 255) {
  const hw=w/2, hh=h/2, c=Math.cos(ang), s=Math.sin(ang);
  const rad=Math.ceil(Math.sqrt(hw*hw+hh*hh));
  for(let yy=Math.floor(cy-rad);yy<=Math.ceil(cy+rad);yy++) {
    for(let xx=Math.floor(cx-rad);xx<=Math.ceil(cx+rad);xx++) {
      const dx=xx-cx,dy=yy-cy, rx=dx*c+dy*s, ry=-dx*s+dy*c;
      if(Math.abs(rx)<=hw && Math.abs(ry)<=hh) setPixel(buf,xx,yy,color[0],color[1],color[2],alpha);
    }
  }
}

function makeTile(z,x,y) {
  const buf = Buffer.alloc(TILE*TILE*4);

  // Continuous aerial ground texture: compacted earth, gravel and subtle moisture variation.
  for(let py=0;py<TILE;py++) {
    for(let px=0;px<TILE;px++) {
      const [lon,lat]=tilePixelToLngLat(z,x,y,px,py);
      const broad=noise2(lon,lat,.72), mid=noise2(lon,lat,3.7), fine=noise2(lon,lat,16.5);
      let r=184+broad*18+mid*7+fine*3.5;
      let g=160+broad*14+mid*6+fine*3.0;
      let b=118+broad*10+mid*4+fine*2.4;

      let inFarm=false;
      for(const [cx,cy,rx,ry] of farms) {
        if(pointInEllipse(lon,lat,cx,cy,rx,ry)) {
          inFarm=true;
          const fn=noise2(lon,lat,11), rows=Math.sin((lon*9400 + lat*6800));
          r=121+fn*13+rows*4; g=116+fn*16+rows*6; b=73+fn*8+rows*2;
          break;
        }
      }

      // Subtle dry wadi traces. No active lava or dramatic volcanic fields in the settlement core.
      const w1=Math.abs(Math.sin((lon-39.599)*124 + (lat-24.456)*79));
      const w2=Math.abs(Math.sin((lon-39.615)*96 - (lat-24.462)*117));
      if(!inFarm && (w1<.035 || w2<.024) && lat<24.480) { r-=13; g-=10; b-=7; }

      // Tiny gravel/surface speckle visible only at close source resolution.
      const grain=seed(Math.floor((lon+180)*1700000)+Math.floor((lat+90)*1900000));
      if(grain>.985) { r-=18; g-=17; b-=14; }

      setPixel(buf,px,py,clamp(r),clamp(g),clamp(b));
    }
  }

  // Worn earth tracks embedded into the raster, with softer irregular edges.
  for (let ri=0;ri<routes.length;ri++) {
    const pts=routes[ri].map(([lon,lat])=>lngLatToTilePixel(z,x,y,lon,lat));
    const baseW=metersToPixels(z,24.467,ri<3?5.4:3.0);
    drawPolyline(buf,pts,baseW*1.65,[107,88,63],55);
    drawPolyline(buf,pts,baseW,[199,177,136],165);
    drawPolyline(buf,pts,Math.max(.7,baseW*.28),[215,193,151],75);
  }

  // Mud-brick compounds, roof weathering, courtyard voids, perimeter walls and cast shadows.
  for(const bld of buildings) {
    const [cx,cy]=lngLatToTilePixel(z,x,y,bld.lon,bld.lat);
    const wp=metersToPixels(z,bld.lat,bld.w), hp=metersToPixels(z,bld.lat,bld.h);
    if(cx+wp*2<0||cy+hp*2<0||cx-wp*2>TILE||cy-hp*2>TILE) continue;

    const shadowX=Math.max(1.0,metersToPixels(z,bld.lat,1.4));
    const shadowY=Math.max(1.2,metersToPixels(z,bld.lat,1.9));
    drawRotRect(buf,cx+shadowX,cy+shadowY,wp*1.03,hp*1.03,bld.ang,[54,43,34],105);

    const t=bld.tone;
    const roof=[clamp(151+t*28),clamp(111+t*22),clamp(76+t*15)];
    drawRotRect(buf,cx,cy,wp,hp,bld.ang,roof,255);

    // Sunlit parapet edges.
    drawRotRect(buf,cx-wp*.02,cy-hp*.02,wp*.94,hp*.94,bld.ang,[clamp(roof[0]+13),clamp(roof[1]+11),clamp(roof[2]+8)],42);

    if(bld.courtyard && wp>7 && hp>7) {
      drawRotRect(buf,cx,cy,wp*.42,hp*.38,bld.ang,[174,148,104],230);
      drawRotRect(buf,cx+shadowX*.3,cy+shadowY*.3,wp*.31,hp*.27,bld.ang,[148,124,88],95);
    } else if(wp>7 && hp>7) {
      const ox=(bld.roofPatch-.5)*wp*.28;
      drawRotRect(buf,cx+ox,cy-hp*.13,wp*.32,hp*.24,bld.ang,[186,143,98],90);
    }

    if(bld.wall && z>=16) {
      drawRotRect(buf,cx-wp*.62,cy+hp*.52,wp*.58,Math.max(1,metersToPixels(z,bld.lat,.55)),bld.ang,[137,100,68],205);
    }
  }

  // Date palms rendered as radial crowns rather than green dots.
  for(const p of palms) {
    const [cx,cy]=lngLatToTilePixel(z,x,y,p.lon,p.lat);
    const rad=Math.max(1.2,metersToPixels(z,p.lat,p.size));
    if(cx+rad*2<0||cy+rad*2<0||cx-rad*2>TILE||cy-rad*2>TILE) continue;

    drawDisc(buf,cx+rad*.58,cy+rad*.72,rad*.82,[42,36,27],70);
    if(z>=15) {
      for(let j=0;j<9;j++) {
        const a=p.rotation+j/9*Math.PI*2;
        const len=rad*(.78 + seed(j+p.lon*1000)*.34);
        drawLine(buf,cx,cy,cx+Math.cos(a)*len,cy+Math.sin(a)*len,Math.max(.65,rad*.22),[48,79,42],215);
      }
    }
    drawDisc(buf,cx,cy,rad*.44,[60,91,48],220);
    drawDisc(buf,cx,cy,Math.max(.55,rad*.12),[98,72,42],220);
  }

  return png(buf,TILE,TILE);
}

function crc32(buf) {
  let c=0xffffffff;
  for(const byte of buf) { c^=byte; for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0); }
  return (c^0xffffffff)>>>0;
}
function chunk(type,data) {
  const t=Buffer.from(type), len=Buffer.alloc(4), crc=Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([len,t,data,crc]);
}
function png(rgba,w,h) {
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++) { raw[y*(w*4+1)]=0; rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4); }
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
}

fs.rmSync(OUT,{recursive:true,force:true});
let total=0;
for(const z of [13,14,15,16,17]) {
  const minX=lon2x(bounds.west,z), maxX=lon2x(bounds.east,z);
  const minY=lat2y(bounds.north,z), maxY=lat2y(bounds.south,z);
  for(let x=minX;x<=maxX;x++) for(let y=minY;y<=maxY;y++) {
    const dir=path.join(OUT,String(z),String(x));
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,`${y}.png`),makeTile(z,x,y));
    total++;
  }
}
console.log(`Generated ${total} high-detail historical raster tiles.`);
