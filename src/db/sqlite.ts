import initSqlJs from "sql.js/dist/sql-wasm.js";
import type { Database, SqlJsStatic } from "sql.js";
import sqlWasm from "sql.js/dist/sql-wasm.wasm?url";

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

export interface Message {
  id: string;
  authorId: string;
  text: string;
  timestamp: string;
}

export interface PollConfig {
  visibility: {
    // 'all' => everyone sees results; 'voters' => only after voting; 'creatorOnly' => only creator
    resultsVisibleTo: "all" | "voters" | "creatorOnly";
  };
  eligibility: {
    // If empty or missing => all personas can vote
    allowedPersonaIds?: string[];
  };
  voting: {
    multiple: boolean; // allow multiple options
    allowChangeVote: boolean; // allow changing selection(s)
  };
}

export interface Poll {
  id: string;
  creatorId: string;
  question: string;
  options: string[];
  config: PollConfig;
  timestamp: string;
}

export interface Vote {
  pollId: string;
  voterId: string;
  optionIndex: number;
  timestamp: string;
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
      FOREIGN KEY(authorId) REFERENCES personas(id)
    );

    CREATE TABLE IF NOT EXISTS polls(
      id TEXT PRIMARY KEY,
      creatorId TEXT NOT NULL,
      question TEXT NOT NULL,
      optionsJson TEXT NOT NULL,
      configJson TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(creatorId) REFERENCES personas(id)
    );

    CREATE TABLE IF NOT EXISTS votes(
      pollId TEXT NOT NULL,
      voterId TEXT NOT NULL,
      optionIndex INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      PRIMARY KEY (pollId, voterId, optionIndex),
      FOREIGN KEY(pollId) REFERENCES polls(id),
      FOREIGN KEY(voterId) REFERENCES personas(id)
    );
  `);

  // seed
  const res = db.exec("SELECT COUNT(*) FROM personas;");
  const count = (res[0]?.values?.[0]?.[0] as number) ?? 0;

  if (!count) {
    db.exec(`
      INSERT INTO personas (id,name,color,bio) VALUES
        ('designer','Riley (Designer)','#e86a92','Visual storyteller who cares about delightful interactions.'),
        ('engineer','Noah (Engineer)','#0075ff','Systems thinker focused on stability and automation.'),
        ('pm','Sasha (Product)','#00a676','Product strategist keeping the team aligned with users.');

      INSERT INTO messages (id,authorId,text,timestamp) VALUES
        ('m1','designer','Let''s make the chat feel playful without sacrificing readability.','2024-05-27T09:00:00Z'),
        ('m2','engineer','I''ll structure the data as JSON so we can remix the personas later.','2024-05-27T09:01:40Z'),
        ('m3','pm','Remember: end users should feel confident experimenting with the UI.','2024-05-27T09:03:15Z');
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

export async function getMessages(
  authorId: string = "all"
): Promise<Message[]> {
  const db = await getDB();
  const sql =
    authorId === "all"
      ? `SELECT id,authorId,text,timestamp FROM messages ORDER BY datetime(timestamp) ASC;`
      : `SELECT id,authorId,text,timestamp FROM messages WHERE authorId = ? ORDER BY datetime(timestamp) ASC;`;

  const stmt = db.prepare(sql);
  if (authorId !== "all") stmt.bind([authorId]);

  const rows: Message[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    rows.push({
      id: row.id,
      authorId: row.authorId,
      text: row.text,
      timestamp: row.timestamp,
    });
  }
  stmt.free();
  return rows;
}

export async function addMessage(msg: Message) {
  const db = await getDB();
  const stmt = db.prepare(
    `INSERT INTO messages (id,authorId,text,timestamp) VALUES (?,?,?,?)`
  );
  stmt.run([msg.id, msg.authorId, msg.text, msg.timestamp]);
  stmt.free();
  persist();
}

export async function createPoll(poll: Poll) {
  const db = await getDB();
  const stmt = db.prepare(
    `INSERT INTO polls (id,creatorId,question,optionsJson,configJson,timestamp) VALUES (?,?,?,?,?,?)`
  );
  stmt.run([
    poll.id,
    poll.creatorId,
    poll.question,
    JSON.stringify(poll.options),
    JSON.stringify(poll.config),
    poll.timestamp,
  ]);
  stmt.free();
  persist();
}

export async function getPollById(id: string): Promise<Poll | null> {
  const db = await getDB();
  const stmt = db.prepare(
    `SELECT id,creatorId,question,optionsJson,configJson,timestamp FROM polls WHERE id = ?`
  );
  stmt.bind([id]);
  let out: Poll | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    out = {
      id: row.id,
      creatorId: row.creatorId,
      question: row.question,
      options: JSON.parse(row.optionsJson || "[]"),
      config: JSON.parse(row.configJson || "{}"),
      timestamp: row.timestamp,
    } as Poll;
  }
  stmt.free();
  return out;
}

export async function getVotesByPollId(pollId: string): Promise<Vote[]> {
  const db = await getDB();
  const stmt = db.prepare(
    `SELECT pollId,voterId,optionIndex,timestamp FROM votes WHERE pollId = ?`
  );
  stmt.bind([pollId]);
  const rows: Vote[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject() as any;
    rows.push({
      pollId: r.pollId,
      voterId: r.voterId,
      optionIndex: r.optionIndex,
      timestamp: r.timestamp,
    });
  }
  stmt.free();
  return rows;
}

export async function upsertVote(
  poll: Poll,
  voterId: string,
  optionIndex: number
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  // For single-choice polls, ensure only one vote per voter
  if (!poll.config.voting.multiple) {
    // Delete any existing votes for this voter on this poll
    const del = db.prepare(`DELETE FROM votes WHERE pollId = ? AND voterId = ?`);
    del.run([poll.id, voterId]);
    del.free();
  }

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO votes (pollId,voterId,optionIndex,timestamp) VALUES (?,?,?,?)`
  );
  stmt.run([poll.id, voterId, optionIndex, now]);
  stmt.free();
  persist();
}

export async function deleteVote(
  pollId: string,
  voterId: string,
  optionIndex: number
): Promise<void> {
  const db = await getDB();
  const del = db.prepare(
    `DELETE FROM votes WHERE pollId = ? AND voterId = ? AND optionIndex = ?`
  );
  del.run([pollId, voterId, optionIndex]);
  del.free();
  persist();
}
