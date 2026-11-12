# fost-beat

Embeds and tools for the [FOSTBeat](https://beat.joinfost.io) blog, served with GitHub Pages
from the `main` branch. Each project lives in its own folder.

| Folder | What it is |
|---|---|
| [`moratorium-tracker/`](moratorium-tracker/) | Data centre moratorium tracker: live Leaflet map for the blog, hourly location lookups, and the n8n workflow that fills the tracker sheet |

`moratorium-map.html` at the top level only redirects to
`moratorium-tracker/moratorium-map.html`, so iframes that use the old address keep working.
