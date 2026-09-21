export type Role = "ADMIN" | "PM" | "DEVELOPER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  contactInfo: string | null;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  createdById: string;
  createdAt: string;
  client?: Client;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assignedToId: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  isOverdue: boolean;
  createdAt?: string;
  updatedAt?: string;
  assignedTo?: { id: string; name: string; email: string };
}

export interface ActivityItem {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  userName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  createdAt: string;
  message: string;
}

export interface Notification {
  id: string;
  userId: string;
  taskId: string | null;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminDashboard {
  role: "ADMIN";
  totalProjects: number;
  tasksByStatus: Record<string, number>;
  overdueCount: number;
  onlineUserCount: number;
}

export interface PMDashboard {
  role: "PM";
  projectsSummary: { id: string; name: string; taskCount: number }[];
  tasksByPriority: Record<string, number>;
  dueThisWeek: { id: string; title: string; dueDate: string; priority: Priority }[];
}

export interface DeveloperDashboard {
  role: "DEVELOPER";
  tasks: Task[];
}

export type Dashboard = AdminDashboard | PMDashboard | DeveloperDashboard;
