import type { AppState, Expense, Roommate } from "./types";
import { supabase } from "./supabase";

export const STORAGE_KEY = "messmate-vite-v1";
export const DEFAULT_MONTH = new Date().toISOString().slice(0, 7);
export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"] as const;

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(dateString: string): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatMonth(month: string): string {
  if (!month) return "All Months";
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

export function inMonth(dateString: string, month: string): boolean {
  if (!month) return true;
  return dateString.startsWith(month);
}

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function makeDefaultState(): AppState {
  const users: Roommate[] = [
    { id: uid("user"), name: "Ayan" },
    { id: uid("user"), name: "Rafi" },
    { id: uid("user"), name: "Sohan" }
  ];

  return {
    appName: "Jamal MessWala",
    darkMode: false,
    selectedMonth: DEFAULT_MONTH,
    users,
    expenses: [
      {
        id: uid("expense"),
        itemName: "Vegetables",
        amount: 480,
        paidBy: users[0].id,
        date: today(),
        splitType: "meal",
        customShares: []
      },
      {
        id: uid("expense"),
        itemName: "Milk",
        amount: 180,
        paidBy: users[1].id,
        date: today(),
        splitType: "equal",
        customShares: []
      }
    ],
    meals: [
      {
        id: uid("meal"),
        date: today(),
        mealType: "Lunch",
        eaters: users.map((user) => user.id)
      }
    ],
    rations: [
      {
        id: uid("ration"),
        itemName: "Rice",
        quantity: "10",
        unit: "kg",
        amount: 720,
        paidBy: users[2].id,
        date: today(),
        notes: "Monthly stock"
      }
    ]
  };
}

export function readState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...makeDefaultState(),
      ...parsed,
      selectedMonth: parsed.selectedMonth || DEFAULT_MONTH,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      rations: Array.isArray(parsed.rations) ? parsed.rations : []
    };
  } catch {
    return makeDefaultState();
  }
}

const DB_ROW_ID = 1;

export async function loadFromSupabase(): Promise<AppState> {
  try {
    const { data, error } = await supabase
      .from("mess_data")
      .select("state")
      .eq("id", DB_ROW_ID)
      .single();

    if (error || !data) return makeDefaultState();

    const parsed = data.state as Partial<AppState>;
    if (!parsed || !parsed.users) return makeDefaultState();

    return {
      ...makeDefaultState(),
      ...parsed,
      selectedMonth: parsed.selectedMonth || DEFAULT_MONTH,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      rations: Array.isArray(parsed.rations) ? parsed.rations : []
    };
  } catch {
    return makeDefaultState();
  }
}

export async function saveToSupabase(state: AppState): Promise<void> {
  await supabase
    .from("mess_data")
    .upsert({ id: DB_ROW_ID, state, updated_at: new Date().toISOString() });
}

export interface PersonSummary {
  id: string;
  name: string;
  meals: number;
  paid: number;
  owes: number;
  balance: number;
  status: "plus" | "minus";
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface RationSummary {
  itemName: string;
  quantity: number;
  unit: string;
  spend: number;
}

export interface MonthSummary {
  people: PersonSummary[];
  settlements: Settlement[];
  totalExpenses: number;
  totalMeals: number;
  totalRationSpend: number;
  rationSummary: RationSummary[];
  expenses: Expense[];
  meals: AppState["meals"];
  rations: AppState["rations"];
}

export function summarizeMonth(state: AppState): MonthSummary {
  const { selectedMonth, users } = state;
  const expenses = state.expenses.filter((entry) => inMonth(entry.date, selectedMonth));
  const meals = state.meals.filter((entry) => inMonth(entry.date, selectedMonth));
  const rations = state.rations.filter((entry) => inMonth(entry.date, selectedMonth));

  const mealCounts = Object.fromEntries(users.map((user) => [user.id, 0]));
  meals.forEach((meal) => {
    meal.eaters.forEach((userId) => {
      if (userId in mealCounts) {
        mealCounts[userId] += 1;
      }
    });
  });

  const paidTotals = Object.fromEntries(users.map((user) => [user.id, 0]));
  const owedTotals = Object.fromEntries(users.map((user) => [user.id, 0]));

  const sharedCosts: Expense[] = [
    ...expenses,
    ...rations.map((ration) => ({
      id: ration.id,
      itemName: `${ration.itemName} (Ration)`,
      amount: Number(ration.amount || 0),
      paidBy: ration.paidBy,
      date: ration.date,
      splitType: "meal" as const,
      customShares: []
    }))
  ];

  sharedCosts.forEach((expense) => {
    const amount = Number(expense.amount || 0);
    if (!amount) return;

    if (expense.paidBy in paidTotals) {
      paidTotals[expense.paidBy] += amount;
    }

    if (expense.splitType === "equal") {
      const share = users.length ? amount / users.length : 0;
      users.forEach((user) => {
        owedTotals[user.id] += share;
      });
      return;
    }

    if (expense.splitType === "custom") {
      users.forEach((user) => {
        const share = expense.customShares.find((entry) => entry.userId === user.id)?.amount ?? 0;
        owedTotals[user.id] += share;
      });
      return;
    }

    const totalMeals = Object.values(mealCounts).reduce((sum, count) => sum + count, 0);
    if (!totalMeals) {
      const share = users.length ? amount / users.length : 0;
      users.forEach((user) => {
        owedTotals[user.id] += share;
      });
      return;
    }

    users.forEach((user) => {
      owedTotals[user.id] += (amount * mealCounts[user.id]) / totalMeals;
    });
  });

  const people: PersonSummary[] = users.map((user) => {
    const paid = paidTotals[user.id] || 0;
    const owes = owedTotals[user.id] || 0;
    const balance = paid - owes;
    return {
      id: user.id,
      name: user.name,
      meals: mealCounts[user.id] || 0,
      paid,
      owes,
      balance,
      status: balance >= 0 ? "plus" : "minus"
    };
  });

  const creditors = people
    .filter((person) => person.balance > 0.01)
    .map((person) => ({ ...person, remaining: person.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = people
    .filter((person) => person.balance < -0.01)
    .map((person) => ({ ...person, remaining: Math.abs(person.balance) }))
    .sort((a, b) => b.remaining - a.remaining);

  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.remaining, debtor.remaining);

    if (amount > 0.01) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount
      });
    }

    creditor.remaining -= amount;
    debtor.remaining -= amount;

    if (creditor.remaining <= 0.01) creditorIndex += 1;
    if (debtor.remaining <= 0.01) debtorIndex += 1;
  }

  const totalExpenses = sharedCosts.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalMeals = Object.values(mealCounts).reduce((sum, count) => sum + count, 0);
  const totalRationSpend = rations.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const rationMap = new Map<string, RationSummary>();
  rations.forEach((ration) => {
    const key = ration.itemName.trim().toLowerCase();
    if (!key) return;
    const current = rationMap.get(key) ?? {
      itemName: ration.itemName,
      quantity: 0,
      unit: ration.unit,
      spend: 0
    };
    current.quantity += Number(ration.quantity || 0);
    current.spend += Number(ration.amount || 0);
    rationMap.set(key, current);
  });

  return {
    people,
    settlements,
    totalExpenses,
    totalMeals,
    totalRationSpend,
    rationSummary: [...rationMap.values()].sort((a, b) => b.spend - a.spend),
    expenses,
    meals,
    rations
  };
}
