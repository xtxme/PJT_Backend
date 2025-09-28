# Setup

- `pnpm install`
- `pnpm i express cors helmet morgan debug`
- `pnpm i typescript @tsconfig/node-lts @tsconfig/node-ts tsx tsc-alias`
- `pnpm i -D @types/cors @types/express @types/debug @types/morgan`
- `pnpm i -D @types/cors @types/express @types/debug @types/morgan @types/node cross-env nodemon`
- `pnpm i -D drizzle-kit`
- `pnpm add drizzle-orm mysql2 dotenv`
- `pnpm add uuid`
- `pnpm add -D @types/uuid`
- `docker compose up -d`
- `npm run db:push`
- `pnpm run dev`


# Setup from scratch

- See https://cmu.to/fullstack68

# edit package.json

"scripts": {
    "dev": "nodemon",
    "build": "tsc && tsc-alias",
    "start": "node ./dist/src/index.js",
    "db:generate": "cross-env NODE_OPTIONS='--import tsx' drizzle-kit generate",
    "db:push": "cross-env NODE_OPTIONS='--import tsx' drizzle-kit push",
    "db:migrate": "cross-env NODE_OPTIONS='--import tsx' drizzle-kit migrate",
    "db:prototype": "tsx ./db/prototype.ts"
  },