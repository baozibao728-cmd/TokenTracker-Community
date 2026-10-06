'use strict';
// Documentation-only preview renderer. Actual-size pixels are copied unchanged.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const { parseMaster, renderPng } = require('./generate-brand-icons.cjs');
const root = path.resolve(__dirname, '..');
const patterns = {
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'], '2':['111','001','111','100','111'],
  '3':['111','001','111','001','111'], '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'], '8':['111','101','111','101','111'], 'P':['110','101','110','100','100'],
  'X':['101','101','010','101','101'], 'O':['111','101','101','101','111'], 'L':['100','100','100','100','111'],
  'D':['110','101','101','101','110'], 'N':['101','111','111','111','101'], 'E':['111','100','110','100','111'],
  'W':['101','101','111','111','101'], ' ':['000','000','000','000','000']
};
function canvas(width, height) {
  const png = new PNG({ width, height });
  for (let i=0; i<png.data.length; i+=4) { png.data[i]=png.data[i+1]=png.data[i+2]=232; png.data[i+3]=255; }
  return png;
}
function label(png, text, x, y) {
  for (const [index, letter] of [...text].entries()) for (let row=0;row<5;row++) for(let col=0;col<3;col++) {
    if (!patterns[letter] || patterns[letter][row][col] !== '1') continue;
    for(let sy=0;sy<2;sy++) for(let sx=0;sx<2;sx++) {
      const offset=((y+row*2+sy)*png.width+x+index*8+col*2+sx)*4;
      png.data[offset]=png.data[offset+1]=png.data[offset+2]=36;
    }
  }
}
function paste(target, source, x, y, size=source.width) {
  for (let sy=0;sy<size;sy++) for(let sx=0;sx<size;sx++) {
    const from=(Math.floor(sy*source.height/size)*source.width+Math.floor(sx*source.width/size))*4;
    const to=((y+sy)*target.width+x+sx)*4, alpha=source.data[from+3]/255;
    for(let c=0;c<3;c++) target.data[to+c]=Math.round(source.data[from+c]*alpha+target.data[to+c]*(1-alpha));
  }
}
function previews() {
  const paths=parseMaster(fs.readFileSync(path.join(root,'assets/brand/app-icon.svg'),'utf8'));
  const out=path.join(root,'assets/brand/previews'); fs.mkdirSync(out,{recursive:true});
  const actual=canvas(528,320);
  for(const [i,size] of [16,32,48,256].entries()) {
    const x=[24,88,176,248][i]; label(actual,`${size} PX`,x,18);
    paste(actual,PNG.sync.read(renderPng(paths,size)),x,48);
  }
  fs.writeFileSync(path.join(out,'actual-sizes.png'),PNG.sync.write(actual));
  const comparison=canvas(568,312);
  label(comparison,'OLD',28,18); label(comparison,'NEW',300,18);
  paste(comparison,PNG.sync.read(fs.readFileSync(path.join(root,'assets/brand/previous-icon.png'))),20,44,256);
  paste(comparison,PNG.sync.read(renderPng(paths,256)),292,44);
  fs.writeFileSync(path.join(out,'old-new.png'),PNG.sync.write(comparison));
  const pixel=canvas(384,144);
  for(const [i,size] of [16,32,48].entries()) { label(pixel,`${size} PX`,i*128+12,8); paste(pixel,PNG.sync.read(renderPng(paths,size)),i*128+12,28,96); }
  fs.writeFileSync(path.join(out,'small-pixels.png'),PNG.sync.write(pixel));
}
if(require.main===module) previews();
module.exports={previews};
