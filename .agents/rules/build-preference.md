# Build Policy

- Never run local release builds or heavy packaging (e.g. `npm run dist` / `electron-builder`) directly on the user's PC.
- All application builds and packaging must be delegated to GitHub Actions workflows (e.g. `.github/workflows/windows-build.yml`).
- Keep local builds limited only to running unit tests (`npm test` / `node --test`) and development verification.
