FROM node:26-slim
# Node 26 ships without corepack.
RUN npm install -g pnpm@12.15.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && pnpm start"]
