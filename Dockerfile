FROM oven/bun:1.1-slim
WORKDIR /app
RUN apt update && \
    apt upgrade -y && \
    apt install -y git && \
    apt clean && \
    rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/oksdav/rummy.git
WORKDIR /app/rummy
RUN bun install --production
RUN bun build src/client/index.jsx --outdir public --minify
EXPOSE 3000
CMD ["bun", "run", "src/server/game.ts"]