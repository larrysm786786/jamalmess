export type SplitType = "meal" | "equal" | "custom";
export type MealType = "Breakfast" | "Lunch" | "Dinner";

export interface Roommate {
  id: string;
  name: string;
}

export interface CustomShare {
  userId: string;
  amount: number;
}

export interface Expense {
  id: string;
  itemName: string;
  amount: number;
  paidBy: string;
  date: string;
  splitType: SplitType;
  customShares: CustomShare[];
}

export interface MealLog {
  id: string;
  date: string;
  mealType: MealType;
  eaters: string[];
}

export interface RationEntry {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  amount: number;
  paidBy: string;
  date: string;
  notes: string;
}

export interface AppState {
  appName: string;
  darkMode: boolean;
  selectedMonth: string;
  users: Roommate[];
  expenses: Expense[];
  meals: MealLog[];
  rations: RationEntry[];
}
