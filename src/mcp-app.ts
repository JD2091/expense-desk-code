// src/mcp-app.ts
// The View: runs inside the host's sandboxed iframe and talks to the host over JSON-RPC.
import { App, applyDocumentTheme, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";

type Status = "pending" | "approved" | "rejected";
interface Expense {
  id: string; employee: string; category: string; amount: number; currency: string;
  submittedOn: string; note: string; status: Status; decisionReason?: string;
}
interface Stats { pending: number; approved: number; rejected: number; pendingAmount: number }
interface DeskData { expenses: Expense[]; stats: Stats }

const pendingEl = document.getElementById("pending")!;
const historyEl = document.getElementById("history")!;
const statsEl = document.getElementById("stats")!;
const errorEl = document.getElementById("error")!;
const emptyEl = document.getElementById("empty")!;
const askBtn = document.getElementById("ask-btn") as HTMLButtonElement;

const money = (n: number, c = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

let latest: DeskData | undefined;

// Build DOM with textContent only (never innerHTML) so data can't inject markup.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function render(data: DeskData) {
  latest = data;
  const { expenses, stats } = data;
  statsEl.textContent =
    `${stats.pending} pending (${money(stats.pendingAmount)}) · ${stats.approved} approved · ${stats.rejected} rejected`;

  pendingEl.replaceChildren();
  for (const e of expenses.filter((x) => x.status === "pending")) {
    const card = el("article", "", "card");
    card.dataset.id = e.id;

    const top = el("div", "", "row");
    top.append(el("strong", `${e.id} · ${e.employee}`), el("span", money(e.amount, e.currency), "amount"));

    const reason = el("input");
    reason.placeholder = "Reason (required to reject)";
    reason.maxLength = 200;

    const approve = el("button", "Approve", "approve");
    const reject = el("button", "Reject", "reject");
    approve.onclick = () => decide(e.id, "approved", reason.value, [approve, reject]);
    reject.onclick = () => decide(e.id, "rejected", reason.value, [approve, reject]);

    const actions = el("div", "", "actions");
    actions.append(reason, approve, reject);
    card.append(top, el("div", `${e.category} · submitted ${e.submittedOn}`, "meta"), el("div", e.note, "note"), actions);
    pendingEl.append(card);
  }
  emptyEl.hidden = stats.pending > 0;

  historyEl.replaceChildren(
    ...expenses
      .filter((x) => x.status !== "pending")
      .map((x) => el("li", `${x.id} ${x.status}${x.decisionReason ? ` – ${x.decisionReason}` : ""}`)),
  );
}

// Tell the model what the human did, without starting a new turn.
async function shareContextWithModel(data: DeskData) {
  const decided = data.expenses.filter((x) => x.status !== "pending");
  const lines = decided.map((x) => `${x.id} (${x.employee}, ${money(x.amount, x.currency)}): ${x.status}` +
    (x.decisionReason ? `, reason: ${x.decisionReason}` : ""));
  await app.updateModelContext({
    content: [{ type: "text", text: `Reviewer decisions so far:\n${lines.join("\n") || "none"}` }],
    structuredContent: { stats: data.stats, decisions: decided },
  });
}

async function decide(id: string, decision: "approved" | "rejected", reason: string, buttons: HTMLButtonElement[]) {
  errorEl.textContent = "";
  buttons.forEach((b) => (b.disabled = true));
  try {
    // Calls the app-only tool through the host. The model cannot call this tool itself.
    const result = await app.callServerTool({ name: "decide_expense", arguments: { id, decision, reason } });
    if (result.isError) {
      const msg = result.content?.find((c) => c.type === "text");
      errorEl.textContent = msg && "text" in msg ? msg.text : "The server rejected this decision.";
      return;
    }
    const data = result.structuredContent as unknown as DeskData;
    render(data);
    await shareContextWithModel(data);
  } catch (err) {
    errorEl.textContent = `Could not reach the server: ${(err as Error).message}`;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

const app = new App({ name: "Expense Approval Desk", version: "1.0.0" });

// Register handlers BEFORE connect() so the first tool result is not missed.
app.ontoolinput = () => {
  statsEl.textContent = "Loading claims…";
};

app.ontoolresult = (result) => {
  if (result.isError || !result.structuredContent) {
    errorEl.textContent = "Could not load expense claims.";
    return;
  }
  render(result.structuredContent as unknown as DeskData);
};

app.onhostcontextchanged = (ctx: McpUiHostContext) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
};

app.onteardown = async () => ({});

askBtn.onclick = async () => {
  if (!latest) return;
  // Posts a message into the chat as the user, which starts a new model turn.
  const { isError } = await app.sendMessage({
    role: "user",
    content: [{ type: "text", text: "Draft a short email to the finance team summarising the expense decisions I just made." }],
  });
  if (isError) errorEl.textContent = "The host did not accept the message.";
};

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
});
