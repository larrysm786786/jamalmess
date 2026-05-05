# MessMate

MessMate is a React + TypeScript + Tailwind CSS app for managing a shared bachelor mess system.

## Features

- Roommate management
- Expense tracking with meal, equal, and custom splits
- Meal logging
- Ration tracking
- Monthly settlement summary
- Dark mode
- Local backup and restore

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## GitHub Pages deployment

Push this project to a GitHub repository and enable GitHub Pages with the GitHub Actions source. The workflow in `.github/workflows/deploy.yml` will build and publish the `dist` folder automatically whenever you push to the `main` branch.

Note: app data is currently stored in browser `localStorage`, so it stays per browser/device and does not sync automatically.
