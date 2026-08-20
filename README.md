# Laser C-UAS Operator Console

Private HMI demo for the laser directed-energy C-UAS station  
**Common Laser Technologies** / partner: ISP NASU.

## Features
- Three camera channels (LONG / WIDE / IR) with live HLS demo streams
- Stable multi-player switching (no restart on channel change)
- PIP previews of secondary cameras
- Modes: MANUAL / SEMI / AUTO
- Safety ladder: SAFE → ARM → FIRE
- Situation map, effector ladder, event log, BITE, calibration wizard
- UA / EN UI

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

## Build
```bash
npm run build
npm run preview
```

## Demo streams
| Channel | Source |
|---------|--------|
| LONG | ireplay.tv continuous |
| WIDE | Mux HLS demo |
| IR | Apple bipbop + thermal CSS |

## Version
v1.4.8
