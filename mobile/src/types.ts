export type Severity = 'critical' | 'warning' | 'info' | 'success';

export type DashboardAlert = {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  generatedAt: string;
};

export type DashboardTask = {
  id: string;
  title: string;
  priority: string;
  dueAt: string | null;
};

export type RecentSale = {
  id: string;
  total: number;
  soldAt: string;
};

export type DailyPoint = {
  date: string;
  label: string;
  revenue: number;
  expenses: number;
};

export type DashboardSnapshot = {
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  workspace: {
    id: string;
    name: string;
    type: string;
    status: string;
    currency: 'YER' | 'SAR' | 'USD';
    role: string;
  };
  subscriptionStatus: 'active' | 'past_due' | 'expired' | 'cancelled' | 'missing';
  status: 'ok' | 'attention';
  summary: {
    products: number;
    customers: number;
    revenue30d: number;
    expenses30d: number;
    profit30d: number;
    todayRevenue: number;
    openTasks: number;
    lowStock: number;
  };
  alerts: DashboardAlert[];
  tasks: DashboardTask[];
  recentSales: RecentSale[];
  dailySeries: DailyPoint[];
  fetchedAt: string;
};

export type OrbyMode = 'GENERAL' | 'SALES' | 'INVENTORY' | 'CUSTOMERS' | 'PLANNING';

export type OrbyReply = {
  text: string;
  source: 'ai' | 'smart-fallback';
  conversationId: string;
  remaining: number;
};

export type OrbyMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'ai' | 'smart-fallback';
};
