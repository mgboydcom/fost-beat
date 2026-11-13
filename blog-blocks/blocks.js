// FOSTBeat blog blocks: field definitions + HTML renderers.
//
// Framework-free on purpose: no DOM, no React, no build step. The generator page
// (index.html) imports this file today; a Strapi admin plugin or a server-side
// renderer can import the same file later, so the markup stays in one place.
//
// Field definitions mirror the Strapi components in strapi/components/blog/*.json
// (same keys), so values saved from this generator map one-to-one onto Strapi data.

import { STYLES } from "./styles.js";

/* ---------------------------------------------------------------- helpers */

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const has = v => v != null && String(v).trim() !== "";
const pad = n => String(n).padStart(2, "0");

export function uid() {
  return Math.random().toString(36).slice(2, 7);
}

// Values travel inside the snippet's first comment so a pasted block can be loaded
// back into the generator for editing. Base64 keeps "--" and ">" out of the comment.
function encodeSource(type, data) {
  const json = JSON.stringify(data);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return `<!-- fbb:${type} ${b64} -->`;
}
export function decodeSource(html) {
  const m = /<!--\s*fbb:([a-z-]+)\s+([A-Za-z0-9+/=]+)\s*-->/.exec(html || "");
  if (!m) return null;
  try {
    const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    return { type: m[1], data: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return null;
  }
}

const gradient = id =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d22f1e"/><stop offset="1" stop-color="#f26522"/></linearGradient></defs>`;

const ICON = {
  takeaways: id => `<svg viewBox="0 0 24 24" aria-hidden="true">${gradient(id)}<path d="M12 2a7 7 0 0 0-4.2 12.6c.7.5 1.2 1.3 1.2 2.2V17h6v-.2c0-.9.5-1.7 1.2-2.2A7 7 0 0 0 12 2z" fill="url(#${id})"/><rect x="9" y="18.5" width="6" height="2" rx="1" fill="currentColor"/><rect x="10" y="21.5" width="4" height="1.8" rx=".9" fill="currentColor" opacity=".55"/><path d="M10.2 9.2a2.4 2.4 0 0 1 3.6 0" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10"/><path d="M6.5 11.3l3 3 6-6.3" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hours: id => `<svg viewBox="0 0 24 24" aria-hidden="true">${gradient(id)}<path d="M2 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v1H2z" fill="url(#${id})"/><path d="M2 8h16v4.5A7 7 0 0 0 11.2 21H5a3 3 0 0 1-3-3z" fill="currentColor" opacity=".35"/><rect x="5.5" y="2" width="2" height="4" rx="1" fill="currentColor"/><rect x="12.5" y="2" width="2" height="4" rx="1" fill="currentColor"/><circle cx="17.5" cy="17.5" r="5.5" fill="url(#${id})"/><path d="M17.5 14.6v3.1l2 1.3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>`,
  tick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  gcal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>`,
  ics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 12.5v6M9.5 16l2.5 2.5 2.5-2.5"/></svg>`,
  quote: id => `<svg class="fbb-quote__mark" viewBox="0 0 40 32" aria-hidden="true">${gradient(id)}<path fill="url(#${id})" d="M15.5 2C7.6 4.5 2 10.4 2 19v11h14V17H9.4c.5-4.6 3.2-7.9 7.6-9.8L15.5 2zm22 0C29.6 4.5 24 10.4 24 19v11h14V17h-6.6c.5-4.6 3.2-7.9 7.6-9.8L37.5 2z"/></svg>`,
  event: id => `<svg viewBox="0 0 24 24" aria-hidden="true">${gradient(id)}<rect x="8" y="1.5" width="8" height="13" rx="4" fill="url(#${id})"/><path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="11" y="18" width="2" height="3.5" rx="1" fill="currentColor"/><rect x="7.5" y="21" width="9" height="2" rx="1" fill="currentColor" opacity=".55"/></svg>`,
};
ICON.action = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${gradient(id)}<rect x="1" y="4" width="11" height="4" rx="2" fill="currentColor" opacity=".35"/><rect x="1" y="10" width="14" height="4" rx="2" fill="currentColor"/><rect x="1" y="16" width="11" height="4" rx="2" fill="currentColor" opacity=".35"/><path d="M16 5.5c0-.9 1-1.4 1.7-.9l5.3 6.6c.4.5.4 1.1 0 1.6l-5.3 6.6c-.7.5-1.7 0-1.7-.9z" fill="url(#${id})"/></svg>`;

const wrap = (type, name, data, css, body, script = "") =>
  `${encodeSource(type, data)}\n<!-- FOSTBeat block: ${name}. Edit it in the generator, not by hand. -->\n<style>\n${css}\n</style>\n${body}${script ? "\n<script>\n" + script + "\n</script>" : ""}\n`;

/* ----------------------------------------------------------- office hours */

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function officeHoursSchedule(d) {
  const day = DAYS.indexOf(d.dayOfWeek);
  const [hh, mm] = String(d.startTime || "16:00").split(":").map(Number);
  const dur = Number(d.durationMinutes) || 60;
  const out = { day, hh, mm, dur, warnings: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.firstSessionDate || "")) {
    out.warnings.push("Set the first session date so the calendar buttons can be built.");
    return out;
  }
  const [y, mo, da] = d.firstSessionDate.split("-").map(Number);
  // wall-clock times in the event's own time zone; UTC is used only as a calendar calculator
  const st = new Date(Date.UTC(y, mo - 1, da, hh, mm));
  const en = new Date(st.getTime() + dur * 60000);
  if (st.getUTCDay() !== day) out.warnings.push(`${d.firstSessionDate} is a ${cap(DAYS[st.getUTCDay()])}, not a ${cap(d.dayOfWeek)}. The calendar repeats from the first session date.`);
  const stamp = t => `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
  const rr = "RRULE:FREQ=WEEKLY;BYDAY=" + ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][day];
  const desc = `${(d.description || "").trim()}\n\nJoin: ${d.joinUrl}`;
  const e = encodeURIComponent;
  const title = d.calendarTitle || "Office hours";
  out.gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${e(title)}&dates=${stamp(st)}/${stamp(en)}&ctz=${e(d.timezone)}&recur=${e(rr)}&details=${e(desc)}&location=${e(d.joinUrl)}`;
  const icsEsc = t => t.replace(/\\/g, "\\\\").replace(/[,;]/g, c => "\\" + c).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FOST//FOSTBeat Office Hours//EN", "BEGIN:VEVENT",
    `UID:fbb-hours-${stamp(st)}@joinfost.io`,
    "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
    `DTSTART;TZID=${d.timezone}:${stamp(st)}`, `DTEND;TZID=${d.timezone}:${stamp(en)}`, rr,
    "SUMMARY:" + icsEsc(title), "DESCRIPTION:" + icsEsc(desc), "LOCATION:" + d.joinUrl, "URL:" + d.joinUrl,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  out.ics = "data:text/calendar;charset=utf-8," + e(ics);
  return out;
}

const HOURS_SCRIPT = `(function(){
  document.querySelectorAll('[data-fbb-hours]:not([data-fbb-done])').forEach(function(el){
    el.setAttribute('data-fbb-done','');
    try{
      var day=+el.dataset.day,hour=+el.dataset.hour,minute=+(el.dataset.minute||0),tz=el.dataset.tz;
      function parts(d,o){return new Intl.DateTimeFormat('en-US',Object.assign({timeZone:tz},o)).formatToParts(d).reduce(function(a,x){a[x.type]=x.value;return a},{});}
      function off(d){var p=parts(d,{hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});return (Date.UTC(+p.year,p.month-1,+p.day,+p.hour,+p.minute)-d.getTime())/60000;}
      var now=new Date(),next=null;
      for(var i=0;i<8&&!next;i++){
        var p=parts(new Date(now.getTime()+i*864e5),{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'});
        if(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday)!==day)continue;
        var guess=Date.UTC(+p.year,p.month-1,+p.day,hour,minute),t=new Date(guess-off(new Date(guess))*60000);
        if(t.getTime()+36e5>now.getTime())next=t;
      }
      if(!next)return;
      if(off(next)!==-next.getTimezoneOffset())el.querySelector('[data-fbb-local]').textContent='('+new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(next)+' your time)';
      el.querySelector('[data-fbb-next]').textContent=next.getTime()<=now.getTime()?'Happening now':'Next: '+new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'}).format(next);
    }catch(e){}
  });
})();`;

/* ---------------------------------------------------------------- gallery */

const GALLERY_SCRIPT = `(function(){
  var L='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  var R='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  var X='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  if(typeof HTMLDialogElement==='undefined')return;
  document.querySelectorAll('[data-fbb-gallery]:not([data-fbb-done])').forEach(function(g){
    g.setAttribute('data-fbb-done','');
    var items=[].slice.call(g.querySelectorAll('.fbb-gallery__item')),imgs=items.map(function(b){return b.querySelector('img');});
    var d=document.createElement('dialog');d.className='fbb-lightbox';d.setAttribute('aria-label','Photo viewer');
    d.innerHTML='<div class="fbb-lightbox__top"><span class="fbb-lightbox__count"></span><button type="button" class="fbb-lightbox__close" aria-label="Close">'+X+'</button></div><div class="fbb-lightbox__stage"><img alt=""></div><button type="button" class="fbb-lightbox__prev" aria-label="Previous photo">'+L+'</button><button type="button" class="fbb-lightbox__next" aria-label="Next photo">'+R+'</button><p class="fbb-lightbox__cap"></p>';
    document.body.appendChild(d);
    var big=d.querySelector('.fbb-lightbox__stage img'),cnt=d.querySelector('.fbb-lightbox__count'),cap=d.querySelector('.fbb-lightbox__cap'),cur=0;
    function show(i){cur=(i+imgs.length)%imgs.length;big.src=items[cur].getAttribute('href')||imgs[cur].currentSrc||imgs[cur].src;big.alt=imgs[cur].alt;cap.textContent=imgs[cur].alt;cnt.textContent=(cur+1)+' / '+imgs.length;}
    items.forEach(function(b,i){b.addEventListener('click',function(e){e.preventDefault();show(i);d.showModal();});});
    d.querySelector('.fbb-lightbox__prev').onclick=function(){show(cur-1)};
    d.querySelector('.fbb-lightbox__next').onclick=function(){show(cur+1)};
    d.querySelector('.fbb-lightbox__close').onclick=function(){d.close()};
    d.addEventListener('click',function(e){if(e.target===d||e.target.classList.contains('fbb-lightbox__stage'))d.close();});
    d.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')show(cur-1);if(e.key==='ArrowRight')show(cur+1);});
    var x0=null;d.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
    d.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40)show(cur+(dx<0?1:-1));x0=null;});
  });
})();`;

/* ------------------------------------------------------------------ blocks */
// Field types: text, textarea, url, image (url + preview), date, time, number, select, list (repeatable).

export const BLOCKS = [
  {
    type: "into-action",
    strapi: "blog.into-action",
    name: "Into Action",
    blurb: 'Closing "what to do next" section with numbered steps.',
    fields: [
      { key: "label", label: "Label", type: "text", default: "Into Action" },
      { key: "title", label: "Title", type: "text", required: true, default: "Three places to start" },
      { key: "intro", label: "Intro", type: "textarea" },
      {
        key: "items", label: "Steps", type: "list", min: 1, itemLabel: "Step",
        fields: [
          { key: "title", label: "Step title", type: "text", required: true },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
    ],
    example: {
      label: "Into Action",
      title: "Three places to start",
      intro: "For leaders asking where to begin, start with these three things.",
      items: [
        { title: "Define the governance model", description: "Be clear on who owns the use case, who manages the data and system, who can approve actions and who is accountable when something goes wrong." },
        { title: "Choose one business problem", description: "Be specific about the outcome you want, and check that the data and process are suitable for the task." },
        { title: "Invest in change and literacy", description: "Help people understand what AI can and cannot do, where it fits in their work, and how to question its outputs." },
      ],
    },
    render(d, o) {
      const items = (d.items || []).filter(i => has(i.title));
      const body = `<aside class="fbb-action" aria-labelledby="fbb-action-title-${o.id}">
  <p class="fbb-label">${ICON.action("fbb-g-action-" + o.id)}${esc(d.label)}</p>
  <h3 class="fbb-action__title" id="fbb-action-title-${o.id}">${esc(d.title)}</h3>${has(d.intro) ? `
  <p class="fbb-action__intro">${esc(d.intro)}</p>` : ""}
  <ol class="fbb-action__list">${items.map(i => `
    <li class="fbb-action__item">
      <h4>${esc(i.title)}</h4>${has(i.description) ? `
      <p>${esc(i.description)}</p>` : ""}
    </li>`).join("")}
  </ol>
</aside>`;
      return wrap(this.type, this.name, d, STYLES.intoAction, body);
    },
  },

  {
    type: "key-takeaways",
    strapi: "blog.key-takeaways",
    name: "Key Takeaways",
    blurb: "Summary box placed after the intro. Up to six points.",
    fields: [
      { key: "title", label: "Label", type: "text", default: "Key takeaways" },
      { key: "points", label: "Points", type: "list", min: 1, max: 6, itemLabel: "Point", fields: [{ key: "text", label: "Point", type: "textarea", required: true }] },
    ],
    example: {
      title: "Key takeaways",
      points: [
        { text: "Autonomy is an organisational design choice, not a technology setting." },
        { text: "Pilots stall when they start from a demo instead of a defined business problem." },
        { text: "An agent's authority should match the risk of the decisions it makes." },
      ],
    },
    render(d, o) {
      const pts = (d.points || []).filter(p => has(p.text)).slice(0, 6);
      const body = `<aside class="fbb-takeaways" aria-label="${esc(d.title || "Key takeaways")}">
  <p class="fbb-label">${ICON.takeaways("fbb-g-take-" + o.id)}${esc(d.title)}</p>
  <ul>${pts.map(p => `
    <li>${ICON.check}<span>${esc(p.text)}</span></li>`).join("")}
  </ul>
</aside>`;
      return wrap(this.type, this.name, d, STYLES.keyTakeaways, body);
    },
  },

  {
    type: "office-hours",
    strapi: "blog.office-hours",
    name: "Office Hours",
    blurb: "Weekly drop-in call with a Join button and Add to calendar links (Google and .ics), built when the HTML is generated.",
    fields: [
      { key: "label", label: "Label", type: "text", default: "Open office hours" },
      { key: "title", label: "Title", type: "text", required: true, default: "Bring your questions to the FOSTBeat team" },
      { key: "description", label: "Description", type: "textarea", default: "Every Friday at 16:00 CET we open a drop-in call to talk through this week's articles, your API and AI questions, or ideas for a story." },
      { key: "joinUrl", label: "Join link (Zoom)", type: "url", required: true, default: "https://zoom.us/j/YOUR-MEETING-ID" },
      { key: "dayOfWeek", label: "Day", type: "select", options: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], default: "friday", required: true },
      { key: "startTime", label: "Start time", type: "time", default: "16:00", required: true },
      { key: "durationMinutes", label: "Duration (minutes)", type: "number", default: 60, min: 15, required: true },
      { key: "timezone", label: "Time zone (IANA)", type: "text", default: "Europe/Paris", required: true, help: "Calendar events use this, so daylight saving is handled." },
      { key: "timezoneLabel", label: "Time zone label", type: "text", default: "CET" },
      { key: "firstSessionDate", label: "First session date", type: "date", required: true, help: "The calendar event starts here and repeats weekly." },
      { key: "platformLabel", label: "Platform", type: "text", default: "Zoom" },
      { key: "note", label: "Third fact", type: "text", default: "Free, drop in any time" },
      { key: "joinLabel", label: "Join button text", type: "text", default: "Join on Zoom" },
      { key: "calendarTitle", label: "Calendar event title", type: "text", default: "FOSTBeat Open Office Hours" },
    ],
    example: {},
    validate(d) {
      return officeHoursSchedule(d).warnings;
    },
    render(d, o) {
      const s = officeHoursSchedule(d);
      const time = `${pad(s.hh)}:${pad(s.mm)}`;
      const body = `<aside class="fbb-hours" data-fbb-hours data-day="${s.day}" data-hour="${s.hh}" data-minute="${s.mm}" data-tz="${esc(d.timezone)}" aria-labelledby="fbb-hours-title-${o.id}">
  <p class="fbb-label">${ICON.hours("fbb-g-hours-" + o.id)}${esc(d.label)}</p>
  <h3 class="fbb-hours__title" id="fbb-hours-title-${o.id}">${esc(d.title)}</h3>${has(d.description) ? `
  <p class="fbb-hours__desc">${esc(d.description)}</p>` : ""}
  <ul class="fbb-hours__facts">
    <li>${ICON.clock}<span>${esc(cap(d.dayOfWeek || "friday"))}s, ${time} ${esc(d.timezoneLabel)} <span data-fbb-local></span></span></li>
    <li>${ICON.video}<span>${esc(d.platformLabel)} · ${esc(s.dur)} min</span></li>${has(d.note) ? `
    <li>${ICON.tick}<span data-fbb-next>${esc(d.note)}</span></li>` : ""}
  </ul>
  <div class="fbb-hours__foot">
    <a class="fbb-cta" href="${esc(d.joinUrl)}" target="_blank" rel="noopener">${esc(d.joinLabel)}
      ${ICON.arrow}</a>${s.gcal ? `
    <a class="fbb-cal" href="${esc(s.gcal)}" target="_blank" rel="noopener">${ICON.gcal}Add to Google Calendar</a>
    <a class="fbb-cal" href="${esc(s.ics)}" download="fostbeat-office-hours.ics">${ICON.ics}Apple / Outlook (.ics)</a>` : ""}
  </div>
</aside>`;
      return wrap(this.type, this.name, d, STYLES.officeHours, body, o.scripts ? HOURS_SCRIPT : "");
    },
  },

  {
    type: "block-quote",
    strapi: "blog.block-quote",
    name: "Quote",
    blurb: "Quote credited to a speaker or source, with photo and role.",
    fields: [
      { key: "quote", label: "Quote", type: "textarea", required: true },
      { key: "authorName", label: "Name", type: "text", required: true },
      { key: "authorRole", label: "Role", type: "text" },
      { key: "authorImage", label: "Photo URL", type: "image", help: "Square works best. Shown as a 44px circle." },
      { key: "sourceLabel", label: "Source label", type: "text" },
      { key: "sourceUrl", label: "Source link", type: "url" },
    ],
    example: {
      quote: "Giving an agent access is not the same as deciding it should have authority to act.",
      authorName: "Su Jella",
      authorRole: "Lecturer and Subject Architect, Torrens University",
      authorImage: "https://beat.joinfost.io/fostBeatLogo.svg",
      sourceLabel: "FOST Australia 2026",
      sourceUrl: "https://joinfost.io/events/",
    },
    render(d, o) {
      const source = has(d.sourceLabel)
        ? has(d.sourceUrl) ? `<a href="${esc(d.sourceUrl)}">${esc(d.sourceLabel)}</a>` : esc(d.sourceLabel)
        : "";
      const role = [esc(d.authorRole), source].filter(Boolean).join(" · ");
      const body = `<figure class="fbb-quote">
  ${ICON.quote("fbb-g-quote-" + o.id)}
  <blockquote>
    <p>${esc(d.quote)}</p>
  </blockquote>
  <figcaption>${has(d.authorImage) ? `
    <img src="${esc(d.authorImage)}" alt="">` : ""}
    <span><span class="fbb-quote__name">${esc(d.authorName)}</span>${role ? `
    <span class="fbb-quote__role">${role}</span>` : ""}</span>
  </figcaption>
</figure>`;
      return wrap(this.type, this.name, d, STYLES.blockQuote, body);
    },
  },

  {
    type: "pull-quote",
    strapi: "blog.pull-quote",
    name: "Pull Quote",
    blurb: "A line lifted from the article in large type.",
    fields: [
      { key: "text", label: "Text", type: "textarea", required: true },
      { key: "attribution", label: "Attribution", type: "text" },
    ],
    example: { text: "AI is not a strategy. A pilot is not a transformation.", attribution: "Su Jella" },
    render(d) {
      const body = `<figure class="fbb-pull">
  <p>${esc(d.text)}</p>${has(d.attribution) ? `
  <cite>${esc(d.attribution)}</cite>` : ""}
</figure>`;
      return wrap(this.type, this.name, d, STYLES.pullQuote, body);
    },
  },

  {
    type: "gallery",
    strapi: "blog.gallery",
    name: "Gallery",
    blurb: 'Bento layout: one large photo, up to four smaller ones and a "+N" tile. Each photo links to the full-size image.',
    fields: [
      {
        key: "images", label: "Photos", type: "list", min: 1, itemLabel: "Photo",
        fields: [
          { key: "url", label: "Image URL", type: "image", required: true },
          { key: "alt", label: "Alt text (also the viewer caption)", type: "text", required: true },
        ],
      },
      { key: "caption", label: "Caption", type: "text" },
      { key: "credit", label: "Credit", type: "text" },
    ],
    example: {
      images: [
        { url: "https://beat.joinfost.io/social.png", alt: "Main stage at FOST Australia 2026" },
        { url: "https://beat.joinfost.io/social.png", alt: "Su Jella and S. Adeel Ali during the fireside chat" },
        { url: "https://beat.joinfost.io/social.png", alt: "Attendees in the expo hall" },
        { url: "https://beat.joinfost.io/social.png", alt: "Workshop on agent-ready APIs" },
        { url: "https://beat.joinfost.io/social.png", alt: "Networking at the evening reception" },
        { url: "https://beat.joinfost.io/social.png", alt: "Panel on open banking" },
      ],
      caption: "Scenes from FOST Australia 2026 at MCEC, Melbourne.",
      credit: "Photos: FOST",
    },
    validate(d) {
      const n = (d.images || []).filter(i => has(i.url)).length;
      const w = [];
      if ((d.images || []).some(i => has(i.url) && !has(i.alt))) w.push("Every photo needs alt text; it is also the caption in the viewer.");
      if (n > 5) w.push(`${n === 6 ? "Photo 6 only opens" : `Photos 6–${n} only open`} in the full-screen viewer, which needs scripts. Without them, the "+${n - 4}" tile opens photo 5.`);
      return w;
    },
    render(d, o) {
      const imgs = (d.images || []).filter(i => has(i.url));
      const body = `<figure class="fbb-gallery" data-fbb-gallery>
  <div class="fbb-gallery__grid">${imgs.map((i, n) => `
    <a class="fbb-gallery__item" href="${esc(i.url)}" target="_blank" rel="noopener" aria-label="Open photo ${n + 1} of ${imgs.length}"><img src="${esc(i.url)}" alt="${esc(i.alt)}" loading="lazy">${n === 4 && imgs.length > 5 ? `<span class="fbb-gallery__more">+${imgs.length - 4}</span>` : ""}</a>`).join("")}
  </div>${has(d.caption) || has(d.credit) ? `
  <figcaption>${has(d.caption) ? `
    <span>${esc(d.caption)}</span>` : ""}${has(d.credit) ? `
    <span class="fbb-gallery__credit">${esc(d.credit)}</span>` : ""}
  </figcaption>` : ""}
</figure>`;
      return wrap(this.type, this.name, d, STYLES.gallery, body, o.scripts ? GALLERY_SCRIPT : "");
    },
  },

  {
    type: "event-context",
    strapi: "blog.event-context",
    name: "Event Context",
    blurb: "Names the FOST event the article comes from and who spoke.",
    fields: [
      { key: "label", label: "Label", type: "text", default: "From the stage" },
      { key: "eventName", label: "Event name", type: "text", required: true },
      { key: "eventDate", label: "Event date", type: "text", help: "Free text, e.g. 28–29 October 2026" },
      { key: "eventLocation", label: "Place", type: "text" },
      { key: "sessionTitle", label: "Session title", type: "text" },
      {
        key: "speakers", label: "Speakers", type: "list", itemLabel: "Speaker",
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "role", label: "Role", type: "text" },
          { key: "photo", label: "Photo URL", type: "image" },
          { key: "linkedinUrl", label: "LinkedIn URL", type: "url" },
        ],
      },
      { key: "eventsUrl", label: "Events link", type: "url", default: "https://joinfost.io/events/" },
      { key: "eventsLabel", label: "Events link text", type: "text", default: "Upcoming FOST events" },
    ],
    example: {
      label: "From the stage",
      eventName: "FOST Australia",
      eventDate: "28–29 October 2026",
      eventLocation: "Melbourne",
      sessionTitle: "Fireside chat: Beyond the Pilot, leading the autonomous enterprise in the agentic era",
      speakers: [
        { name: "Su Jella", role: "Torrens University", photo: "https://beat.joinfost.io/fostBeatLogo.svg", linkedinUrl: "https://www.linkedin.com/in/sujella/" },
        { name: "S. Adeel Ali", role: "Co-founder & CEO, APIMatic", photo: "https://beat.joinfost.io/fostBeatLogo.svg", linkedinUrl: "https://www.linkedin.com/in/adeel-apimatic/" },
      ],
      eventsUrl: "https://joinfost.io/events/",
      eventsLabel: "Upcoming FOST events",
    },
    render(d, o) {
      const when = [d.eventName, d.eventDate, d.eventLocation].filter(has).map(esc).join(" · ");
      const people = (d.speakers || []).filter(s => has(s.name));
      const person = s => {
        const inner = `<b>${esc(s.name)}</b>${has(s.role) ? `<span>${esc(s.role)}</span>` : ""}`;
        return `
    <li>${has(s.photo) ? `<img src="${esc(s.photo)}" alt="">` : ""}${has(s.linkedinUrl) ? `<a href="${esc(s.linkedinUrl)}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
      };
      const body = `<aside class="fbb-event" aria-label="About this session">
  <p class="fbb-label">${ICON.event("fbb-g-event-" + o.id)}${esc(d.label)}</p>
  <p class="fbb-event__when">${when}</p>${has(d.sessionTitle) ? `
  <p class="fbb-event__title">${esc(d.sessionTitle)}</p>` : ""}${people.length ? `
  <ul class="fbb-event__people">${people.map(person).join("")}
  </ul>` : ""}${has(d.eventsUrl) ? `
  <div class="fbb-event__links">
    <a class="fbb-link" href="${esc(d.eventsUrl)}">${esc(d.eventsLabel || "Upcoming FOST events")} →</a>
  </div>` : ""}
</aside>`;
      return wrap(this.type, this.name, d, STYLES.eventContext, body);
    },
  },
];

/* ------------------------------------------------------------- utilities */

export function defaults(block) {
  const out = {};
  for (const f of block.fields) {
    if (f.type === "list") out[f.key] = Array.from({ length: f.min || 1 }, () => itemDefaults(f));
    else out[f.key] = f.default ?? "";
  }
  return out;
}
export function itemDefaults(listField) {
  return Object.fromEntries(listField.fields.map(f => [f.key, f.default ?? ""]));
}

export function missing(block, d) {
  const out = [];
  for (const f of block.fields) {
    if (f.type === "list") {
      const rows = (d[f.key] || []).filter(r => f.fields.some(sf => has(r[sf.key])));
      if ((f.min || 0) > rows.length) out.push(`${f.label}: add at least ${f.min}`);
      rows.forEach((r, i) => f.fields.forEach(sf => { if (sf.required && !has(r[sf.key])) out.push(`${f.itemLabel} ${i + 1}: ${sf.label}`); }));
    } else if (f.required && !has(d[f.key])) out.push(f.label);
  }
  return out;
}

export function render(block, data, { scripts = false, id = uid() } = {}) {
  return block.render(data, { scripts, id });
}
