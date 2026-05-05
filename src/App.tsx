import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, InfoBox, RecordCard, Row, SectionTitle, SummaryCard } from "./components";
import type { AppState, Expense, MealLog, MealType, RationEntry, SplitType } from "./types";
import {
  DEFAULT_MONTH,
  MEAL_TYPES,
  STORAGE_KEY,
  downloadFile,
  formatDate,
  formatMonth,
  makeDefaultState,
  money,
  readState,
  summarizeMonth,
  today,
  uid
} from "./utils";

type ExpenseFormState = {
  itemName: string;
  amount: string;
  paidBy: string;
  date: string;
  splitType: SplitType;
  customShares: Record<string, string>;
};

type MealFormState = {
  date: string;
  mealType: MealType;
  eaters: string[];
};

type RationFormState = {
  itemName: string;
  quantity: string;
  unit: string;
  amount: string;
  paidBy: string;
  date: string;
  notes: string;
};

const splitOptions: { value: SplitType; label: string }[] = [
  { value: "meal", label: "By meals" },
  { value: "equal", label: "Equal split" },
  { value: "custom", label: "Custom split" }
];

function emptyExpenseForm(defaultPayer = ""): ExpenseFormState {
  return {
    itemName: "",
    amount: "",
    paidBy: defaultPayer,
    date: today(),
    splitType: "meal",
    customShares: {}
  };
}

function emptyMealForm(): MealFormState {
  return {
    date: today(),
    mealType: "Breakfast",
    eaters: []
  };
}

function emptyRationForm(defaultPayer = ""): RationFormState {
  return {
    itemName: "",
    quantity: "",
    unit: "kg",
    amount: "",
    paidBy: defaultPayer,
    date: today(),
    notes: ""
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(() => readState());
  const [newUserName, setNewUserName] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingRationId, setEditingRationId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() => emptyExpenseForm());
  const [mealForm, setMealForm] = useState<MealFormState>(emptyMealForm);
  const [rationForm, setRationForm] = useState<RationFormState>(() => emptyRationForm());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => summarizeMonth(state), [state]);
  const userNameMap = useMemo(
    () => Object.fromEntries(state.users.map((user) => [user.id, user.name])),
    [state.users]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.classList.toggle("dark", state.darkMode);
  }, [state]);

  useEffect(() => {
    const defaultPayer = state.users[0]?.id || "";
    setExpenseForm((current) => (current.paidBy ? current : { ...current, paidBy: defaultPayer }));
    setRationForm((current) => (current.paidBy ? current : { ...current, paidBy: defaultPayer }));
  }, [state.users]);

  const filteredExpenses = useMemo(() => {
    const query = expenseSearch.trim().toLowerCase();
    if (!query) return summary.expenses;
    return summary.expenses.filter((entry) => {
      const payer = userNameMap[entry.paidBy]?.toLowerCase() || "";
      return (
        entry.itemName.toLowerCase().includes(query) ||
        payer.includes(query) ||
        entry.splitType.toLowerCase().includes(query)
      );
    });
  }, [expenseSearch, summary.expenses, userNameMap]);

  function resetExpenseForm() {
    setExpenseForm(emptyExpenseForm(state.users[0]?.id || ""));
    setEditingExpenseId(null);
  }

  function resetMealForm() {
    setMealForm(emptyMealForm());
    setEditingMealId(null);
  }

  function resetRationForm() {
    setRationForm(emptyRationForm(state.users[0]?.id || ""));
    setEditingRationId(null);
  }

  function addUser() {
    const name = newUserName.trim();
    if (!name) return;
    setState((current) => ({
      ...current,
      users: [...current.users, { id: uid("user"), name }]
    }));
    setNewUserName("");
  }

  function deleteUser(userId: string) {
    const hasLinkedData =
      state.expenses.some((entry) => entry.paidBy === userId || entry.customShares.some((share) => share.userId === userId)) ||
      state.meals.some((entry) => entry.eaters.includes(userId)) ||
      state.rations.some((entry) => entry.paidBy === userId);

    if (hasLinkedData) {
      window.alert("This roommate already appears in expenses, meals, or ration records. Remove those entries first.");
      return;
    }

    setState((current) => ({
      ...current,
      users: current.users.filter((user) => user.id !== userId)
    }));
  }

  function submitExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.itemName.trim() || !amount || !expenseForm.paidBy) return;

    const customShares = state.users.map((user) => ({
      userId: user.id,
      amount: Number(expenseForm.customShares[user.id] || 0)
    }));

    if (expenseForm.splitType === "custom") {
      const total = customShares.reduce((sum, item) => sum + item.amount, 0);
      if (Math.abs(total - amount) > 0.01) {
        window.alert("Custom split total must exactly match the expense amount.");
        return;
      }
    }

    const record: Expense = {
      id: editingExpenseId || uid("expense"),
      itemName: expenseForm.itemName.trim(),
      amount,
      paidBy: expenseForm.paidBy,
      date: expenseForm.date,
      splitType: expenseForm.splitType,
      customShares
    };

    setState((current) => ({
      ...current,
      expenses: editingExpenseId
        ? current.expenses.map((entry) => (entry.id === editingExpenseId ? record : entry))
        : [record, ...current.expenses]
    }));
    resetExpenseForm();
  }

  function submitMeal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mealForm.eaters.length) return;

    const record: MealLog = {
      id: editingMealId || uid("meal"),
      date: mealForm.date,
      mealType: mealForm.mealType,
      eaters: mealForm.eaters
    };

    setState((current) => ({
      ...current,
      meals: editingMealId
        ? current.meals.map((entry) => (entry.id === editingMealId ? record : entry))
        : [record, ...current.meals]
    }));
    resetMealForm();
  }

  function submitRation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(rationForm.amount);
    if (!rationForm.itemName.trim() || !amount || !rationForm.paidBy) return;

    const record: RationEntry = {
      id: editingRationId || uid("ration"),
      itemName: rationForm.itemName.trim(),
      quantity: rationForm.quantity,
      unit: rationForm.unit.trim(),
      amount,
      paidBy: rationForm.paidBy,
      date: rationForm.date,
      notes: rationForm.notes.trim()
    };

    setState((current) => ({
      ...current,
      rations: editingRationId
        ? current.rations.map((entry) => (entry.id === editingRationId ? record : entry))
        : [record, ...current.rations]
    }));
    resetRationForm();
  }

  function startEditExpense(entry: Expense) {
    const customShares: Record<string, string> = {};
    entry.customShares.forEach((item) => {
      customShares[item.userId] = String(item.amount || "");
    });
    setExpenseForm({
      itemName: entry.itemName,
      amount: String(entry.amount),
      paidBy: entry.paidBy,
      date: entry.date,
      splitType: entry.splitType,
      customShares
    });
    setEditingExpenseId(entry.id);
  }

  function startEditMeal(entry: MealLog) {
    setMealForm({
      date: entry.date,
      mealType: entry.mealType,
      eaters: entry.eaters
    });
    setEditingMealId(entry.id);
  }

  function startEditRation(entry: RationEntry) {
    setRationForm({
      itemName: entry.itemName,
      quantity: entry.quantity,
      unit: entry.unit,
      amount: String(entry.amount),
      paidBy: entry.paidBy,
      date: entry.date,
      notes: entry.notes
    });
    setEditingRationId(entry.id);
  }

  function removeRecord(collection: "expenses" | "meals" | "rations", id: string) {
    setState((current) => ({
      ...current,
      [collection]: current[collection].filter((entry) => entry.id !== id)
    }));
  }

  function exportBackup() {
    downloadFile(
      `messmate-backup-${state.selectedMonth || "all"}.json`,
      JSON.stringify(state, null, 2),
      "application/json"
    );
  }

  function exportReport() {
    const lines = [
      `${state.appName} Monthly Report`,
      `Period: ${formatMonth(state.selectedMonth)}`,
      "",
      `Total Shared Expense: ${money(summary.totalExpenses)}`,
      `Total Meals: ${summary.totalMeals}`,
      "",
      "Balances:",
      ...summary.people.map(
        (person) => `${person.name}: Paid ${money(person.paid)} | Share ${money(person.owes)} | Balance ${money(person.balance)}`
      ),
      "",
      "Settlements:",
      ...(summary.settlements.length
        ? summary.settlements.map((entry) => `${entry.from} pays ${money(entry.amount)} to ${entry.to}`)
        : ["No settlement needed."])
    ];

    downloadFile(`messmate-report-${state.selectedMonth || DEFAULT_MONTH}.txt`, lines.join("\n"), "text/plain");
  }

  function restoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result || "")) as Partial<AppState>;
        setState({
          ...makeDefaultState(),
          ...parsed,
          selectedMonth: parsed.selectedMonth || DEFAULT_MONTH
        });
        window.alert("Backup restored successfully.");
      } catch {
        window.alert("Invalid backup file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-page-light dark:bg-page-dark">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-5">
        <header className="glass-card no-print mb-3 overflow-hidden p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex rounded-none bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                Shared bachelor mess app
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                {state.appName}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                Daily meal tracking, ration records, roommate balances, and a clear monthly settlement report in one practical dashboard.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button
                onClick={() => setState((current) => ({ ...current, darkMode: !current.darkMode }))}
                className="btn-secondary"
              >
                {state.darkMode ? "Light mode" : "Dark mode"}
              </button>
              <button onClick={exportBackup} className="rounded-none bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900">
                Backup JSON
              </button>
              <button onClick={exportReport} className="btn-primary">
                Export Report
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-none border border-brand-200 bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200"
              >
                Restore Backup
              </button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={restoreBackup} />
            </div>
          </div>
        </header>

        <section className="no-print mb-3 grid gap-2.5 lg:grid-cols-4">
          <div className="glass-card p-3.5">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Report Month</p>
            <input
              type="month"
              value={state.selectedMonth}
              onChange={(event) => setState((current) => ({ ...current, selectedMonth: event.target.value }))}
              className="field mt-3"
            />
          </div>
          <SummaryCard label="Total Shared Expense" value={money(summary.totalExpenses)} />
          <SummaryCard label="Total Meals Logged" value={String(summary.totalMeals)} />
          <SummaryCard label="Ration Spend" value={money(summary.totalRationSpend)} />
        </section>

        <section className="mb-3 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-card print-card p-4">
            <SectionTitle title="Dashboard" subtitle={formatMonth(state.selectedMonth)} />
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {summary.people.map((person) => (
                <div key={person.id} className="rounded-none border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">{person.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{person.meals} meals</p>
                    </div>
                    <span
                      className={`rounded-none px-2.5 py-1 text-xs font-semibold ${
                        person.balance >= 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                      }`}
                    >
                      {person.balance >= 0 ? "Plus" : "Minus"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <Row label="Paid" value={money(person.paid)} />
                    <Row label="Share" value={money(person.owes)} />
                    <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Balance</span>
                      <span className={person.balance >= 0 ? "font-bold text-emerald-600 dark:text-emerald-300" : "font-bold text-rose-600 dark:text-rose-300"}>
                        {money(person.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card print-card p-4">
            <div className="mb-5 flex items-start justify-between gap-4">
              <SectionTitle title="Final Settlement" subtitle="Simplified payment breakdown" />
              <button onClick={() => window.print()} className="btn-secondary no-print px-4 py-2">
                Print / Save PDF
              </button>
            </div>
            <div className="space-y-3">
              {summary.settlements.length ? (
                summary.settlements.map((entry, index) => (
                    <div key={`${entry.from}-${entry.to}-${index}`} className="rounded-none border border-brand-100 bg-brand-50 p-2.5 dark:border-brand-500/20 dark:bg-brand-500/10">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {entry.from} pays <span className="text-brand-700 dark:text-brand-300">{money(entry.amount)}</span> to {entry.to}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-none border border-emerald-200 bg-emerald-50 p-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  No one owes anyone for this month.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="no-print mb-3 grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="glass-card p-4">
            <SectionTitle title="Roommates" subtitle="Add 3 to 6 people and manage balances together" />
            <div className="flex gap-3">
              <input
                value={newUserName}
                onChange={(event) => setNewUserName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addUser()}
                placeholder="Enter roommate name"
                className="field"
              />
              <button onClick={addUser} className="btn-primary">
                Add
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {state.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-none border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                  <span className="font-medium text-slate-900 dark:text-white">{user.name}</span>
                  <button onClick={() => deleteUser(user.id)} className="text-sm font-semibold text-rose-600 dark:text-rose-300">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <SectionTitle title="Add Expense" subtitle="Track groceries, milk, vegetables, snacks, and daily spend" />
            <form onSubmit={submitExpense} className="grid gap-4 md:grid-cols-2">
              <input
                value={expenseForm.itemName}
                onChange={(event) => setExpenseForm((current) => ({ ...current, itemName: event.target.value }))}
                placeholder="Item name"
                className="field"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="Amount"
                className="field"
              />
              <select
                value={expenseForm.paidBy}
                onChange={(event) => setExpenseForm((current) => ({ ...current, paidBy: event.target.value }))}
                className="field"
              >
                <option value="">Paid by</option>
                {state.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={expenseForm.date}
                onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
                className="field"
              />
              <select
                value={expenseForm.splitType}
                onChange={(event) => setExpenseForm((current) => ({ ...current, splitType: event.target.value as SplitType }))}
                className="field md:col-span-2"
              >
                {splitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {expenseForm.splitType === "custom" && (
                <div className="rounded-none border border-brand-100 bg-brand-50 p-3 dark:border-brand-500/20 dark:bg-brand-500/10 md:col-span-2">
                  <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Custom split amounts</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {state.users.map((user) => (
                      <label key={user.id} className="block">
                        <span className="mb-2 block text-sm text-slate-600 dark:text-slate-300">{user.name}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={expenseForm.customShares[user.id] || ""}
                          onChange={(event) =>
                            setExpenseForm((current) => ({
                              ...current,
                              customShares: {
                                ...current.customShares,
                                [user.id]: event.target.value
                              }
                            }))
                          }
                          className="field"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button type="submit" className="btn-primary">
                  {editingExpenseId ? "Save Expense" : "Add Expense"}
                </button>
                {editingExpenseId && (
                  <button type="button" onClick={resetExpenseForm} className="btn-secondary">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        <section className="no-print mb-3 grid gap-3 xl:grid-cols-2">
          <div className="glass-card p-4">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionTitle title="Expense History" subtitle="Search, edit, and delete entries" />
              <input
                value={expenseSearch}
                onChange={(event) => setExpenseSearch(event.target.value)}
                placeholder="Search expenses"
                className="field sm:max-w-xs"
              />
            </div>

            <div className="space-y-3">
              {filteredExpenses.length ? (
                filteredExpenses.map((entry) => (
                <RecordCard
                  key={entry.id}
                  title={entry.itemName}
                  subtitle={`${formatDate(entry.date)} • Paid by ${userNameMap[entry.paidBy] || "-"} • ${entry.splitType}`}
                  amount={money(entry.amount)}
                  onEdit={() => startEditExpense(entry)}
                  onDelete={() => removeRecord("expenses", entry.id)}
                  />
                ))
              ) : (
                <EmptyState text="No expenses found for this month or search term." />
              )}
            </div>
          </div>

          <div className="glass-card p-4">
            <SectionTitle title="Meal Tracking" subtitle="Log breakfast, lunch, and dinner attendance" />
            <div className="mb-3">
              <InfoBox>
                Mark who actually ate each meal. Any expense using <span className="font-semibold">By meals</span> is divided from these meal counts, so someone who eats less pays less.
              </InfoBox>
            </div>
            <form onSubmit={submitMeal} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input type="date" value={mealForm.date} onChange={(event) => setMealForm((current) => ({ ...current, date: event.target.value }))} className="field" />
                <select value={mealForm.mealType} onChange={(event) => setMealForm((current) => ({ ...current, mealType: event.target.value as MealType }))} className="field">
                  {MEAL_TYPES.map((mealType) => (
                    <option key={mealType} value={mealType}>
                      {mealType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {state.users.map((user) => (
                  <label key={user.id} className="flex items-center gap-3 rounded-none border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                    <input
                      type="checkbox"
                      checked={mealForm.eaters.includes(user.id)}
                      onChange={(event) =>
                        setMealForm((current) => ({
                          ...current,
                          eaters: event.target.checked
                            ? [...current.eaters, user.id]
                            : current.eaters.filter((id) => id !== user.id)
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{user.name}</span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn-primary">
                  {editingMealId ? "Save Meal Log" : "Add Meal Log"}
                </button>
                {editingMealId && (
                  <button type="button" onClick={resetMealForm} className="btn-secondary">
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {summary.meals.map((entry) => (
                <RecordCard
                  key={entry.id}
                  title={entry.mealType}
                  subtitle={`${formatDate(entry.date)} • Ate: ${entry.eaters.map((id) => userNameMap[id]).filter(Boolean).join(", ")}`}
                  onEdit={() => startEditMeal(entry)}
                  onDelete={() => removeRecord("meals", entry.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="no-print mb-3 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-card p-4">
            <SectionTitle title="Ration Tracking" subtitle="Track stock items and include them in monthly settlement" />
            <form onSubmit={submitRation} className="grid gap-4 md:grid-cols-2">
              <input value={rationForm.itemName} onChange={(event) => setRationForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Ration item" className="field" />
              <input type="number" min="0" step="0.01" value={rationForm.amount} onChange={(event) => setRationForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount" className="field" />
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <input type="number" min="0" step="0.01" value={rationForm.quantity} onChange={(event) => setRationForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantity" className="field" />
                <input value={rationForm.unit} onChange={(event) => setRationForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Unit" className="field" />
              </div>
              <select value={rationForm.paidBy} onChange={(event) => setRationForm((current) => ({ ...current, paidBy: event.target.value }))} className="field">
                <option value="">Paid by</option>
                {state.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <input type="date" value={rationForm.date} onChange={(event) => setRationForm((current) => ({ ...current, date: event.target.value }))} className="field" />
              <textarea value={rationForm.notes} onChange={(event) => setRationForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Notes" className="field md:col-span-2" />
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button type="submit" className="btn-primary">
                  {editingRationId ? "Save Ration" : "Add Ration"}
                </button>
                {editingRationId && (
                  <button type="button" onClick={resetRationForm} className="btn-secondary">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="glass-card p-4">
            <SectionTitle title="Monthly Ration Summary" subtitle={`Usage and spend for ${formatMonth(state.selectedMonth)}`} />
            <div className="space-y-3">
              {summary.rationSummary.length ? (
                summary.rationSummary.map((entry) => (
                  <div key={entry.itemName} className="rounded-none border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{entry.itemName}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Quantity: {entry.quantity || 0} {entry.unit}
                        </p>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">{money(entry.spend)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No ration entries recorded for this month." />
              )}
            </div>

            <div className="mt-6 space-y-3">
              {summary.rations.map((entry) => (
                <RecordCard
                  key={entry.id}
                  title={entry.itemName}
                  subtitle={`${entry.quantity || 0} ${entry.unit} • ${formatDate(entry.date)} • Paid by ${userNameMap[entry.paidBy] || "-"}${entry.notes ? ` • ${entry.notes}` : ""}`}
                  amount={money(entry.amount)}
                  onEdit={() => startEditRation(entry)}
                  onDelete={() => removeRecord("rations", entry.id)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
