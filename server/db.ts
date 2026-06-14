import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

// 确保 data 目录存在
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);
// 启用 WAL 模式以提高性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
db.exec(`
  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    sdk_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    philosopher_id TEXT,
    mentions TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- 为会话 ID 创建索引
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_philosopher_id ON messages(philosopher_id);
`);

// 数据库迁移
function runMigrations() {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all();
  const msgTableInfo = db.prepare("PRAGMA table_info(messages)").all();

  // 迁移1: 添加 sdk_session_id 列（sessions表）
  if (!tableInfo.some((col: any) => col.name === 'sdk_session_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
    console.log("[DB] Added sdk_session_id column to sessions table");
  }

  // 迁移2: 添加 philosopher_id 列（messages表）
  if (!msgTableInfo.some((col: any) => col.name === 'philosopher_id')) {
    db.exec("ALTER TABLE messages ADD COLUMN philosopher_id TEXT");
    console.log("[DB] Added philosopher_id column to messages table");
  }

  // 迁移3: 添加 mentions 列（messages表）
  if (!msgTableInfo.some((col: any) => col.name === 'mentions')) {
    db.exec("ALTER TABLE messages ADD COLUMN mentions TEXT");
    console.log("[DB] Added mentions column to messages table");
  }
}
runMigrations();

// ============= 会话操作 =============

export function getAllSessions() {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
  return stmt.all();
}

export function getSession(id: string) {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id);
}

export function createSession(session: any) {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(session.id, session.title, session.model, session.sdk_session_id || null, session.created_at, session.updated_at);
  return session;
}

export function updateSession(id: string, updates: any) {
  const fields = [];
  const values = [];
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.model !== undefined) {
    fields.push('model = ?');
    values.push(updates.model);
  }
  if (updates.sdk_session_id !== undefined) {
    fields.push('sdk_session_id = ?');
    values.push(updates.sdk_session_id);
  }
  if (fields.length === 0) return false;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteSession(id: string) {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= 消息操作 =============

export function getMessage(id: string) {
  const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
  return stmt.get(id);
}

export function getMessagesBySession(sessionId: string) {
  const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  return stmt.all(sessionId);
}

/**
 * 获取指定哲学家在会话中的消息（用于构建对话历史）
 */
export function getPhilosopherMessages(sessionId: string, philosopherId: string) {
  const stmt = db.prepare(`
    SELECT * FROM messages
    WHERE session_id = ? AND (role = 'user' OR (role = 'assistant' AND philosopher_id = ?))
    ORDER BY created_at ASC
  `);
  return stmt.all(sessionId, philosopherId);
}

export function createMessage(message: any) {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls, philosopher_id, mentions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    message.id,
    message.session_id,
    message.role,
    message.content,
    message.model || null,
    message.created_at,
    message.tool_calls || null,
    message.philosopher_id || null,
    message.mentions || null,
  );
  // 更新会话的 updated_at
  const updateStmt = db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?');
  updateStmt.run(new Date().toISOString(), message.session_id);
  return message;
}

export function updateMessage(id: string, updates: any) {
  const fields = [];
  const values = [];
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.tool_calls !== undefined) {
    fields.push('tool_calls = ?');
    values.push(updates.tool_calls);
  }
  if (updates.philosopher_id !== undefined) {
    fields.push('philosopher_id = ?');
    values.push(updates.philosopher_id);
  }
  if (fields.length === 0) return false;
  values.push(id);
  const stmt = db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteMessage(id: string) {
  const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function createMessages(messages: any[]) {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls, philosopher_id, mentions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((msgs: any[]) => {
    for (const msg of msgs) {
      stmt.run(
        msg.id, msg.session_id, msg.role, msg.content, msg.model,
        msg.created_at, msg.tool_calls || null, msg.philosopher_id || null, msg.mentions || null
      );
    }
  });
  insertMany(messages);
}

export function clearAllData() {
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
}

export default db;
