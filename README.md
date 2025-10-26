# 🛠️ PJT Inventory — Backend (Express + Drizzle + MySQL)

Backend สำหรับระบบ **PJT Inventory System**  
ใช้ Node.js + Express + TypeScript + Drizzle ORM เชื่อมต่อฐานข้อมูล MySQL  
เป็นส่วนที่ทำหน้าที่จัดการข้อมูลสินค้า ผู้จัดจำหน่าย การรับสินค้าเข้า–ออก และระบบสิทธิ์ผู้ใช้งาน  
พร้อมรองรับการยืนยันตัวตนผ่าน **Google OAuth2** และการเชื่อมต่อกับ Frontend (Next.js) ผ่าน REST API

---

## 🧭 เกี่ยวกับโปรเจกต์นี้

PJT Inventory คือระบบจัดการคลังสินค้าแบบครบวงจรที่พัฒนาเพื่อใช้ภายในองค์กร  
โดยมีเป้าหมายให้สามารถติดตามสถานะสินค้าได้แบบเรียลไทม์  
ลดความซ้ำซ้อนของข้อมูล และเพิ่มความโปร่งใสในการจัดเก็บข้อมูลสินค้าแต่ละประเภท

## 🚀 ขั้นตอนการใช้งาน

### 1️⃣ ติดตั้งเครื่องมือพื้นฐาน
ก่อนเริ่มต้น ควรตรวจสอบว่ามีเครื่องมือเหล่านี้ในเครื่องแล้ว:
- [Node.js 22+](https://nodejs.org/)
- [pnpm](https://pnpm.io) (สามารถเปิดใช้งานผ่าน `corepack enable`)
- [Docker](https://www.docker.com/) และ Docker Compose

---

### 2️⃣ ติดตั้ง Dependencies
ติดตั้งแพ็กเกจทั้งหมดที่จำเป็นสำหรับการพัฒนา:

- pnpm install

### 3️⃣ ตั้งค่า Environment Variables
คัดลอกไฟล์ตัวอย่าง .env.example แล้วแก้ไขค่าตามเครื่องของคุณ:

- cp .env.example .env

### 4️⃣ รันระบบด้วย Docker Compose (โหมด Production)
สร้างและรัน container ของโปรเจกต์ทั้งหมด:

- docker compose up -d
- pnpm db:push
- pnpm db:seed

### 5️⃣ รันระบบในโหมดพัฒนา (Local Development)
ถ้าต้องการรันโดยตรงจากเครื่องแทน Docker:

- npm run dev