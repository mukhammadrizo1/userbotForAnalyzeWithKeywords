# UTY UserBot & Dashboard - Deploy Qo'llanmasi (O'zbek tilida)

Ushbu qo'llanma orqali loyihaning **Backend** (NestJS + Telegram Userbot) qismini **Render.com** da, **Frontend** (Angular + Tailwind) qismini esa **Vercel.com** da bepul deploy qilasiz.

---

## 1-Qadam: Gitga yuklash (GitHub)

Baza ma'lumotlari (`Neon PostgreSQL`) ga to'liq ko'chirilgan va sessiya fayllari `.gitignore` orqali himoyalangan.

TerminaIda quyidagi buyruqlarni bajaring:

```bash
git add .
git commit -m "feat: migrate backend to NestJS and frontend to Angular"
git push origin main
```

---

## 2-Qadam: Backendni Render.com ga Deploy qilish

1. [render.com](https://render.com) ga kiring va hisobingizga kiring.
2. **New +** tugmasini bosing va **Web Service** ni tanlang.
3. GitHub dagi `userbotForAnalyzeWithKeywords` repozitoriyangizni ulang (**Connect**).
4. Sozlamalarni quyidagicha to'ldiring:
   - **Name:** `uty-userbot-backend`
   - **Region:** `Frankfurt (EU Central)` yoki `Singapore`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
   - **Instance Type:** `Free`

5. **Environment Variables** (Muhit o'zgaruvchilari) bo'limiga quyidagi kalitlarni kiriting:

| Kalit nomi (Key) | Qiymati (Value) | Izoh |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Ishlab chiqarish muhiti |
| `PORT` | `10000` | Render porti |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_uRXdETg21CDK@ep-rapid-surf-b3xoz5mb-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Neon PostgreSQL bog'lanish havolasi |
| `TELEGRAM_API_ID` | `SIZNING_TELEGRAM_API_ID` | my.telegram.org dan olingan raqam |
| `TELEGRAM_API_HASH` | `SIZNING_TELEGRAM_API_HASH` | my.telegram.org dan olingan hash |
| `TELEGRAM_STRING_SESSION` | `backend/.env` faylingizdagi string sessiya kodi | Userbot sessiyasi (bir qatorda) |
| `GROQ_API_KEY` | `gsk_...` | console.groq.com dan bepul API kalit |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | AI modeli |
| `JWT_SECRET` | `uty_userbot_secret_jwt_key_2026` | Ixtiyoriy maxfiy kalit |
| `DASHBOARD_USERNAME` | `admin` | Dashboardga kirish logini |
| `DASHBOARD_PASSWORD` | `admin123` | Dashboardga kirish paroli (o'zingiz xohlagan parol) |

6. **Create Web Service** tugmasini bosing.
7. Deploy jarayoni tugagach, Render sizga quyidagicha manzil beradi:
   `https://uty-userbot-backend.onrender.com`

---

## 3-Qadam: Frontendni Vercel.com ga Deploy qilish

1. [vercel.com](https://vercel.com) ga kiring va GitHub profilingiz orqali tizimga kiring.
2. **Add New...** -> **Project** tugmasini bosing.
3. Repozitoriyangizni tanlang (**Import**).
4. Loyiha sozlamalarida quyidagilarni belgilang:
   - **Framework Preset:** `Angular`
   - **Root Directory:** `Edit` tugmasini bosib, `frontend` papkasini tanlang.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist/frontend-app/browser`
5. **Deploy** tugmasini bosing.
6. Bir necha daqiqada sizning Vercel havolangiz tayyor bo'ladi:
   `https://uty-userbot-frontend.vercel.app`

---

## 4-Qadam: Frontendni Backend bilan ulash

1. Vercel dagi saytingizga kiring (`/login`).
2. Login: `admin`, Parol: `admin123` (yoki o'rnatgan parolingiz).
3. Dashboard ochilgach, **⚙️ Tizim & Holat** bo'limiga o'ting.
4. **Backend API Manzili (Render / Server URL)** qatoriga Render dagi havolangizni yozing:
   `https://uty-userbot-backend.onrender.com`
5. **Saqlash** tugmasini bosing.
6. Barcha kanallar, kalit so'zlar, guruhlar va tarix ko'rinadi!

---

## 5-Qadam: Render.com Uxlab qolmasligi uchun (24/7 Keep-Alive)

Render.com ning bepul tarifida veb-servis 15 daqiqa murojaat bo'lmasa uxlab qoladi. Buni oldini olish juda oson:

1. [uptimerobot.com](https://uptimerobot.com) yoki [cron-job.org](https://cron-job.org) saytiga kiring (bepul).
2. **Add New Monitor** tugmasini bosing.
3. **Monitor Type:** `HTTP(s)`
4. **Friendly Name:** `UTY UserBot KeepAlive`
5. **URL (or IP):** `https://uty-userbot-backend.onrender.com/api/ping`
6. **Monitoring Interval:** `Every 5 minutes` (har 5 daqiqada).
7. **Create Monitor** ni bosing.
8. Endi Userbot va Backend 24/7 uzluksiz ishlab turadi!
