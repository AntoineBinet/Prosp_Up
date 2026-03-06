# ProspUp — CRM Prospection B2B (Up Technologies)

## Stack technique
- **Backend** : Flask (app.py ~7000 lignes), SQLite, Waitress WSGI en prod
- **Frontend** : Vanilla JS (pas de framework), 20 pages HTML standalone
- **CSS** : Glassmorphism dark theme, `prefers-color-scheme` pour light mode
- **PWA** : Service Worker (sw.js), manifest.json, offline.html
- **Hebergement** : Cloudflare Tunnel → prospup.work, port 8000
- **Tests E2E** : Playwright (Chromium), 38 tests (desktop + mobile Pixel 5)

## Architecture fichiers
```
app.py                  # Backend Flask — routes, API, auth, DB
static/
  css/style.css         # ~7200 lignes, tout le style
  js/app.js             # ~7200 lignes, logique globale (showToast, fetch wrappers…)
  js/page-*.js          # Un fichier JS par page (page-dashboard.js, page-focus.js…)
  js/v8-features.js     # Features transversales (SW registration, bottom nav, haptic, error states)
  js/metiers-data.js    # Donnees metiers statiques
  js/notifications.js   # Push notifications
  sw.js                 # Service Worker (cache shell + API runtime cache)
  manifest.json         # PWA manifest (shortcuts, share_target, maskable icon)
*.html                  # 20 pages (index, dashboard, focus, login, entreprises…)
offline.html            # Fallback hors-ligne
tests/e2e/              # Tests Playwright
  auth.setup.js         # Auth session persistee
  *.spec.js             # login, dashboard, prospects, focus, navigation, mobile, pwa
minify.py               # Script de minification CSS/JS (rjsmin, csscompressor)
playwright.config.js    # Config Playwright (2 projets: desktop-chrome, mobile-pixel5)
```

## Auth
- Session cookie Flask (`session['user_id']`)
- `@app.before_request` protege toutes les routes sauf /login, /static, /api/auth/
- Login via POST `/api/auth/login` avec `{username, password}` JSON
- Roles : admin, editor, reader (reader = lecture seule)
- Multi-tenant : `owner_id` sur chaque enregistrement

## Conventions
- `APP_VERSION` dans app.py (actuellement "22.0") — incrementer a chaque release
- Cache busters automatiques : app.py calcule les hash MD5 des fichiers statiques au demarrage et remplace `?v=XXXX` dans le HTML
- Pas de bundler/build system — fichiers servis directement par Flask
- Scripts avec `defer` sur toutes les pages (sauf Chart.js CDN dans stats.html)
- Service Worker : network-first pour HTML/API, cache-first pour static assets
- Toast notifications via `window.showToast(msg, type, duration)` dans app.js
- Haptic feedback via `window.haptic(ms)` dans v8-features.js

## Commandes utiles
```bash
python app.py                    # Dev server (port 8000, debug=True)
python app.py --prod             # Prod avec Waitress
npx playwright test              # Lancer les 38 tests E2E
npx playwright test --headed     # Tests avec navigateur visible
python minify.py                 # Minifier CSS/JS
```

## Points d'attention
- Le dossier est sur OneDrive — les chemins contiennent des espaces, toujours quoter
- Python sur ce PC : Python 3.14, encodage console cp1252 → utiliser PYTHONIOENCODING=utf-8 pour Playwright
- Les identifiants de test par defaut sont admin/admin (configurable via PROSPUP_USER/PROSPUP_PASS)
- Ne jamais ajouter `cache: 'no-store'` aux fetch — le SW et les headers Cache-Control gerent le cache
