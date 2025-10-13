# ----------------------------------------------------
# Backend - Production image (alpine + pnpm hardened)
# ----------------------------------------------------
FROM node:22-alpine

# TLS/DNS/compat ที่มักต้องใช้เวลา fetch packages
RUN apk add --no-cache libc6-compat ca-certificates curl && update-ca-certificates

WORKDIR /app

# ให้ Node ชอบ IPv4 ก่อน (ช่วยเคส ENETUNREACH/AAAA)
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# ใช้ pnpm เวอร์ชัน “ตายตัว” (อย่า latest)
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

# ทำให้ pnpm ทนเน็ตช้า/ไม่นิ่ง + ลด parallel
RUN pnpm config set fetch-retries 5 \
 && pnpm config set fetch-retry-maxtimeout 120000 \
 && pnpm config set network-concurrency 1 \
 && pnpm config set verify-store-integrity false

# (ตัวเลือก) ถ้าเครือข่ายคุณไป npmjs ยาก ให้เปิด mirror ชั่วคราวบรรทัดนี้
# RUN pnpm config set registry https://registry.npmmirror.com

# คัดลอกไฟล์ที่เกี่ยวกับ dependency ก่อนเพื่อให้ cache ได้
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY db ./db

# ติดตั้ง dependencies ตาม lockfile (ไม่แก้เวอร์ชัน)
RUN pnpm install --frozen-lockfile --ignore-scripts

# คัดลอกซอร์สโค้ด
COPY src ./src

# build TypeScript -> dist และแก้ path alias หลัง build
RUN pnpm run build && pnpm exec tsc-alias -p tsconfig.json

ENV NODE_ENV=production

# แอปฟังที่ BACKEND_PORT=5002 (ตามโค้ด) → expose 5002 ในคอนเทนเนอร์
EXPOSE 5002

# รันไฟล์ที่ build แล้วตรง ๆ (ไม่ผูกกับ npm/pnpm)
CMD ["node", "dist/src/server.js"]
