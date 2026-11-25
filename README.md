# Tanker backend

The backend is an Express API using MongoDB. Authentication is invitation-only;
all users enroll TOTP authenticator MFA, and browser sessions expire after
eight hours.

## Local setup

Use Node.js 20 or newer. Start MongoDB locally, or set `MONGODB_URI` to your
MongoDB Atlas connection string.

For Windows, install MongoDB Community Server from the
[official MongoDB download page](https://www.mongodb.com/try/download/community)
and run it as a local service.

```powershell
Copy-Item .env.example .env
$key = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
(Get-Content .env) -replace '^MFA_ENCRYPTION_KEY=.*$', "MFA_ENCRYPTION_KEY=$key" | Set-Content -Encoding utf8 .env
npm install
npm run dev
```

Keep the generated `MFA_ENCRYPTION_KEY` private and backed up securely. It
encrypts authenticator secrets stored in MongoDB; losing it prevents those
secrets from being decrypted.

The API listens at `http://localhost:5000`. From the workspace root,
`npm run dev` starts both the backend and frontend together.

## Create the first Owner/Admin

After MongoDB is connected, run this once from `tanker-backend`:

```powershell
npm run create-owner -- owner@example.com "Owner Name"
```

Open the one-time activation link printed by the command. It expires after 24
hours. Choose a password of at least 12 characters and enroll an authenticator
app by scanning the QR code. There is no public registration endpoint.

Owner/Admin users can invite staff from `/users`. The generated activation link
must be shared securely with that person; email delivery is not configured.
Roles and per-module/action permissions are managed by Owner/Admin.

## Security behavior

- Passwords use Node.js `scrypt`; session tokens are random, stored hashed, and
  held in `HttpOnly`, `SameSite=Lax` cookies.
- TOTP secrets are encrypted with AES-256-GCM using `MFA_ENCRYPTION_KEY`.
- Login and MFA enrollment attempts are rate limited.
- Mutating browser requests must match the configured `CORS_ORIGIN`.
- Users cannot self-register. Disabled users cannot start authenticated sessions.

## API and scripts

- `GET /api/health` — API and MongoDB readiness
- `/api/auth` — login, invitation activation, MFA enrollment, current user, logout
- `/api/users` — Owner/Admin user listing and invitations
- `/api/roles` — Owner/Admin role permission configuration
- `npm run dev` — start with Node watch mode
- `npm start` — start the API
- `npm run create-owner -- <email> "<display name>"` — bootstrap the first Owner/Admin
- `npm test` — run backend unit tests
