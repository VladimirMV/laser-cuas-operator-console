/**
 * Pre-download Carto Dark Matter tiles for offline field use.
 *
 *   node maps/fetch-area.mjs --lat 48.45 --lon 34.98 --radius-km 15 --zmin 11 --zmax 15
 *
 * Run WHILE you have internet. Then start sidecar; HMI uses /map/tiles locally.
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'tiles')

function arg(name, def) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : def
}

const lat = Number(arg('--lat', '48.45'))
const lon = Number(arg('--lon', '34.98'))
const radiusKm = Number(arg('--radius-km', '12'))
const zmin = Number(arg('--zmin', '11'))
const zmax = Number(arg('--zmax', '15'))

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z)
}
function lat2tile(lat, z) {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

const dLat = radiusKm / 111
const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))
const jobs = []
for (let z = zmin; z <= zmax; z++) {
  const x0 = lon2tile(lon - dLon, z)
  const x1 = lon2tile(lon + dLon, z)
  const y0 = lat2tile(lat + dLat, z)
  const y1 = lat2tile(lat - dLat, z)
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      jobs.push({ z, x, y })
    }
  }
}

console.log(`[map-fetch] ${jobs.length} tiles  z${zmin}-${zmax}  center ${lat},${lon}  r=${radiusKm}km`)

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'CLT-HMI-offline-map/1.0' } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error('HTTP ' + res.statusCode))
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

async function main() {
  let ok = 0
  let skip = 0
  for (const j of jobs) {
    const dir = path.join(OUT, String(j.z), String(j.x))
    const file = path.join(dir, `${j.y}.png`)
    if (fs.existsSync(file) && fs.statSync(file).size > 200) {
      skip++
      continue
    }
    fs.mkdirSync(dir, { recursive: true })
    const url = `https://a.basemaps.cartocdn.com/dark_all/${j.z}/${j.x}/${j.y}.png`
    try {
      const buf = await get(url)
      fs.writeFileSync(file, buf)
      ok++
      if (ok % 25 === 0) console.log(`[map-fetch] saved ${ok}/${jobs.length}`)
    } catch (e) {
      console.warn(`[map-fetch] fail ${j.z}/${j.x}/${j.y}`, e.message)
    }
    await new Promise((r) => setTimeout(r, 40))
  }
  console.log(`[map-fetch] done ok=${ok} skip=${skip} total=${jobs.length} → ${OUT}`)
}

main()
