// server.ts
// Registers ONE model-facing tool with a UI, ONE app-only tool, and the UI resource.
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { decideExpense, formatMoney, listExpenses, summarize } from "./expenses.js";

const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");

// The ui:// address of our interface. The tool points at it; the resource serves it.
const RESOURCE_URI = "ui://expense-desk/mcp-app.html";

// One helper builds every tool result in two shapes:
//   content           -> plain text for the model (and for hosts without UI support)
//   structuredContent -> clean JSON for the UI to render
function deskResult(headline?: string) {
  const expenses = listExpenses();
  const stats = summarize(expenses);
  const pendingLines = expenses
    .filter((e) => e.status === "pending")
    .map((e) => `- ${e.id} | ${e.employee} | ${e.category} | ${formatMoney(e.amount, e.currency)} | ${e.note}`);

  const text = [
    headline,
    `Pending: ${stats.pending} (${formatMoney(stats.pendingAmount)}), ` +
      `approved: ${stats.approved}, rejected: ${stats.rejected}.`,
    ...pendingLines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { expenses, stats },
  };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "Expense Approval Desk", version: "1.0.0" });

  // 1) Model-facing tool. The model can call it; the host renders the linked UI.
  registerAppTool(
    server,
    "review_expenses",
    {
      title: "Review expense claims",
      description:
        "Opens the expense approval desk with all pending expense claims. " +
        "A human approves or rejects each claim in the interface.",
      inputSchema: z.object({}),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async () => deskResult(),
  );

  // 2) App-only tool. Only the UI can call it. The model never sees it in tools/list,
  //    so an approval can only come from a human click.
  registerAppTool(
    server,
    "decide_expense",
    {
      title: "Approve or reject an expense",
      description: "Records a human decision on one expense claim.",
      inputSchema: z.object({
        id: z.string(),
        decision: z.enum(["approved", "rejected"]),
        reason: z.string().max(200).optional(),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ["app"] } },
    },
    async ({ id, decision, reason }) => {
      try {
        const expense = decideExpense(id, decision, reason);
        return deskResult(`${expense.id} ${expense.status} by reviewer.`);
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: (error as Error).message }],
        };
      }
    },
  );

  // 3) The UI resource: a single bundled HTML file built by Vite.
  registerAppResource(server, RESOURCE_URI, RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => {
    const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
    return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  });

  return server;
}
