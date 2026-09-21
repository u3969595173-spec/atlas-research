# Atlas Research

Aplicación de análisis deportivo y control personal. No realiza búsquedas de apuestas ni garantiza resultados.

## Despliegue en la nube

1. Crea un nuevo **Blueprint** en Render usando este repositorio; `render.yaml` crea la API y PostgreSQL.
2. Tras desplegar Render, copia la URL de la API y define `CLIENT_ORIGIN` con la URL final de Netlify.
3. Importa el repositorio en Netlify. Define `VITE_API_URL` con la URL de Render y despliega.

Nunca incluyas credenciales en `.env` dentro del repositorio. Usa el panel de variables de entorno de cada proveedor.# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
