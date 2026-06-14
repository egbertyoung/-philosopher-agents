import express from "express";
import { config as dotenvConfig } from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db.ts";
import {
  PHILOSOPHERS,
  MODERATOR_SYSTEM_PROMPT,
  type PhilosopherConfig
} from "./philosophers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件（使用文件系统路径，避免 URL 编码问题）
dotenvConfig({ path: path.join(__dirname, "..", ".env") });

const app = express();

// ==================== CORS 中间件 ====================
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;

// ==================== 火山引擎 Ark API 配置 ====================

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/coding/v3";
const ARK_MODEL = process.env.ARK_MODEL || "DeepSeek-V4-Pro";

// ==================== Ark API 调用函数 ====================

interface ApiMessage {
  role: string;
  content: string;
}

interface StreamCallback {
  (text: string): void;
}

/**
 * 调用火山引擎 Ark API（SSE 流式）
 */
async function callArkAPI(
  messages: ApiMessage[],
  systemPrompt: string,
  onChunk: StreamCallback
): Promise<string> {

  const payload = {
    model: ARK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 8000,
  };

  const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ark API 错误 ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("无响应流");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === "[DONE]") break;

      try {
        const json = JSON.parse(dataStr);
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return fullContent;
}

// ==================== 哲学家历史构建 ====================

/**
 * 构建完整对话历史（包含所有哲学家回复，用于跨哲学家上下文）
 */
function buildFullHistory(sessionId: string): Array<{ role: string; content: string }> {
  const msgs = db.getMessagesBySession(sessionId);
  const history: Array<{ role: string; content: string }> = [];

  for (const msg of msgs) {
    if (msg.role === "user") {
      let displayContent = msg.content;
      if (msg.mentions) {
        try {
          const ments = JSON.parse(msg.mentions);
          if (ments && ments.length > 0) {
            const names = ments.map((mid: string) => PHILOSOPHERS[mid]?.name || mid).join("、");
            displayContent = `[用户向 ${names} 提问] ${displayContent}`;
          }
        } catch {}
      }
      history.push({ role: "user", content: displayContent });
    } else if (msg.role === "assistant" && msg.philosopher_id) {
      const p = PHILOSOPHERS[msg.philosopher_id];
      const name = p ? `${p.emoji} ${p.name}` : msg.philosopher_id;
      history.push({ role: "assistant", content: `${name}：${msg.content}` });
    }
  }

  return history;
}

// ==================== 路由 ====================

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", model: ARK_MODEL });
});

// 获取哲学家列表
app.get("/api/philosophers", (req, res) => {
  const philosophers = Object.values(PHILOSOPHERS).map(p => ({
    id: p.id,
    name: p.name,
    nameEn: p.nameEn,
    era: p.era,
    origin: p.origin,
    emoji: p.emoji,
    color: p.color,
    description: p.description,
    keyPhilosophies: p.keyPhilosophies,
  }));
  res.json({ philosophers });
});

// 登录/配置检查
app.get("/api/check-login", async (req, res) => {
  const configured = !!ARK_API_KEY;
  res.json({
    isLoggedIn: configured,
    method: configured ? "env" : "none",
    envConfigured: configured,
    cliConfigured: false,
    apiKey: configured ? ARK_API_KEY.slice(0, 8) + "****" + ARK_API_KEY.slice(-4) : undefined,
    error: configured ? undefined : "未配置 ARK_API_KEY，请在 .env 中填写火山引擎 Ark API Key",
  });
});

// 保存环境变量配置
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, baseUrl, model } = req.body;
  if (apiKey) process.env.ARK_API_KEY = apiKey;
  if (baseUrl) process.env.ARK_BASE_URL = baseUrl;
  if (model) process.env.ARK_MODEL = model;
  res.json({ success: true, message: "已更新配置（重启服务器后失效，请同步修改 .env 文件）" });
});

// 模型列表
app.get("/api/models", async (req, res) => {
  res.json({
    models: [
      { modelId: ARK_MODEL, name: ARK_MODEL },
      { modelId: "DeepSeek-V4-Pro", name: "DeepSeek V4 Pro" },
      { modelId: "DeepSeek-V3", name: "DeepSeek V3" },
    ],
    defaultModel: ARK_MODEL,
  });
});

// 会话列表
app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map((session: any) => {
      const messages = db.getMessagesBySession(session.id);
      return { ...session, messageCount: messages.length };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "会话不存在" });
    const messages = db.getMessagesBySession(sessionId);
    const parsedMessages = messages.map((msg: any) => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null,
    }));
    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = ARK_MODEL, title = "哲学讨论" } = req.body;
    const now = new Date().toISOString();
    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      created_at: now,
      updated_at: now,
    });
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;
    const success = db.updateSession(sessionId, { title, model });
    if (!success) return res.status(404).json({ error: "会话不存在" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);
    if (!success) return res.status(404).json({ error: "会话不存在" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ==================== 导出对话 API ====================

app.get("/api/philosophy/export/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "会话不存在" });

    const messages = db.getMessagesBySession(sessionId);
    if (messages.length === 0) return res.status(404).json({ error: "会话没有消息" });

    let md = `# ${session.title || "哲学对话"}\n\n`;
    md += `> 导出时间：${new Date().toLocaleString("zh-CN")}\n\n`;
    md += `---\n\n`;

    for (const msg of messages) {
      if (msg.role === "user") {
        md += `## 👤 用户\n\n${msg.content}\n\n`;
      } else if (msg.role === "assistant" && msg.philosopher_id) {
        const p = PHILOSOPHERS[msg.philosopher_id];
        const name = p ? `${p.emoji} ${p.name}` : msg.philosopher_id;
        md += `## ${name}\n\n${msg.content}\n\n`;
      }
    }

    md += `---\n\n*由哲学家多Agent讨论系统导出*\n`;

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="philosophy-${sessionId.slice(0, 8)}.md"`);
    res.send(md);
  } catch (error: any) {
    console.error("[Export] Error:", error);
    res.status(500).json({ error: error?.message || "导出失败" });
  }
});

// ==================== 哲学讨论 API（核心功能） ====================

/**
 * 解析消息中的 @mention，返回被提及的哲学家 ID 列表
 */
function parseMentions(message: string): string[] {
  const mentions: string[] = [];
  const lowerMsg = message.toLowerCase();

  for (const [id, p] of Object.entries(PHILOSOPHERS)) {
    const patterns = [
      `@${p.name}`,
      `@${p.nameEn}`,
      `@${id}`,
      p.emoji,
    ];
    if (patterns.some(pat => lowerMsg.includes(pat.toLowerCase()))) {
      if (!mentions.includes(id)) {
        mentions.push(id);
      }
    }
  }

  return mentions;
}

/**
 * 哲学家 @mention 聊天模式
 * 用户发送消息，指定哪些哲学家回复（通过 selectedPhilosopherIds 或 @mention 解析）
 * 支持多轮对话，保留上下文（包括其他哲学家的回复）
 */
app.post("/api/philosophy/chat", async (req, res) => {
  const { sessionId, message, selectedPhilosopherIds, replyToMessageId } = req.body;

  console.log(`\n[Philosophy/Chat] ========== 新消息 ==========`);
  console.log(`[Philosophy/Chat] Message: ${message?.slice(0, 80)}`);
  if (replyToMessageId) console.log(`[Philosophy/Chat] ReplyTo: ${replyToMessageId}`);

  if (!message && !replyToMessageId) {
    return res.status(400).json({ error: "请输入消息内容" });
  }

  if (!ARK_API_KEY) {
    return res.status(500).json({ error: "未配置 ARK_API_KEY" });
  }

  // 确定要回复的哲学家列表：优先使用 selectedPhilosopherIds，否则解析 @mentions
  const mentions = (selectedPhilosopherIds && Array.isArray(selectedPhilosopherIds) && selectedPhilosopherIds.length > 0)
    ? selectedPhilosopherIds
    : parseMentions(message);

  if (mentions.length === 0) {
    return res.status(400).json({ error: "请选择至少一位哲学家进行对话" });
  }

  console.log(`[Philosophy/Chat] Philosophers: ${mentions.join(", ")}`);

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? "..." : ""),
      model: ARK_MODEL,
      created_at: now,
      updated_at: now,
    });
  }

  const userMessageId = uuidv4();

  // 保存用户消息
  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: "user",
    content: message,
    model: null,
    created_at: now,
    tool_calls: null,
    philosopher_id: null,
    mentions: JSON.stringify(mentions),
  });

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // 发送初始化事件
  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    mode: "chat",
    mentions,
  })}\n\n`);

  try {
    // 构建基础历史（包含所有哲学家回复）
    const baseHistory = buildFullHistory(session.id);

    // 如果是指定回复某条消息，把那条消息内容加入上下文
    let replyContext = "";
    if (replyToMessageId) {
      const replyMsg = db.getMessage(replyToMessageId);
      if (replyMsg) {
        const p = replyMsg.philosopher_id ? PHILOSOPHERS[replyMsg.philosopher_id] : null;
        replyContext = p
          ? `\n[用户正在回复 ${p.emoji}${p.name}的这段话：\n"${replyMsg.content.slice(0, 500)}"]\n`
          : `\n[用户正在回复这段话：\n"${replyMsg.content.slice(0, 500)}"]\n`;
      }
    }

    // 依次让被提及的哲学家回复
    for (const philosopherId of mentions) {
      const philosopher = PHILOSOPHERS[philosopherId];
      if (!philosopher) continue;

      const philosopherMsgId = uuidv4();

      try {
        // 通知前端该哲学家开始回复
      res.write(`data: ${JSON.stringify({
        type: "philosopher_start",
        philosopherId,
        philosopherName: philosopher.name,
        philosopherEmoji: philosopher.emoji,
        philosopherColor: philosopher.color,
        messageId: philosopherMsgId,
      })}\n\n`);

        // 构建当前用户消息（包含回复上下文）
        const userContent = replyContext
          ? (message ? `${replyContext}\n用户的追问：${message}` : replyContext)
          : message;

        const messagesForApi = [
          ...baseHistory,
          { role: "user", content: userContent },
        ];

        let philosopherResponse = "";

        await callArkAPI(
          messagesForApi,
          philosopher.systemPrompt,
          (textChunk) => {
            philosopherResponse += textChunk;
            res.write(`data: ${JSON.stringify({
              type: "philosopher_text",
              philosopherId,
              messageId: philosopherMsgId,
              content: textChunk,
            })}\n\n`);
          }
        );

        // 保存哲学家回复
        db.createMessage({
          id: philosopherMsgId,
          session_id: session.id,
          role: "assistant",
          content: philosopherResponse,
          model: ARK_MODEL,
          created_at: new Date().toISOString(),
          tool_calls: null,
          philosopher_id: philosopherId,
          mentions: null,
        });

        res.write(`data: ${JSON.stringify({
          type: "philosopher_done",
          philosopherId,
          philosopherName: philosopher.name,
          messageId: philosopherMsgId,
        })}\n\n`);

        console.log(`[Philosophy/Chat] ${philosopher.name} 回复完毕 (${philosopherResponse.length} 字)`);

      } catch (err: any) {
        console.error(`[Philosophy/Chat] ${philosopher?.name} 回复出错:`, err);
        res.write(`data: ${JSON.stringify({
          type: "philosopher_error",
          philosopherId,
          error: err?.message || "回复出错",
        })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error(`[Philosophy/Chat] Error:`, error);
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "处理出错" })}\n\n`);
    res.end();
  }
});

// ==================== 统筹讨论模式（保留原功能） ====================

app.post("/api/philosophy/discuss", async (req, res) => {
  const { sessionId, question, mode = "moderated" } = req.body;

  console.log(`\n[Philosophy/Discuss] ========== 新问题 ==========`);
  console.log(`[Philosophy/Discuss] Question: ${question?.slice(0, 80)}`);

  if (!question) {
    return res.status(400).json({ error: "请输入讨论问题" });
  }

  if (!ARK_API_KEY) {
    return res.status(500).json({ error: "未配置 ARK_API_KEY" });
  }

  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: question.slice(0, 30) + (question.length > 30 ? "..." : ""),
      model: ARK_MODEL,
      created_at: now,
      updated_at: now,
    });
  }

  const userMessageId = uuidv4();
  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: "user",
    content: question,
    model: null,
    created_at: now,
    tool_calls: null,
    philosopher_id: null,
    mentions: JSON.stringify(["aristotle", "confucius", "hegel", "zhuangzi"]),
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    mode: "moderated",
  })}\n\n`);

  try {
    // 1. 主持人开场
    const moderatorHistory = buildFullHistory(session.id);
    const moderatorPrompt = MODERATOR_SYSTEM_PROMPT.replace("{QUESTION}", question);

    let moderatorSummary = "";
    await callArkAPI(
      [...moderatorHistory, { role: "user", content: `请作为主持人，针对问题"${question}"做开场引导。` }],
      moderatorPrompt,
      (chunk) => { moderatorSummary += chunk; }
    );

    // 2. 四位哲学家依次发言
    const allPhilosopherIds = ["aristotle", "confucius", "hegel", "zhuangzi"];
    for (const pid of allPhilosopherIds) {
      const p = PHILOSOPHERS[pid];
      const msgId = uuidv4();

      res.write(`data: ${JSON.stringify({
        type: "philosopher_start",
        philosopherId: pid,
        philosopherName: p.name,
        philosopherEmoji: p.emoji,
        philosopherColor: p.color,
        messageId: msgId,
      })}\n\n`);

      try {
        const history = buildFullHistory(session.id);
        let response = "";
        await callArkAPI(
          [...history, { role: "user", content: `问题："${question}"。请作为${p.name}回答。` }],
          p.systemPrompt,
          (chunk) => {
            response += chunk;
            res.write(`data: ${JSON.stringify({
              type: "philosopher_text",
              philosopherId: pid,
              messageId: msgId,
              content: chunk,
            })}\n\n`);
          }
        );

        db.createMessage({
          id: msgId, session_id: session.id, role: "assistant",
          content: response, model: ARK_MODEL,
          created_at: new Date().toISOString(), tool_calls: null,
          philosopher_id: pid, mentions: null,
        });

        res.write(`data: ${JSON.stringify({
          type: "philosopher_done", philosopherId: pid,
          philosopherName: p.name, messageId: msgId,
        })}\n\n`);
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({
          type: "philosopher_error", philosopherId: pid,
          error: err?.message || "出错",
        })}\n\n`);
      }
    }

    // 3. 主持人总结
    const finalHistory = buildFullHistory(session.id);
    let finalSummary = "";
    await callArkAPI(
      [...finalHistory, { role: "user", content: "请作为主持人，对以上讨论做总结。" }],
      moderatorPrompt,
      (chunk) => { finalSummary += chunk; }
    );

    res.write(`data: ${JSON.stringify({
      type: "moderator_summary", summary: finalSummary,
    })}\n\n`);

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "讨论出错" })}\n\n`);
    res.end();
  }
});

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║                                                        ║");
  console.log("║   🏛️  哲学家多Agent讨论系统 已启动                      ║");
  console.log("║                                                        ║");
  console.log(`║   地址: http://localhost:${PORT}                         ║`);
  console.log("║   数据库: SQLite (data/chat.db)                        ║");
  console.log("║                                                        ║");
  console.log("║   哲学家: 亚里士多德 | 孔子 | 黑格尔 | 庄子            ║");
  console.log("║                                                        ║");
  console.log("║   LLM: 火山引擎 Ark API                               ║");
  console.log(`║   模型: ${ARK_MODEL.padEnd(20)} ║`);
  console.log("║                                                        ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log();
});
