# Tanker backend

The backend is an Express API using MongoDB. Authentication is invitation-only;
users activate their account with a password, and browser sessions expire after
eight hours.

## Local setup

Use Node.js 20 or newer. Start MongoDB locally, or set `MONGODB_URI` to your
MongoDB Atlas connection string.

For Windows, install MongoDB Community Server from the
[official MongoDB download page](https://www.mongodb.com/try/download/community)
and install it as a Windows service. Start it from an elevated PowerShell:

```powershell
Start-Service MongoDB
Get-Service MongoDB
```

The backend health check must report `"database":{"status":"connected"}` before
sign-in or setup scripts can work. The default local connection is
`mongodb://127.0.0.1:27017/tanker_wash`.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The API listens at `http://localhost:5000`. From the workspace root,
`npm run dev` starts both the backend and frontend together.

For local development, create demo logins in a second backend terminal after
MongoDB is running:

```powershell
npm run create-users
```

This seed command is disabled when `NODE_ENV=production`. It creates these
password-only demo logins, skips any existing accounts without changing them,
and refuses remote MongoDB hosts unless explicitly enabled. For a confirmed
non-production Atlas database only, run:

```powershell
$env:ALLOW_REMOTE_DEMO_SEED = "true"
npm run create-users
Remove-Item Env:\ALLOW_REMOTE_DEMO_SEED
```

Never enable remote demo seeding for production. For a remote production
database, use the invitation-only `create-owner` workflow above.

- `admin@tanker.local` / `Admin@123456`
- `manager@tanker.local` / `Manager@123456`
- `operator@tanker.local` / `Operator@123456`
- `accountant@tanker.local` / `Accountant@123456`

## Create the first Owner/Admin

After MongoDB is connected, run this once from `tanker-backend`:

```powershell
npm run create-owner -- owner@example.com "Owner Name"
```

Open the one-time activation link printed by the command. It expires after 24
hours. Choose a password of at least 12 characters. There is no public
registration endpoint.

Owner/Admin users can invite staff from `/users`. The generated activation link
must be shared securely with that person; email delivery is not configured.
Roles and per-module/action permissions are managed by Owner/Admin.

## Security behavior

- Passwords use Node.js `scrypt`; session tokens are random, stored hashed, and
  held in `HttpOnly`, `SameSite=Lax` cookies.
- Login and invitation activation attempts are rate limited.
- Mutating browser requests must match the configured `CORS_ORIGIN`.
- Users cannot self-register. Disabled users cannot start authenticated sessions.

## API and scripts

- `GET /api/health` — API and MongoDB readiness
- `/api/auth` — password login, invitation activation, current user, logout
- `/api/users` — Owner/Admin user listing and invitations
- `/api/roles` — Owner/Admin role permission configuration
- `npm run dev` — start with Node watch mode
- `npm start` — start the API
- `npm run create-owner -- <email> "<display name>"` — bootstrap the first Owner/Admin
- `npm test` — run backend unit tests
