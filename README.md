# fost-beat

Embeds for the [FOSTBeat](https://beat.joinfost.io) blog, served with GitHub Pages.

## Data centre moratorium map

`moratorium-map.html` is a Leaflet map of the
[FOSTBeat data centre moratorium tracker](https://docs.google.com/spreadsheets/d/1Rcciv20Lippo6uRTu_Sk33c1Vul8lq2kcvz4NfkEdsk/edit?usp=sharing).
It reads the Google Sheet live on every page load (and every 10 minutes while open),
so new rows show up without redeploying.

Live at: https://mgboydcom.github.io/fost-beat/moratorium-map.html

The blog inserts post HTML with `innerHTML`, which never runs `<script>` tags, so embed the
map in a post with an iframe:

```html
<iframe src="https://mgboydcom.github.io/fost-beat/moratorium-map.html"
        title="Data centre moratorium map"
        style="width:100%;height:620px;border:0" loading="lazy"></iframe>
```

Locations come from the sheet's `jurisdiction` + `country` via OpenStreetMap Nominatim.
Add `lat` / `lng` columns to the sheet to pin a row exactly.
