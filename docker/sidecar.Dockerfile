FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY sidecar/server.mjs sidecar/config.json sidecar/package.json ./
COPY sidecar/maps ./maps
ENV SIDECAR_HOST=0.0.0.0 \
    SIDECAR_PORT=8787 \
    MEDIA_ROOT=/data/media \
    FFMPEG_PATH=/usr/bin/ffmpeg
EXPOSE 8787
VOLUME ["/data/media"]
CMD ["node", "server.mjs"]
