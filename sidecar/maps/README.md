# Offline field map (no internet)

1. On a networked PC, from `sidecar/`:
   ```
   node maps/fetch-area.mjs --lat 48.45 --lon 34.98 --radius-km 15 --zmin 11 --zmax 15
   ```
   Copy the whole `sidecar/maps/tiles/` folder onto the operator laptop.

2. Start the side-car. It serves:
   `http://127.0.0.1:8787/map/tiles/{z}/{x}/{y}.png`

3. HMI uses local tiles first (MAP LOCAL). If the pack is missing it tries Carto online, then a schematic fallback.

Tiles are Carto Dark Matter / OSM — free for this use; keep the © OSM © CARTO attribution on screen.
