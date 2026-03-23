# 2FA Now

Minimalist TOTP 2FA code generator. Supports secret keys and `otpauth://` URIs with optional cloud sync via GitHub login.

![Screenshot](public/screenshot.png)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sachnun/2fa-now&env=DATABASE_URL,AUTH_SECRET,AUTH_GITHUB_ID,AUTH_GITHUB_SECRET)

## Setup

```bash
git clone https://github.com/sachnun/2fa-now.git
cd 2fa-now
npm install
```

Configure environment variables:

```bash
cp .env.example .env
```

Then edit `.env` with your actual values.

Run:

```bash
npx prisma migrate deploy
npm run dev
```
