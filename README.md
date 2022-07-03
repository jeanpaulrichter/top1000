# Wasted Top1000

Abstimmungstool um der community von wasted.de zu ermöglichen, die besten 1000 Spiele aller Zeiten zu ermitteln. Icon & Farbe gestohlen von ebendort. Leider noch ohne Memeschlachtfunktionalität.

1. ```bash
git clone https://github.com/jeanpaulrichter/top1000.git
cd top1000
```
2. Erstelle und ergänze Datei backend/src/config.ts
```typescript
const config = {
    "email": {
        "server": "",
        "port": 587,
        "address": '"Wasted Top1000 👻" <top1000@bla.de>',
        "user": "",
        "password": ""
    },
    "base_url": "http://top1000.bla.de",
    "moby_api_key": "",
    "mongodb": "",
    "database": "top1000",
    "port": 8001
}
export default config;
```

3. ```bash
node ./scripts/build.js
node ./built/src/index.js
```

Unter data/top1000.gz findet sich ein dump der benötigten MongoDB Datenbank.

Einfachste Entwicklungsumgebung wahrscheinlich vscode (task: watch & nodemon)