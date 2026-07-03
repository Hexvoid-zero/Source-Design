<div align="center">
  <img src="Docs/Logo with anme.png" alt="Source-Design" width="235">
</p>
  
# Source Design
  Source Design is a premium web application and developer utility designed to inspect, extract, and compile production-grade design tokens from live websites into semantic, ready-to-use configurations (Tailwind CSS, CSS variables, and JSON design tokens).
    <a href="https://x.com/Source__Design"><img src="https://img.shields.io/badge/Follow-%40Source__Design-000000?style=flat&logo=x&logoColor=white" alt="Follow on X" /></a>
<img width="615" height="615" alt="image" src="https://github.com/user-attachments/assets/015393ef-a4e5-46b1-971d-8552867d4cb4" />


<div align="left">


## Features

- **Live Design Extractor**: Enter a website URL to automatically mine its active color palettes, font pairings, border radii, spacing systems, and custom properties.
- **Semantic Compiler**: Dynamically maps raw extracted colors, sizes, and styling data into semantic components and tokens (e.g. `colors.primary`, `colors.canvas`, `typography.display-xl`).
- **Design Systems Gallery**: Access a pre-extracted gallery of 22 leading digital products (Vercel, Supabase, Netflix, Perplexity, GitHub, and more) at `/designs`.
- **Ready-to-Use Formats**: Copy code-ready tokens instantly:
  - **`DESIGN.md`**: Beautiful, editorial-style overview of the website's design philosophy and hierarchy.
  - **`tailwind.css`**: Complete Tailwind v4 `@theme` configuration.
  - **`variables.css`**: Standard CSS Custom Properties (`:root`).
  - **`tokens.json`**: Standard JSON Design Tokens.
- **Glassmorphic Navigation**: Premium glass-like header with smooth hover micro-animations.

---

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build and Deploy

To build the application for production:
```bash
npm run build
```

The application can be deployed directly to [Vercel](https://vercel.com/):
```bash
npx vercel --prod
```

---

## Directory Structure

```text
├── app/                  # Next.js App Router (pages and API routes)
│   ├── api/              # Extractor & statistics API endpoints
│   ├── designs/          # Design details & gallery pages
│   └── page.jsx          # Home page interface
├── components/           # Reusable UI components (SiteHeader, DesignsList, etc.)
├── lib/                  # Extraction engine and Ready Designs data
│   ├── ready/            # Pre-extracted JSON definitions for 22 sites
│   └── extract.js        # Core token parsing and mapping engine
├── public/               # Public assets and cleaned transparent logo PNGs
├── scripts/              # Build scripts for compiling ready design lists
└── package.json          # Dependency and script definitions
```

## Star History

<a href="https://www.star-history.com/?type=date&repos=Source-Design%2FSource-Design">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Source-Design/Source-Design&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Source-Design/Source-Design&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Source-Design/Source-Design&type=date&legend=top-left" />
 </picture>
</a>
