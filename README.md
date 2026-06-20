# Praxis

Base desktop com Tauri 2, Vue 3, Vite, TypeScript, Pinia e TailwindCSS.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run tauri dev
```

## Estrutura

```text
src/
  app/          bootstrap, layouts e estilos globais
  features/     modulos de produto por contexto
  pages/        telas compostas a partir de features/shared
  shared/       componentes, libs e tipos reutilizaveis
  stores/       stores Pinia globais ou transversais
src-tauri/      backend Rust e configuracao Tauri
```
