# ----------------------------------------------------
# Backend - Production image
# ----------------------------------------------------
FROM node:22-alpine

# สำหรับ native modules บางตัว
RUN apk add --no-cache libc6-compat

WORKDIR /app

# เปิด corepack เพื่อใช้ pnpm
RUN corepack enable

# คัดลอกไฟล์ที่เกี่ยวกับ dependency ก่อนเพื่อให้ cache ได้
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY db ./db

# ติดตั้ง dependencies ตาม lockfile (ไม่แก้เวอร์ชัน)
RUN pnpm install --frozen-lockfile

# คัดลอกซอร์สโค้ด
COPY src ./src

# build TypeScript -> dist และแก้ path alias หลัง build
RUN pnpm run build && pnpm exec tsc-alias -p tsconfig.json

ENV NODE_ENV=production

# แอปฟังที่ BACKEND_PORT=5002 (ตามโค้ด) → expose 5002 ในคอนเทนเนอร์
EXPOSE 5002

# รันไฟล์ที่ build แล้วตรง ๆ (ไม่ผูกกับ npm/pnpm)
CMD ["node", "dist/src/server.js"]