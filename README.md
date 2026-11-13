# Expense Approval Desk (MCP App)

A small MCP App: a model-facing tool (`review_expenses`) with an interactive UI, plus an app-only tool (`decide_expense`) so only a human click can approve or reject.

```bash
npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/client@^2.0.0 @modelcontextprotocol/server@^2.0.0 @modelcontextprotocol/node@^2.0.0 @modelcontextprotocol/express@^2.0.0 zod@^4.2.0 express cors
npm install -D typescript vite vite-plugin-singlefile @types/express @types/cors @types/node tsx concurrently cross-env
npm run build
npm start          # http://localhost:3001/mcp
```

Test with the reference host in https://github.com/modelcontextprotocol/ext-apps (`examples/basic-host`).
