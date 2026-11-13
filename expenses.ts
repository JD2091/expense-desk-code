// expenses.ts
// A tiny in-memory "expense system" for the demo.
// In a real project this would be your finance API, ERP or database.

export type ExpenseStatus = "pending" | "approved" | "rejected";
export type Decision = "approved" | "rejected";

export interface Expense {
  id: string;
  employee: string;
  category: string;
  amount: number;
  currency: string;
  submittedOn: string;
  note: string;
  status: ExpenseStatus;
  decisionReason?: string;
  decidedAt?: string;
}

export interface ExpenseStats {
  pending: number;
  approved: number;
  rejected: number;
  pendingAmount: number;
}

const SEED: Expense[] = [
  { id: "EXP-101", employee: "Asha Rao", category: "Travel", amount: 18450, currency: "INR",
    submittedOn: "2026-11-03", note: "Flight to Bengaluru for client workshop", status: "pending" },
  { id: "EXP-102", employee: "Rohan Mehta", category: "Meals", amount: 3200, currency: "INR",
    submittedOn: "2026-11-05", note: "Team dinner after release", status: "pending" },
  { id: "EXP-103", employee: "Neha Shah", category: "Software", amount: 7999, currency: "INR",
    submittedOn: "2026-11-06", note: "Annual licence for diagram tool", status: "pending" },
  { id: "EXP-104", employee: "Vikram Iyer", category: "Hotel", amount: 26500, currency: "INR",
    submittedOn: "2026-11-07", note: "3 nights, Pune customer visit", status: "pending" },
];

let expenses: Expense[] = structuredClone(SEED);

export function resetExpenses(): void {
  expenses = structuredClone(SEED);
}

export function listExpenses(): Expense[] {
  return structuredClone(expenses);
}

export function summarize(items: Expense[]): ExpenseStats {
  const pendingItems = items.filter((e) => e.status === "pending");
  return {
    pending: pendingItems.length,
    approved: items.filter((e) => e.status === "approved").length,
    rejected: items.filter((e) => e.status === "rejected").length,
    pendingAmount: pendingItems.reduce((sum, e) => sum + e.amount, 0),
  };
}

export function decideExpense(id: string, decision: Decision, reason?: string): Expense {
  const expense = expenses.find((e) => e.id === id);
  if (!expense) {
    throw new Error(`Expense ${id} was not found.`);
  }
  if (expense.status !== "pending") {
    throw new Error(`Expense ${id} is already ${expense.status}.`);
  }
  const cleanReason = reason?.trim();
  if (decision === "rejected" && !cleanReason) {
    throw new Error("A reason is required to reject an expense.");
  }
  expense.status = decision;
  expense.decisionReason = cleanReason || undefined;
  expense.decidedAt = new Date().toISOString();
  return structuredClone(expense);
}

export function formatMoney(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
