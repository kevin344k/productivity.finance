# API local (SQLite)

Guarda usuarios y datos (separados por usuario) en `server/data/finance.db` (Node >= 22.5, usa `node:sqlite`).

## Ejecutar en la PC
```
npm run api
```
Para dejarla 24/7: `npx pm2 start npm --name finance-api -- run api` (luego `pm2 startup` + `pm2 save`). Los valores se leen de `server/.env`.

## Exponerla a Vercel
Usa un túnel HTTPS, p. ej. Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:4310`
(o un túnel con dominio propio para una URL fija).

## Variables en Vercel (Settings > Environment Variables)
- `API_URL` = URL pública del túnel (sin `/` final)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = (opcional) client ID de Google para mostrar el botón

## Google (opcional)
1. console.cloud.google.com > APIs y servicios > Credenciales > ID de cliente OAuth (tipo "Aplicación web").
2. En "Orígenes autorizados de JavaScript" agrega tu dominio de Vercel y `http://localhost:3000`.
3. Usa el mismo client ID en `GOOGLE_CLIENT_ID` (API en tu PC) y `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Vercel).

Para desarrollo local, crea `.env.local` con `API_URL=http://localhost:4310` (y el client ID si usas Google).
Los datos existentes de la versión sin usuarios pasan al primer usuario que se registre.
