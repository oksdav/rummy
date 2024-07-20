FROM oven/bun:1.1-alpine
WORKDIR /app
RUN apk update && \
    apk upgrade && \
    apk add --no-cache git
RUN git clone --depth 1 https://github.com/oksdav/rummy.git
WORKDIR /app/rummy
RUN bun install --production
RUN bun build src/client/index.jsx --outdir public --minify
EXPOSE 3000
CMD ["bun", "run", "src/server/game.ts"]