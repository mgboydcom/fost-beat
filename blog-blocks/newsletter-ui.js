// Newsletter images panel for the block generator: newsletter choice, fields, banner photo framing, live preview,
// alt text, and Download image. Drawing lives in newsletter-images.js; this file only wires the page.
import {
  NEWSLETTERS, THEMES, IMAGE_TYPES, LOGO_FILES, PHOTO, PHOTO_RATIO,
  draw, fileName, altText, fontsFor, initialPhotoFrame, clampPhotoFrame, photoIsSoft,
} from "./newsletter-images.js";

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const OVERFLOW_TEXT = {
  headline: "Shorten the headline: it does not fit, even at the smallest size.",
  standfirst: "Shorten the standfirst: it needs more than two lines.",
  button: "Shorten the button text.",
  text: "The text runs into the button: shorten the headline or standfirst.",
};

export function initNewsletterImages({ $, store, say }) {
  const panel = $("#image-ui");
  const canvas = $("#img-canvas");
  const form = $("#img-form");
  const altBox = $("#img-alt");
  const msgs = $("#img-messages");
  const dl = $("#img-download");
  let type = "thumbnail";
  let nl = "drum";
  let data = {};
  let photo = null;   // { bitmap, w, h, name }
  let frame = null;   // crop in photo pixels
  let fontsOk = false;
  let fontSeq = 0;
  let raf = 0;

  // Logos load once; drawing waits for them.
  const logos = {};
  const logosReady = Promise.all(Object.entries(LOGO_FILES).map(([k, src]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { logos[k] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = src;
  })));

  /* ---------- newsletter buttons */
  const nlBox = $("#img-newsletters");
  NEWSLETTERS.forEach((k) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = THEMES[k].name; b.dataset.nl = k;
    b.addEventListener("click", () => chooseNewsletter(k));
    nlBox.appendChild(b);
  });

  const key = () => `img:${type}:${nl}`;
  const defaultsFor = (t) => Object.fromEntries(IMAGE_TYPES[t].fields.map((f) => [f.key, f.default ?? ""]));
  const save = () => store.set(key(), data);

  function load() {
    data = { ...defaultsFor(type), ...(store.get(key()) || {}) };
    store.set(`img:${type}:last`, nl);
    nlBox.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.nl === nl)));
    buildForm();
    loadFonts();
  }

  function chooseNewsletter(k) { nl = k; load(); }

  /* ---------- form */
  function buildForm() {
    form.innerHTML = "";
    for (const f of IMAGE_TYPES[type].fields) {
      const wrap = document.createElement("label");
      wrap.className = "f";
      const span = document.createElement("span");
      span.textContent = f.label;
      if (f.required) span.insertAdjacentHTML("beforeend", " <em>*</em>");
      wrap.appendChild(span);
      const el = f.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
      if (f.type !== "textarea") el.type = { number: "number", date: "date" }[f.type] || "text";
      if (f.type === "number") el.min = "1";
      el.value = data[f.key] ?? "";
      el.addEventListener("input", () => { data[f.key] = el.value; save(); schedule(); });
      wrap.appendChild(el);
      form.appendChild(wrap);
    }
    $("#img-photo").hidden = type !== "banner";
    altBox.value = data.altEdited ? data.alt ?? "" : "";
  }

  altBox.addEventListener("input", () => { data.alt = altBox.value; data.altEdited = true; save(); });

  /* ---------- fonts */
  async function loadFonts() {
    const seq = ++fontSeq;
    fontsOk = false;
    schedule();
    const wanted = fontsFor(nl);
    try { await Promise.all(wanted.map((f) => document.fonts.load(f))); } catch { /* checked below */ }
    await logosReady;
    if (seq !== fontSeq) return;
    fontsOk = wanted.every((f) => document.fonts.check(f));
    schedule();
  }

  /* ---------- drawing */
  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  }

  function assets() {
    return { logo: logos[THEMES[nl].logo], photo: type === "banner" && photo ? photo.bitmap : null, crop: type === "banner" ? frame : null };
  }

  function render() {
    const t = IMAGE_TYPES[type];
    canvas.width = t.w; canvas.height = t.h;
    const ctx = canvas.getContext("2d");
    const out = [];
    if (!fontsOk) {
      ctx.fillStyle = THEMES[nl].ground; ctx.fillRect(0, 0, t.w, t.h);
      out.push(fontSeq && document.fonts.status === "loaded" && !fontsOk
        ? "The newsletter's fonts could not load, so the image cannot be drawn. Check the connection and reload."
        : "Waiting for fonts…");
    } else {
      const r = draw(type, ctx, nl, data, assets());
      for (const o of r.overflow) out.push(OVERFLOW_TEXT[o]);
      if (type === "banner" && !photo) out.push("The banner has no photo yet: choose one below the fields.");
      if (type === "banner" && frame && photoIsSoft(frame, $("#img-2x").checked ? 2 : 1)) out.push("This will look soft: the framed part of the photo is smaller than the photo space.");
    }
    if (!String(data.headline ?? "").trim()) out.push("Add a headline.");
    canvas.setAttribute("aria-label", `${IMAGE_TYPES[type].name} preview for ${THEMES[nl].name}`);
    msgs.innerHTML = "";
    if (out.length) {
      const box = document.createElement("div"); box.className = "msg";
      const ul = document.createElement("ul");
      out.forEach((m) => { const li = document.createElement("li"); li.textContent = m; ul.appendChild(li); });
      box.appendChild(ul); msgs.appendChild(box);
    }
    dl.disabled = !fontsOk;
    if (!data.altEdited) altBox.value = altText(type, nl, data);
    drawCropView();
  }

  /* ---------- download and alt text */
  dl.addEventListener("click", async () => {
    if (!fontsOk) return;
    const t = IMAGE_TYPES[type];
    const scales = $("#img-2x").checked ? [1, 2] : [1];
    for (const s of scales) {
      const c = document.createElement("canvas");
      c.width = t.w * s; c.height = t.h * s;
      draw(type, c.getContext("2d"), nl, data, assets(), s);
      const blob = await new Promise((r) => c.toBlob(r, t.mime, t.quality));
      if (!blob) { say("The image could not be prepared"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName(type, nl, data, s);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    say(scales.length === 2 ? "Downloaded the image and its 2× copy" : "Downloaded the image");
  });

  $("#img-copy-alt").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(altBox.value); say("Copied alt text"); }
    catch { altBox.select(); say("Text selected. Press Ctrl+C or ⌘C"); }
  });
  $("#img-2x").addEventListener("change", schedule);

  /* ---------- banner photo */
  const cropBox = $("#img-crop");
  const cropCanvas = $("#img-crop-canvas");
  const frameEl = $("#img-crop-frame");
  let viewScale = 1;
  let drag = null;

  $("#img-photo-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) { say("That photo is over 25 MB"); return; }
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch { say("That file could not be read as an image"); return; }
    photo = { bitmap, w: bitmap.width, h: bitmap.height, name: file.name };
    frame = initialPhotoFrame(photo.w, photo.h);
    cropBox.hidden = false;
    schedule();
  });

  function drawCropView() {
    if (!photo || type !== "banner") return;
    const maxW = Math.min(cropBox.parentElement.clientWidth || 400, 400);
    viewScale = Math.min(1, maxW / photo.w);
    const w = Math.round(photo.w * viewScale), h = Math.round(photo.h * viewScale);
    if (cropCanvas.width !== w || cropCanvas.height !== h) {
      cropCanvas.width = w; cropCanvas.height = h;
      cropCanvas.getContext("2d").drawImage(photo.bitmap, 0, 0, w, h);
    }
    cropBox.style.width = w + "px"; cropBox.style.height = h + "px";
    Object.assign(frameEl.style, { left: frame.x * viewScale + "px", top: frame.y * viewScale + "px", width: frame.w * viewScale + "px", height: frame.h * viewScale + "px" });
    frameEl.setAttribute("aria-label", `Photo frame, ${Math.round(frame.w)} × ${Math.round(frame.h)} pixels. Arrow keys move it; Shift and arrow keys resize it.`);
  }

  const moveTo = (f) => { frame = clampPhotoFrame(f, photo.w, photo.h); schedule(); };

  frameEl.addEventListener("keydown", (e) => {
    if (!photo) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const step = photo.w * 0.01;
    if (e.shiftKey) {
      const grow = (e.key === "ArrowRight" || e.key === "ArrowDown" ? 2 : -2) * step;
      const w = frame.w + grow;
      moveTo({ x: frame.x - grow / 2, y: frame.y - grow / PHOTO_RATIO / 2, w, h: w / PHOTO_RATIO });
    } else moveTo({ ...frame, x: frame.x + d[0] * step, y: frame.y + d[1] * step });
  });

  function startDrag(e, mode) {
    if (!photo) return;
    e.preventDefault(); e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    drag = { mode, x: e.clientX, y: e.clientY, start: frame };
  }
  frameEl.addEventListener("pointerdown", (e) => startDrag(e, "move"));
  $("#img-crop-handle").addEventListener("pointerdown", (e) => startDrag(e, "resize"));
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / viewScale, dy = (e.clientY - drag.y) / viewScale;
    if (drag.mode === "move") moveTo({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy });
    else { const w = drag.start.w + Math.max(dx, dy * PHOTO_RATIO); moveTo({ ...drag.start, w, h: w / PHOTO_RATIO }); }
  });
  window.addEventListener("pointerup", () => { drag = null; });
  window.addEventListener("resize", () => { if (photo) { cropCanvas.width = 0; schedule(); } });

  /* ---------- show or hide the panel */
  return {
    types: Object.entries(IMAGE_TYPES).map(([k, t]) => ({ type: k, name: t.name })),
    show(t) {
      type = t;
      nl = store.get(`img:${type}:last`) || nl;
      $("#img-title").textContent = IMAGE_TYPES[type].name;
      $("#img-blurb").textContent = IMAGE_TYPES[type].blurb;
      panel.hidden = false;
      load();
    },
    hide() { panel.hidden = true; },
  };
}

export { PHOTO };
