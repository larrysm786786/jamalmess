import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, InfoBox, RecordCard, Row, SectionTitle, SummaryCard } from "./components";
import type { AppState, Expense, LoginAccount, MealLog, MealType, RationEntry, SplitType } from "./types";
import {
  DEFAULT_ADMIN,
  DEFAULT_MONTH,
  MEAL_TYPES,
  STORAGE_KEY,
  downloadFile,
  formatDate,
  formatMonth,
  makeDefaultState,
  money,
  readState,
  loadFromSupabase,
  saveToSupabase,
  summarizeMonth,
  today,
  uid
} from "./utils";
import { supabase } from "./supabase";

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

const LOGIN_KEY = "messmate-auth";

type SessionUser = { id: string; username: string; role: "admin" | "user" };

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}

function PasswordInput({ value, onChange, placeholder = "Enter password" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="field pr-8"
        type={show ? "text" : "password"}
        autoComplete="current-password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function SettingsModal({
  isAdmin, currentUser, state, setState, onClose, onLogout
}: {
  isAdmin: boolean;
  currentUser: SessionUser;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onClose: () => void;
  onLogout: () => void;
}) {
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [myNewPass, setMyNewPass] = useState("");
  const [myConfirmPass, setMyConfirmPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [editPassId, setEditPassId] = useState<string | null>(null);
  const [editPassVal, setEditPassVal] = useState("");

  function addAccount() {
    const u = newUsername.trim();
    const p = newPassword.trim();
    if (!u || !p) return;
    if (state.accounts.some((a) => a.username === u)) {
      window.alert("Username already exists.");
      return;
    }
    const account: LoginAccount = { id: uid("acc"), username: u, password: p, role: "user" };
    setState((cur) => ({ ...cur, accounts: [...cur.accounts, account] }));
    setNewUsername("");
    setNewPassword("");
  }

  function deleteAccount(id: string) {
    if (id === "admin-001") { window.alert("Admin account cannot be deleted."); return; }
    setState((cur) => ({ ...cur, accounts: cur.accounts.filter((a) => a.id !== id) }));
  }

  function saveEditPass(id: string) {
    if (!editPassVal.trim()) return;
    setState((cur) => ({ ...cur, accounts: cur.accounts.map((a) => a.id === id ? { ...a, password: editPassVal.trim() } : a) }));
    setEditPassId(null);
    setEditPassVal("");
  }

  function changeMyPassword() {
    if (!myNewPass || myNewPass !== myConfirmPass) {
      setPassMsg("Passwords do not match.");
      return;
    }
    setState((cur) => ({ ...cur, accounts: cur.accounts.map((a) => a.id === currentUser.id ? { ...a, password: myNewPass } : a) }));
    setMyNewPass("");
    setMyConfirmPass("");
    setPassMsg("Password changed successfully.");
    setTimeout(() => setPassMsg(""), 3000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-none bg-white shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sticky top-0" style={{backgroundColor:"#475569"}}>
          <h2 className="text-sm font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-5 p-4">
          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">App Name</label>
              <input className="field" value={state.appName} onChange={(e) => setState((cur) => ({ ...cur, appName: e.target.value }))} placeholder="App name" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dark Mode</span>
            <button
              onClick={() => setState((cur) => ({ ...cur, darkMode: !cur.darkMode }))}
              className={`relative h-6 w-11 rounded-full transition ${state.darkMode ? "bg-brand-600" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${state.darkMode ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">Change My Password</p>
            <div className="space-y-2">
              <PasswordInput value={myNewPass} onChange={setMyNewPass} placeholder="New password" />
              <PasswordInput value={myConfirmPass} onChange={setMyConfirmPass} placeholder="Confirm password" />
              {passMsg && <p className={`text-xs ${passMsg.includes("success") ? "text-emerald-600" : "text-rose-600"}`}>{passMsg}</p>}
              <button onClick={changeMyPassword} className="btn-primary w-full">Update Password</button>
            </div>
          </div>

          {isAdmin && (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-3 text-xs font-bold text-slate-700 dark:text-slate-200">User Accounts</p>
              <div className="mb-3 space-y-2">
                <input className="field" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="Password" />
                <button onClick={addAccount} className="btn-primary w-full">Create User</button>
              </div>
              <div className="space-y-2">
                {state.accounts.map((acc) => (
                  <div key={acc.id} className="rounded-none border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                    {editPassId === acc.id ? (
                      <div className="flex gap-2">
                        <PasswordInput value={editPassVal} onChange={setEditPassVal} placeholder="New password" />
                        <button onClick={() => saveEditPass(acc.id)} className="btn-primary px-2">Save</button>
                        <button onClick={() => setEditPassId(null)} className="btn-secondary px-2">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-white">{acc.username}</p>
                          <p className="text-xs text-slate-500">{acc.role}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditPassId(acc.id); setEditPassVal(""); }} className="text-xs font-semibold text-brand-700 dark:text-brand-300">Change Pass</button>
                          {acc.id !== "admin-001" && (
                            <button onClick={() => deleteAccount(acc.id)} className="text-xs font-semibold text-rose-600">Delete</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ accounts, onLogin }: { accounts: LoginAccount[]; onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = accounts.find((a) => a.username === username && a.password === password);
    if (found) {
      const session: SessionUser = { id: found.id, username: found.username, role: found.role };
      sessionStorage.setItem(LOGIN_KEY, JSON.stringify(session));
      onLogin(session);
    } else {
      setError("Invalid username or password.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-none shadow-2xl overflow-hidden">
        <div className="p-6 text-center" style={{backgroundColor:"#5025d1"}}>
          <h1 className="text-xl font-bold text-white">Jamal MessWala</h1>
          <p className="mt-1 text-xs text-white/70">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-900 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Username</label>
            <input
              className="field"
              type="text"
              autoComplete="username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Password</label>
            <PasswordInput value={password} onChange={(v) => { setPassword(v); setError(""); }} />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2">Login</button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(LOGIN_KEY) || "null"); } catch { return null; }
  });
  const [state, setState] = useState<AppState>(() => readState());
  const [loading, setLoading] = useState(true);
  const isSyncing = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
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
    const timeout = setTimeout(() => setLoading(false), 6000);
    loadFromSupabase()
      .then((loaded) => { setState(loaded); setLoading(false); })
      .catch(() => setLoading(false))
      .finally(() => clearTimeout(timeout));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("mess_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "mess_data" }, (payload) => {
        if (isSyncing.current) return;
        const incoming = (payload.new as { state: AppState }).state;
        if (incoming) setState(incoming);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.classList.toggle("dark", state.darkMode);
    isSyncing.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToSupabase(state).finally(() => {
        setTimeout(() => { isSyncing.current = false; }, 1000);
      });
    }, 700);
  }, [state, loading]);

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

  const isAdmin = currentUser?.role === "admin";

  function logout() {
    sessionStorage.removeItem(LOGIN_KEY);
    setCurrentUser(null);
  }

  if (!currentUser) {
    return <LoginScreen accounts={state.accounts ?? [DEFAULT_ADMIN]} onLogin={(user) => setCurrentUser(user)} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-light dark:bg-page-dark">
        <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">Loading data...</p>
      </div>
    );
  }

  const selectedPerson = selectedPersonId ? state.users.find((u) => u.id === selectedPersonId) : null;
  const personPurchases = selectedPersonId
    ? [
        ...state.expenses
          .filter((e) => e.paidBy === selectedPersonId && (!state.selectedMonth || e.date.startsWith(state.selectedMonth)))
          .map((e) => ({ date: e.date, item: e.itemName, amount: e.amount, type: "Expense" })),
        ...state.rations
          .filter((r) => r.paidBy === selectedPersonId && (!state.selectedMonth || r.date.startsWith(state.selectedMonth)))
          .map((r) => ({ date: r.date, item: `${r.itemName} (${r.quantity} ${r.unit})`, amount: r.amount, type: "Ration" }))
      ].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">

      {showSettings && (
        <SettingsModal
          isAdmin={isAdmin}
          currentUser={currentUser}
          state={state}
          setState={setState}
          onClose={() => setShowSettings(false)}
          onLogout={logout}
        />
      )}

      {selectedMealType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedMealType(null)}
        >
          <div
            className="w-full max-w-md rounded-none bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4" style={{backgroundColor:"#5025d1"}}>
              <div>
                <h2 className="text-base font-bold text-white">
                  {{ Breakfast: "🌅", Lunch: "☀️", Dinner: "🌙" }[selectedMealType]} {selectedMealType} — Breakdown
                </h2>
                <p className="text-xs text-white/70">{formatMonth(state.selectedMonth)}</p>
              </div>
              <button onClick={() => setSelectedMealType(null)} className="text-xl font-bold text-white/80 hover:text-white">✕</button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="mb-3 space-y-2">
                {state.users.map((user) => {
                  const userLogs = summary.meals.filter(
                    (m) => m.mealType === selectedMealType && m.eaters.includes(user.id)
                  );
                  return (
                    <div key={user.id} className="flex items-center justify-between rounded-none border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{backgroundColor:"#5025d1"}}>
                        {userLogs.length} times
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Date-wise log</p>
                <div className="space-y-1.5">
                  {summary.meals
                    .filter((m) => m.mealType === selectedMealType)
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-none border border-slate-100 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-xs text-slate-500">{formatDate(m.date)}</p>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {m.eaters.map((id) => userNameMap[id]).filter(Boolean).join(", ")}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPerson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedPersonId(null)}
        >
          <div
            className="w-full max-w-md rounded-none bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4" style={{backgroundColor:"#5025d1"}}>
              <div>
                <h2 className="text-base font-bold text-white">{selectedPerson.name} — Purchase History</h2>
                <p className="text-xs text-white/70">{formatMonth(state.selectedMonth)}</p>
              </div>
              <button onClick={() => setSelectedPersonId(null)} className="text-white/80 hover:text-white text-xl font-bold">✕</button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {personPurchases.length ? (
                <div className="space-y-2">
                  {personPurchases.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between rounded-none border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.item}</p>
                        <p className="text-xs text-slate-500">{formatDate(entry.date)} • {entry.type}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{money(entry.amount)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total Paid</span>
                    <span className="text-sm font-bold" style={{color:"#5025d1"}}>{money(personPurchases.reduce((s, e) => s + e.amount, 0))}</span>
                  </div>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">No purchases this month.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-5">
        <header className="glass-card no-print mb-2 overflow-hidden p-3 panel-dark" style={{backgroundColor:"#5025d1"}}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {state.appName}
              </h1>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600 dark:text-slate-300">
                Daily meal tracking, ration records, roommate balances, and a clear monthly settlement report.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setState((current) => ({ ...current, darkMode: !current.darkMode }))}
                className="btn-secondary p-2"
                title={state.darkMode ? "Light mode" : "Dark mode"}
              >
                {state.darkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
              </button>
              {isAdmin && (
                <>
                  <button onClick={exportBackup} className="rounded-none bg-slate-900 p-2 text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900" title="Backup JSON">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button onClick={exportReport} className="rounded-none bg-brand-600 p-2 text-white transition hover:bg-brand-700" title="Export Report">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="rounded-none p-2 text-white transition" style={{backgroundColor:"#f59e0b"}} title="Restore Backup">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </button>
                </>
              )}
              <button onClick={() => setShowSettings(true)} className="rounded-none bg-slate-600 p-2 text-white transition hover:bg-slate-700" title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
              <button onClick={logout} className="rounded-none bg-rose-600 p-2 text-white transition hover:bg-rose-700" title="Logout">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={restoreBackup} />
            </div>
          </div>
        </header>

        <section className="no-print mb-3 grid gap-2.5 lg:grid-cols-4">
          <div className="glass-card p-2.5" style={{backgroundColor:"#3b82f6"}}>
            <p className="text-sm font-medium" style={{color:"#ffffff"}}>Report Month</p>
            <input
              type="month"
              value={state.selectedMonth}
              onChange={(event) => setState((current) => ({ ...current, selectedMonth: event.target.value }))}
              className="field mt-3"
              style={{backgroundColor:"rgba(255,255,255,0.2)", borderColor:"rgba(255,255,255,0.4)", color:"#ffffff"}}
            />
          </div>
          <SummaryCard label="Total Shared Expense" value={money(summary.totalExpenses)} bg="#10b981" />
          <SummaryCard label="Total Meals Logged" value={String(summary.totalMeals)} bg="#f59e0b" />
          <SummaryCard label="Ration Spend" value={money(summary.totalRationSpend)} bg="#ef4444" />
        </section>

        <section className="no-print mb-3 grid gap-3 xl:grid-cols-2">
          <div className="glass-card p-3" style={{backgroundColor:"#ffffff"}}>
            <SectionTitle title="Roommates" subtitle="Add 3 to 6 people and manage balances together" />
            {isAdmin && (
              <div className="flex gap-3">
                <input
                  value={newUserName}
                  onChange={(event) => setNewUserName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addUser()}
                  placeholder="Enter roommate name"
                  className="field"
                />
                <button onClick={addUser} className="btn-primary">Add</button>
              </div>
            )}
            <div className="mt-3 space-y-3">
              {state.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-none border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                  <span className="font-medium text-slate-900 dark:text-white">{user.name}</span>
                  {isAdmin && (
                    <button onClick={() => deleteUser(user.id)} className="text-sm font-semibold text-rose-600 dark:text-rose-300">Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card print-card p-4" style={{backgroundColor:"#ffffff"}}>
            <SectionTitle title="Dashboard" subtitle={formatMonth(state.selectedMonth)} />
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {summary.people.map((person) => (
                <div
                  key={person.id}
                  onClick={() => setSelectedPersonId(person.id)}
                  className="cursor-pointer rounded-none border border-slate-200/80 bg-slate-50 p-3 transition hover:border-[#5025d1] hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">{person.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{person.meals} meals • tap for history</p>
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

        </section>

        <section className="no-print mb-3 grid gap-3 xl:grid-cols-2">
          <div className="glass-card p-3" style={{backgroundColor:"#ffffff"}}>
            <SectionTitle title="Add Expense" subtitle="Track groceries, milk, vegetables, snacks, and daily spend" />
            <form onSubmit={submitExpense} className="grid gap-2.5 md:grid-cols-2">
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
                onChange={(event) => {
                  if (!isAdmin && event.target.value !== today()) return;
                  setExpenseForm((current) => ({ ...current, date: event.target.value }));
                }}
                max={isAdmin ? undefined : today()}
                min={isAdmin ? undefined : today()}
                className="field"
                readOnly={!isAdmin}
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

          <div className="glass-card print-card p-4" style={{backgroundColor:"#ffffff"}}>
            <div className="mb-3 flex items-start justify-between gap-4">
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

        <section className="no-print mb-3 grid gap-3 xl:grid-cols-2">
          <div className="glass-card p-3" style={{backgroundColor:"#ffffff"}}>
            <SectionTitle title="Meal Tracking" subtitle="Log breakfast, lunch, and dinner attendance" />

            <div className="mb-3 grid grid-cols-3 gap-2">
              {MEAL_TYPES.map((mealType) => {
                const logs = summary.meals.filter((m) => m.mealType === mealType);
                const totalCount = logs.length;
                const icons: Record<string, string> = { Breakfast: "🌅", Lunch: "☀️", Dinner: "🌙" };
                return (
                  <button
                    key={mealType}
                    onClick={() => setSelectedMealType(mealType)}
                    className="rounded-none border border-slate-200 bg-slate-50 p-2 text-center transition hover:border-[#5025d1] hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p className="text-lg">{icons[mealType]}</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{mealType}</p>
                    <p className="text-xs text-slate-500">{totalCount} logs</p>
                  </button>
                );
              })}
            </div>

            <div className="mb-3">
              <InfoBox>
                Mark who actually ate each meal. Any expense using <span className="font-semibold">By meals</span> is divided from these meal counts, so someone who eats less pays less.
              </InfoBox>
            </div>
            {isAdmin && (
              <form onSubmit={submitMeal} className="grid gap-4">
                <div className="grid gap-2.5 md:grid-cols-2">
                  <input type="date" value={mealForm.date} onChange={(event) => setMealForm((current) => ({ ...current, date: event.target.value }))} className="field" />
                  <select value={mealForm.mealType} onChange={(event) => setMealForm((current) => ({ ...current, mealType: event.target.value as MealType }))} className="field">
                    {MEAL_TYPES.map((mealType) => (
                      <option key={mealType} value={mealType}>{mealType}</option>
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
                    <button type="button" onClick={resetMealForm} className="btn-secondary">Cancel</button>
                  )}
                </div>
              </form>
            )}

            <div className="mt-5 space-y-3">
              {summary.meals.map((entry) => (
                <RecordCard
                  key={entry.id}
                  title={entry.mealType}
                  subtitle={`${formatDate(entry.date)} • Ate: ${entry.eaters.map((id) => userNameMap[id]).filter(Boolean).join(", ")}`}
                  onEdit={isAdmin ? () => startEditMeal(entry) : () => {}}
                  onDelete={isAdmin ? () => removeRecord("meals", entry.id) : () => {}}
                  locked={!isAdmin}
                />
              ))}
            </div>
          </div>

          <div className="glass-card p-3" style={{backgroundColor:"#ffffff"}}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionTitle title="Expense History" subtitle="Search, edit, and delete entries" />
              <input
                value={expenseSearch}
                onChange={(event) => setExpenseSearch(event.target.value)}
                placeholder="Search expenses"
                className="field sm:max-w-xs"
              />
            </div>

            <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
              {filteredExpenses.length ? (
                filteredExpenses.map((entry) => {
                  const canEdit = isAdmin || entry.date === today();
                  return (
                    <RecordCard
                      key={entry.id}
                      title={entry.itemName}
                      subtitle={`${formatDate(entry.date)} • Paid by ${userNameMap[entry.paidBy] || "-"} • ${entry.splitType}${!canEdit ? " 🔒" : ""}`}
                      amount={money(entry.amount)}
                      onEdit={canEdit ? () => startEditExpense(entry) : () => {}}
                      onDelete={canEdit ? () => removeRecord("expenses", entry.id) : () => {}}
                      locked={!canEdit}
                    />
                  );
                })
              ) : (
                <EmptyState text="No expenses found for this month or search term." />
              )}
            </div>
          </div>

        </section>

        <section className="no-print mb-3 grid gap-3 xl:grid-cols-2">
          <div className="glass-card p-3" style={{backgroundColor:"#ffffff"}}>
            <SectionTitle title="Ration Tracking" subtitle="Track stock items and include them in monthly settlement" />
            {isAdmin && (
              <form onSubmit={submitRation} className="grid gap-2.5 md:grid-cols-2">
                <input value={rationForm.itemName} onChange={(event) => setRationForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Ration item" className="field" />
                <input type="number" min="0" step="0.01" value={rationForm.amount} onChange={(event) => setRationForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount" className="field" />
                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <input type="number" min="0" step="0.01" value={rationForm.quantity} onChange={(event) => setRationForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantity" className="field" />
                  <input value={rationForm.unit} onChange={(event) => setRationForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Unit" className="field" />
                </div>
                <select value={rationForm.paidBy} onChange={(event) => setRationForm((current) => ({ ...current, paidBy: event.target.value }))} className="field">
                  <option value="">Paid by</option>
                  {state.users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
                <input type="date" value={rationForm.date} onChange={(event) => setRationForm((current) => ({ ...current, date: event.target.value }))} className="field" />
                <textarea value={rationForm.notes} onChange={(event) => setRationForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Notes" className="field md:col-span-2" />
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <button type="submit" className="btn-primary">{editingRationId ? "Save Ration" : "Add Ration"}</button>
                  {editingRationId && (
                    <button type="button" onClick={resetRationForm} className="btn-secondary">Cancel</button>
                  )}
                </div>
              </form>
            )}
            {!isAdmin && <EmptyState text="Ration entries are view-only. Contact admin to make changes." />}
          </div>

          <div className="glass-card p-3" style={{backgroundColor:"#ffffff"}}>
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
                  onEdit={isAdmin ? () => startEditRation(entry) : () => {}}
                  onDelete={isAdmin ? () => removeRecord("rations", entry.id) : () => {}}
                  locked={!isAdmin}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

