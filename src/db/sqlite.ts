import initSqlJs from "sql.js/dist/sql-wasm.js";
import type { Database, SqlJsStatic } from "sql.js";
import sqlWasm from "sql.js/dist/sql-wasm.wasm?url";
import type { ObjectInstance } from "../generics/objects";

const KEY = "chat_personas_db_v1";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

function toBase64(u8: Uint8Array) {
  return btoa(String.fromCharCode(...u8));
}
function fromBase64(b64: string) {
  return new Uint8Array(
    atob(b64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
}

export interface Persona {
  id: string;
  name: string;
  color: string;
  bio: string;
}

// Base message type. Widgets can register additional types dynamically, so keep this open.
export type MessageType = "message" | string;

export type MessageCustom = ObjectInstance | null;

export interface Message {
  id: string;
  authorId: string;
  text: string;
  timestamp: string;
  type: MessageType;
  custom: MessageCustom;
}

export async function getDB(): Promise<Database> {
  if (db) return db;

  SQL = await initSqlJs({ locateFile: () => sqlWasm });

  const saved = localStorage.getItem(KEY);
  db = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();

  db.exec(`
    CREATE TABLE IF NOT EXISTS personas(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      bio TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages(
      id TEXT PRIMARY KEY,
      authorId TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      custom TEXT,
      FOREIGN KEY(authorId) REFERENCES personas(id)
    );
  `);

  const res = db.exec("SELECT COUNT(*) FROM personas;");
  const count = (res[0]?.values?.[0]?.[0] as number) ?? 0;

  if (!count) {
    db.exec(`
      INSERT INTO personas (id,name,color,bio) VALUES
        ('designer','Oskar','#e86a92','Visual storyteller who cares about delightful interactions.'),
        ('engineer','Sebastian','#0075ff','Systems thinker focused on stability and automation.'),
        ('pm','Tom','#00a676','Product strategist keeping the team aligned with users.');

      INSERT INTO messages (id,authorId,text,timestamp,type,custom) VALUES
        ('m1','designer','Hello world','2025-01-01T10:00:00.000Z','message',NULL);
    `);
    persist();
  }

  return db;
}

export function persist() {
  if (!db) return;
  const data = db.export();
  localStorage.setItem(KEY, toBase64(data));
}

export async function getPersonas(): Promise<Persona[]> {
  const db = await getDB();
  const res = db.exec(
    `SELECT id,name,color,bio FROM personas ORDER BY name ASC;`
  );
  const values = (res[0]?.values ?? []) as [string, string, string, string][];
  return values.map(([id, name, color, bio]) => ({
    id: id as string,
    name: name as string,
    color: color as string,
    bio: bio as string,
  }));
}

function parseCustom(raw: string): MessageCustom {
  try {
    const parsed = JSON.parse(raw) as MessageCustom;
    return parsed ?? null;
  } catch (err) {
    console.warn("Failed to parse custom message payload", err);
    return null;
  }
}

export async function getMessages(authorId: string = "all"): Promise<Message[]> {
  const db = await getDB();
  const sql =
    authorId === "all"
      ? `SELECT id,authorId,text,timestamp,type,custom FROM messages ORDER BY datetime(timestamp) ASC;`
      : `SELECT id,authorId,text,timestamp,type,custom FROM messages WHERE authorId = ? ORDER BY datetime(timestamp) ASC;`;

  const stmt = db.prepare(sql);
  if (authorId !== "all") stmt.bind([authorId]);

  const rows: Message[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    rows.push({
      id: row.id as string,
      authorId: row.authorId as string,
      text: row.text as string,
      timestamp: row.timestamp as string,
      type: (row.type as MessageType) ?? "message",
      custom: parseCustom(row.custom as string),
    });
  }
  stmt.free();
  return rows;
}

export async function addMessage(msg: Message) {
  const db = await getDB();
  const stmt = db.prepare(
    `INSERT INTO messages (id,authorId,text,timestamp,type,custom) VALUES (?,?,?,?,?,?)`
  );

  stmt.run([
    msg.id,
    msg.authorId,
    msg.text,
    msg.timestamp,
    msg.type,
    JSON.stringify(msg.custom ?? []),
  ]);

  stmt.free();
  persist();
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDB();
  const stmt = db.prepare(`DELETE FROM messages WHERE id = ?`);
  stmt.run([id]);
  stmt.free();
  persist();
}

export async function clearMessages(): Promise<void> {
  const db = await getDB();
  db.exec(`DELETE FROM messages;`);
  persist();
}
