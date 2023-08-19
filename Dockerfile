FROM oven/bun:0.6.9
WORKDIR /app
COPY . .
RUN bun install --production
RUN bun build src/client/index.jsx --outdir public --minify
CMD ["bun", "run", "src/server/game.ts", "--production"]
EXPOSE 3000