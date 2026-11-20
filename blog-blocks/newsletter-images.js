// FOSTBeat newsletter images: beehiiv post thumbnails (1200x630) and in-email banners (1200x600).
//
// Drawn with the Canvas 2D API so every browser produces the same file. Themes, sizes and positions are
// copied from the "FOSTBeat Newsletter Branding" canvas (Thumb and Banner artboards):
// https://claude.ai/artifact/Jr7ULLg5qTqiF1uWDQUNvW. If that canvas changes, update THEMES and the layouts here.
//
// No DOM beyond the 2D context it is given: index.html (and later a Strapi or dashboard tool) loads the logo,
// the photo and the fonts, then calls draw().

const OUTFIT = '"Outfit", "Inter", sans-serif';
const INTER = '"Inter", system-ui, sans-serif';

export const NEWSLETTERS = ['drum', 'cao', 'otf', 'aig', 'soiree'];

export const THEMES = {
  drum: {
    name: 'The Drum', label: 'THE DRUM', cadence: 'WEEKLY', logo: 'dark', nameFont: OUTFIT, headFont: OUTFIT,
    ground: '#111525', ink: '#ffffff', eyebrow: '#ff863f', sub: '#bcc4d0', pillBg: '#fc6200', pillInk: '#111525',
    slot: '#15182b', slotLine: '#5a6278', slotInk: '#bcc4d0',
  },
  cao: {
    name: 'Ctrl+Alt+Own', label: 'CTRL+ALT+OWN', cadence: 'MONTHLY', logo: 'light', nameFont: OUTFIT, headFont: OUTFIT,
    ground: '#dcf1ed', ink: '#111525', eyebrow: '#156d61', sub: '#252525', pillBg: '#156d61', pillInk: '#ffffff',
    slot: '#ffffff', slotLine: '#156d61', slotInk: '#156d61',
  },
  otf: {
    name: 'Open Tech FTW!', label: 'OPEN TECH FTW!', cadence: 'MONTHLY', logo: 'light', nameFont: OUTFIT, headFont: OUTFIT,
    ground: '#cdf564', ink: '#111525', eyebrow: '#111525', sub: '#111525', pillBg: '#111525', pillInk: '#cdf564',
    slot: '#ffffff', slotLine: '#111525', slotInk: '#111525',
  },
  aig: {
    name: 'The AI Generation', label: 'THE AI GENERATION', cadence: 'MONTHLY', logo: 'white', nameFont: OUTFIT, headFont: OUTFIT,
    ground: '#6840a0', ink: '#ffffff', eyebrow: '#ede7fb', sub: '#ede7fb', pillBg: '#ffffff', pillInk: '#6840a0',
    slot: '#5a3690', slotLine: '#ede7fb', slotInk: '#ede7fb',
  },
  soiree: {
    name: 'Soirée', label: 'SOIRÉE', cadence: 'MONTHLY', logo: 'white', nameFont: INTER, headFont: INTER,
    ground: '#0030ff', ink: '#ffffff', eyebrow: '#ffffff', sub: '#ffffff', pillBg: '#ffffff', pillInk: '#0030ff',
    slot: '#0028d6', slotLine: '#ffffff', slotInk: '#ffffff',
  },
};

export const LOGO_FILES = { light: 'assets/fostbeat-logo-light.svg', dark: 'assets/fostbeat-logo-dark.svg', white: 'assets/fostbeat-logo-white.svg' };
const LOGO_RATIO = 428.99 / 96.89;

export const IMAGE_TYPES = {
  thumbnail: {
    w: 1200, h: 630, mime: 'image/png', ext: 'png', quality: undefined,
    name: 'Post thumbnail', blurb: 'beehiiv post thumbnail, 1200 × 630 PNG.',
    fields: [
      { key: 'issue', label: 'Issue number', type: 'number' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'headline', label: 'Headline', type: 'textarea', required: true },
    ],
  },
  banner: {
    w: 1200, h: 600, mime: 'image/jpeg', ext: 'jpg', quality: 0.9,
    name: 'In-email banner', blurb: 'In-email banner for a feature, 1200 × 600 JPEG, with a photo.',
    fields: [
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'headline', label: 'Headline', type: 'textarea', required: true },
      { key: 'standfirst', label: 'Standfirst', type: 'textarea' },
      { key: 'button', label: 'Button text', type: 'text', default: 'READ ON FOSTBEAT →' },
    ],
  },
};

// The banner's photo space and the crop frame's shape.
export const PHOTO = { x: 624, y: 56, w: 520, h: 488 };
export const PHOTO_RATIO = PHOTO.w / PHOTO.h;

/* --------------------------------------------------------------- text helpers */

export function slug(s, max = 60) {
  const t = String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/\+/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf('-');
  return (at > max * 0.5 ? cut.slice(0, at) : t.slice(0, max)).replace(/-+$/, '');
}

// "2026-11-20" -> "20 NOV 2026"
export function issueDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return '';
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mi = Number(m[2]) - 1;
  if (mi < 0 || mi > 11) return '';
  return `${m[3]} ${months[mi]} ${m[1]}`;
}

export function issueLine(input) {
  const n = String(input.issue ?? '').trim();
  const d = issueDate(input.date);
  return [n ? `ISSUE ${n}` : '', d].filter(Boolean).join(' · ');
}

export function fileName(type, newsletter, input, scale = 1) {
  const nl = slug(THEMES[newsletter]?.name ?? newsletter, 40);
  const head = slug(input.headline, 40);
  const issue = String(input.issue ?? '').trim();
  const base = type === 'thumbnail'
    ? (issue ? `${nl}-issue-${slug(issue, 12)}-thumbnail` : `${nl}-thumbnail${head ? '-' + head : ''}`)
    : `${nl}-banner${head ? '-' + head : ''}`;
  return `${base}${scale === 2 ? '@2x' : ''}.${IMAGE_TYPES[type].ext}`;
}

export function altText(type, newsletter, input) {
  const head = String(input.headline ?? '').replace(/\s+/g, ' ').trim();
  if (type === 'banner') return head || `${THEMES[newsletter].name} feature`;
  const issue = String(input.issue ?? '').trim();
  const who = issue ? `${THEMES[newsletter].name}, issue ${issue}` : THEMES[newsletter].name;
  return head ? `${who}: ${head}` : who;
}

// Greedy word wrap with ctx.measureText. A single word wider than the line is broken by characters.
export function wrap(ctx, text, maxWidth) {
  const words = String(text ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  const fits = (s) => ctx.measureText(s).width <= maxWidth;
  for (let w of words) {
    if (!fits(w)) {
      if (line) { lines.push(line); line = ''; }
      let part = '';
      for (const ch of w) { if (fits(part + ch)) part += ch; else { lines.push(part); part = ch; } }
      w = part;
    }
    const next = line ? `${line} ${w}` : w;
    if (fits(next)) line = next; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

// Ends the last allowed line with an ellipsis that fits.
function ellipsize(ctx, line, maxWidth) {
  let t = line.trimEnd();
  while (t && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1).trimEnd();
  return t + '…';
}

// Tries sizes from start down to min (step px) until the text fits in maxLines lines.
// font(size) returns the CSS font string for that size. Returns { size, lines, overflow }.
export function fitText(ctx, text, { font, start, min, step = 2, maxWidth, maxLines }) {
  for (let size = start; size >= min; size -= step) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines, overflow: false };
  }
  ctx.font = font(min);
  const lines = wrap(ctx, text, maxWidth);
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(ctx, kept[maxLines - 1] + ' ' + lines.slice(maxLines).join(' '), maxWidth);
  return { size: min, lines: kept, overflow: true };
}

/* ----------------------------------------------------------- drawing helpers */

function setTracking(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

// Baseline for a line box of height lineH whose top is at y, as CSS centres text in its line box.
function baseline(ctx, y, lineH) {
  const m = ctx.measureText('Hg');
  const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? lineH * 0.8;
  const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? lineH * 0.2;
  return y + (lineH - (asc + desc)) / 2 + asc;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// A tracked, single-line label; returns its width.
function label(ctx, text, x, top, { font, size, color, tracking = 0.18, lineH }) {
  ctx.font = `${font.weight} ${size}px ${font.family}`;
  setTracking(ctx, size * tracking);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const lh = lineH ?? size * 1.2;
  ctx.fillText(text, x, baseline(ctx, top, lh));
  const w = ctx.measureText(text).width;
  setTracking(ctx, 0);
  return w;
}

function pill(ctx, text, rightOrLeft, bottomOrTop, { anchor, size, padX, padY, bg, ink, family }) {
  ctx.font = `700 ${size}px ${family}`;
  setTracking(ctx, size * 0.18);
  const tw = ctx.measureText(text).width;
  const lh = size * 1.2;
  const w = tw + padX * 2, h = lh + padY * 2;
  const x = anchor === 'bottom-right' ? rightOrLeft - w : rightOrLeft;
  const y = anchor === 'bottom-right' || anchor === 'bottom-left' ? bottomOrTop - h : bottomOrTop;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(text, x + padX, baseline(ctx, y + padY, lh));
  setTracking(ctx, 0);
  return { x, y, w, h };
}

/* ------------------------------------------------------------------ motifs */

const BAR_HEIGHTS = [50, 100, 76, 160, 200, 120, 180, 86, 60];
const DOT_SIZES = [6, 12, 20, 28];
const DOT_OPACITY = [0.35, 0.55, 0.8, 1];

const MOTIFS = {
  // Nine rounded beat bars, red at the foot to orange at the top, right-aligned at the top right.
  drum(ctx, W) {
    const top = 64, bottom = 264, gap = 14, bw = 24;
    let x = W - 64 - (BAR_HEIGHTS.length * bw + (BAR_HEIGHTS.length - 1) * gap);
    for (const h of BAR_HEIGHTS) {
      const g = ctx.createLinearGradient(0, bottom, 0, bottom - h);
      g.addColorStop(0, '#dd312a'); g.addColorStop(1, '#fe8540');
      roundRect(ctx, x, bottom - h, bw, h, bw / 2);
      ctx.fillStyle = g; ctx.fill();
      x += bw + gap;
    }
    void top;
  },
  // Three keycaps (92x76 inside a 3px navy border) with a teal key shadow.
  cao(ctx, W) {
    const w = 98, h = 82, gap = 12, y = 64;
    let x = W - 64 - (3 * w + 2 * gap);
    ['#ffffff', '#ffffff', '#111525'].forEach((fill) => {
      roundRect(ctx, x, y + 6, w, h, 12); ctx.fillStyle = '#156d61'; ctx.fill();
      roundRect(ctx, x, y, w, h, 12); ctx.fillStyle = '#111525'; ctx.fill();
      roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 9); ctx.fillStyle = fill; ctx.fill();
      x += w + gap;
    });
  },
  // An open arc, orange to lime to green, overlapping the top right corner.
  otf(ctx, W) {
    const s = 420 / 360, ox = W + 60 - 420, oy = -70;
    const cx = ox + 180 * s, cy = oy + 180 * s, r = 130 * s;
    const g = ctx.createLinearGradient(ox + 50 * s, oy + 50 * s, ox + 310 * s, oy + 310 * s);
    g.addColorStop(0, '#f28c1b'); g.addColorStop(0.5, '#84de14'); g.addColorStop(1, '#18bf55');
    const a0 = Math.atan2(120 - 180, 300 - 180), a1 = Math.atan2(66 - 180, 240 - 180) + Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1, false);
    ctx.lineWidth = 40 * s; ctx.lineCap = 'round'; ctx.strokeStyle = g; ctx.stroke();
  },
  // A dot grid: four right-aligned rows of seven dots, growing and darkening row by row.
  aig(ctx, W) {
    DOT_SIZES.forEach((d, i) => {
      const rowW = 7 * d + 6 * 10;
      const cy = 64 + i * 40 + 15;
      ctx.globalAlpha = DOT_OPACITY[i];
      ctx.fillStyle = '#ede7fb';
      for (let k = 0; k < 7; k++) {
        ctx.beginPath(); ctx.arc(W - 64 - rowW + k * (d + 10) + d / 2, cy, d / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  },
  // Concentric orange rings in the top right, and an orange-to-blue bar along the foot.
  soiree(ctx, W, H) {
    const s = 460 / 420, ox = W + 80 - 460, oy = -150, cx = ox + 210 * s, cy = oy + 210 * s;
    ctx.strokeStyle = '#f28c1b'; ctx.lineWidth = 3 * s;
    [[200, 0.45], [150, 0.7], [100, 1]].forEach(([r, o]) => {
      ctx.globalAlpha = o; ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f28c1b'; ctx.beginPath(); ctx.arc(cx, cy, 48 * s, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#f28c1b'); g.addColorStop(1, '#0030ff');
    ctx.fillStyle = g; ctx.fillRect(0, H - 14, W, 14);
  },
};

/* ----------------------------------------------------------------- layouts */

const fam = (f) => f;

// Post thumbnail, 1200x630: name and issue line at the top, headline in the middle, logo and cadence at the foot.
export function drawThumbnail(ctx, newsletter, input, assets = {}) {
  const t = THEMES[newsletter], { w: W, h: H } = IMAGE_TYPES.thumbnail, P = 64;
  ctx.fillStyle = t.ground; ctx.fillRect(0, 0, W, H);
  MOTIFS[newsletter](ctx, W, H);

  // Top: newsletter name (40px, line height 1) and the issue line, 12px apart.
  ctx.font = `700 40px ${t.nameFont}`; setTracking(ctx, -0.8); ctx.fillStyle = t.ink;
  ctx.fillText(t.name, P, baseline(ctx, P, 40)); setTracking(ctx, 0);
  const issue = issueLine(input);
  const issueH = 16 * 1.2;
  if (issue) label(ctx, issue, P, P + 40 + 12, { font: { weight: 600, family: INTER }, size: 16, color: t.eyebrow, lineH: issueH });
  const topH = 40 + 12 + issueH;

  // Foot: logo 250 wide, cadence pill at the right, aligned to the bottom.
  const logoH = 250 / LOGO_RATIO;
  if (assets.logo) ctx.drawImage(assets.logo, P, H - P - logoH, 250, logoH);
  pill(ctx, t.cadence, W - P, H - P, { anchor: 'bottom-right', size: 16, padX: 22, padY: 12, bg: t.pillBg, ink: t.pillInk, family: INTER });

  // Middle: the headline, centred in the space left between top and foot (flex space-between).
  const fit = fitText(ctx, input.headline, { font: (s) => `600 ${s}px ${t.headFont}`, start: 68, min: 48, maxWidth: 820, maxLines: 3 });
  const lineH = fit.size * 1.08;
  const blockH = fit.lines.length * lineH;
  const free = (H - 2 * P) - topH - logoH - blockH;
  let y = P + topH + Math.max(0, free / 2);
  ctx.font = `600 ${fit.size}px ${t.headFont}`; setTracking(ctx, -0.015 * fit.size); ctx.fillStyle = t.ink;
  for (const line of fit.lines) { ctx.fillText(line, P, baseline(ctx, y, lineH)); y += lineH; }
  setTracking(ctx, 0);
  return { overflow: fit.overflow ? ['headline'] : [] };
}

// In-email banner, 1200x600: label, headline and standfirst on the left, button at the foot, photo on the right.
export function drawBanner(ctx, newsletter, input, assets = {}) {
  const t = THEMES[newsletter], { w: W, h: H } = IMAGE_TYPES.banner, P = 56, colW = 512;
  const overflow = [];
  ctx.fillStyle = t.ground; ctx.fillRect(0, 0, W, H);

  // Photo space: the framed photo, or the newsletter's dashed placeholder.
  ctx.save();
  roundRect(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, 20);
  if (assets.photo && assets.crop) {
    ctx.clip();
    const c = assets.crop;
    ctx.drawImage(assets.photo, c.x, c.y, c.w, c.h, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
  } else {
    ctx.fillStyle = t.slot; ctx.fill();
    ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.strokeStyle = t.slotLine;
    roundRect(ctx, PHOTO.x + 1, PHOTO.y + 1, PHOTO.w - 2, PHOTO.h - 2, 19); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `600 18px ${INTER}`; setTracking(ctx, 1.8); ctx.fillStyle = t.slotInk; ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', PHOTO.x + PHOTO.w / 2, baseline(ctx, PHOTO.y + PHOTO.h / 2 - 11, 22));
    ctx.textAlign = 'left'; setTracking(ctx, 0);
  }
  ctx.restore();

  // Top group, 20px apart: label, headline (54px down to 40px, 3 lines), standfirst (22/32, 2 lines).
  let y = P;
  const cat = String(input.category ?? '').trim();
  const lab = cat ? `${t.label} · ${cat.toUpperCase()}` : t.label;
  ctx.font = `600 16px ${INTER}`; setTracking(ctx, 16 * 0.18);
  const labelText = ctx.measureText(lab).width > colW ? ellipsize(ctx, lab, colW) : lab;
  setTracking(ctx, 0);
  label(ctx, labelText, P, y, { font: { weight: 600, family: INTER }, size: 16, color: t.eyebrow });
  y += 16 * 1.2 + 20;

  const fit = fitText(ctx, input.headline, { font: (s) => `600 ${s}px ${t.headFont}`, start: 54, min: 40, maxWidth: colW, maxLines: 3 });
  if (fit.overflow) overflow.push('headline');
  const lineH = fit.size * 1.1;
  ctx.font = `600 ${fit.size}px ${t.headFont}`; setTracking(ctx, -0.015 * fit.size); ctx.fillStyle = t.ink;
  for (const line of fit.lines) { ctx.fillText(line, P, baseline(ctx, y, lineH)); y += lineH; }
  setTracking(ctx, 0);

  const stand = String(input.standfirst ?? '').trim();
  if (stand) {
    y += 20;
    const sf = fitText(ctx, stand, { font: (s) => `400 ${s}px ${INTER}`, start: 22, min: 22, maxWidth: colW, maxLines: 2 });
    if (sf.overflow) overflow.push('standfirst');
    ctx.font = `400 22px ${INTER}`; ctx.fillStyle = t.sub;
    for (const line of sf.lines) { ctx.fillText(line, P, baseline(ctx, y, 32)); y += 32; }
  }

  // Button at the foot of the left column.
  const btn = String(input.button ?? '').trim() || IMAGE_TYPES.banner.fields[3].default;
  ctx.font = `700 18px ${INTER}`; setTracking(ctx, 18 * 0.18);
  const btnText = ctx.measureText(btn).width > colW - 60 ? ellipsize(ctx, btn, colW - 60) : btn;
  if (btnText !== btn) overflow.push('button');
  setTracking(ctx, 0);
  const b = pill(ctx, btnText, P, H - P, { anchor: 'bottom-left', size: 18, padX: 30, padY: 18, bg: t.pillBg, ink: t.pillInk, family: INTER });
  if (y > b.y - 12) overflow.push('text');
  return { overflow };
}

// Draws one image. scale 2 makes the 2x copy: the canvas is twice the size and everything is drawn scaled.
export function draw(type, ctx, newsletter, input, assets = {}, scale = 1) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const r = type === 'thumbnail' ? drawThumbnail(ctx, newsletter, input, assets) : drawBanner(ctx, newsletter, input, assets);
  ctx.restore();
  return r;
}

/* ------------------------------------------------------------ photo frame */

// The largest centred frame of the photo space's shape.
export function initialPhotoFrame(w, h) {
  const fw = Math.min(w, h * PHOTO_RATIO);
  const fh = fw / PHOTO_RATIO;
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
}

// Keeps a frame at the photo space's shape, at least 120 source pixels wide (or the photo's limit), inside the photo.
export function clampPhotoFrame(f, w, h) {
  const maxW = Math.min(w, h * PHOTO_RATIO);
  const fw = Math.max(Math.min(120, maxW), Math.min(f.w, maxW));
  const fh = fw / PHOTO_RATIO;
  return { x: Math.min(Math.max(0, f.x), w - fw), y: Math.min(Math.max(0, f.y), h - fh), w: fw, h: fh };
}

// Soft when the frame holds fewer original pixels than the photo space at this scale.
export const photoIsSoft = (frame, scale = 1) => frame.w < PHOTO.w * scale - 0.5;

export function fontsFor(newsletter) {
  const t = THEMES[newsletter];
  const list = ['600 16px "Inter"', '700 16px "Inter"', '400 22px "Inter"'];
  if (t.headFont === OUTFIT) list.push('600 54px "Outfit"', '700 40px "Outfit"');
  else list.push('600 54px "Inter"', '700 40px "Inter"');
  return list;
}
void fam;
