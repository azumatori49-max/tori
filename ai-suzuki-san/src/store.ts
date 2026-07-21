import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

export type CaseStatus = "open" | "waiting_review" | "resolved";

export interface DeficiencyCase {
  id: string;
  /** 従業員のLINE UID */
  employeeUserId: string;
  /** 従業員の氏名（鈴木さんの入力そのまま） */
  employeeName: string;
  /** 対象書類・手続き（例: 雇用契約書、給与振込口座届） */
  document: string;
  /** 不備の内容 */
  issue: string;
  /** 期限（自由記述、任意） */
  deadline?: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  /** 従業員への催促を送った回数 */
  reminderCount: number;
  /** 最後に従業員側でやり取りがあった時刻 */
  lastEmployeeActivityAt: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  at: string;
}

interface StoreData {
  cases: DeficiencyCase[];
  /** LINE UIDごとの会話履歴（管理者・従業員共通） */
  conversations: Record<string, ChatTurn[]>;
}

const MAX_HISTORY_TURNS = 30;

export class Store {
  private filePath: string;
  private data: StoreData;

  constructor() {
    mkdirSync(config.dataDir, { recursive: true });
    this.filePath = join(config.dataDir, "store.json");
    if (existsSync(this.filePath)) {
      this.data = JSON.parse(readFileSync(this.filePath, "utf-8")) as StoreData;
    } else {
      this.data = { cases: [], conversations: {} };
    }
  }

  private save(): void {
    const tmp = this.filePath + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.filePath);
  }

  createCase(input: {
    employeeUserId: string;
    employeeName: string;
    document: string;
    issue: string;
    deadline?: string;
  }): DeficiencyCase {
    const now = new Date().toISOString();
    const c: DeficiencyCase = {
      id: randomUUID().slice(0, 8),
      ...input,
      status: "open",
      createdAt: now,
      updatedAt: now,
      reminderCount: 0,
      lastEmployeeActivityAt: now,
    };
    this.data.cases.push(c);
    this.save();
    return c;
  }

  getCase(id: string): DeficiencyCase | undefined {
    return this.data.cases.find((c) => c.id === id);
  }

  /** 従業員UIDに対する未解決ケース（open / waiting_review） */
  activeCaseForEmployee(userId: string): DeficiencyCase | undefined {
    return this.data.cases.find(
      (c) => c.employeeUserId === userId && c.status !== "resolved",
    );
  }

  listActiveCases(): DeficiencyCase[] {
    return this.data.cases.filter((c) => c.status !== "resolved");
  }

  updateCase(id: string, patch: Partial<DeficiencyCase>): DeficiencyCase | undefined {
    const c = this.getCase(id);
    if (!c) return undefined;
    Object.assign(c, patch, { updatedAt: new Date().toISOString() });
    this.save();
    return c;
  }

  touchEmployeeActivity(userId: string): void {
    const c = this.activeCaseForEmployee(userId);
    if (c) {
      c.lastEmployeeActivityAt = new Date().toISOString();
      c.updatedAt = c.lastEmployeeActivityAt;
      this.save();
    }
  }

  appendTurn(userId: string, turn: ChatTurn): void {
    const history = (this.data.conversations[userId] ??= []);
    history.push(turn);
    if (history.length > MAX_HISTORY_TURNS) {
      history.splice(0, history.length - MAX_HISTORY_TURNS);
    }
    this.save();
  }

  getHistory(userId: string): ChatTurn[] {
    return this.data.conversations[userId] ?? [];
  }
}

export const store = new Store();
