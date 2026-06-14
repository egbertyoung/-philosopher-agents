import express from "express";
import { config as dotenvConfig } from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db.js";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;

// ==================== 火山引擎 Ark API 配置 ====================

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/coding/v3";
const ARK_MODEL = process.env.ARK_MODEL || "DeepSeek-V4-Pro";

// ==================== Ark API 调用函数 ====================

/**
 * 调用火山引擎 Ark API（支持流式输出）
 * @param messages 对话消息列表
 * @param systemPrompt 系统提示词
 * @param onChunk 流式输出回调（可选，不传则等待完整响应）
 * @returns 完整回复文本
 */
async function callArkAPI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const url = `${ARK_BASE_URL}/chat/completions`;

  const body: any = {
    model: ARK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
    ],
    stream: !!onChunk,
    max_tokens: 2000,
    temperature: 0.7,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ARK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ark API 错误 ${response.status}: ${errorText}`);
  }

  if (onChunk) {
    // 流式处理 SSE
    const reader = response.body?.getReader();
    if (!reader) throw new Error("响应无正文");

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // 保留最后一个可能不完整的行
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6).trim();
        if (data === "[DONE]") break;

        try {
          const json = JSON.parse(data);
          const text = json.choices?.[0]?.delta?.content;
          if (text) {
            fullText += text;
            onChunk(text);
          }
        } catch (e) {
          // 忽略解析错误（可能是不完整的 JSON）
        }
      }
    }

    // 处理缓冲区剩余内容
    if (buffer.trim().startsWith("data: ")) {
      const data = buffer.trim().slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          const json = JSON.parse(data);
          const text = json.choices?.[0]?.delta?.content;
          if (text) {
            fullText += text;
            onChunk(text);
          }
        } catch (e) {
          // 忽略
        }
      }
    }

    return fullText;
  } else {
    // 非流式，直接返回完整响应
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

// ==================== 健康检查 ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ark_configured: !!ARK_API_KEY,
  });
});

// ==================== 哲学家配置 API ====================

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

// ==================== 登录/配置检查 ====================

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

// 保存环境变量配置（运行时动态设置）
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, baseUrl, model } = req.body;

  if (apiKey) {
    process.env.ARK_API_KEY = apiKey;
  }
  if (baseUrl) {
    process.env.ARK_BASE_URL = baseUrl;
  }
  if (model) {
    process.env.ARK_MODEL = model;
  }

  res.json({
    success: true,
    message: "已更新配置（重启服务器后失效，请同步修改 .env 文件）",
  });
});

// ==================== 模型 API ====================

app.get("/api/models", async (req, res) => {
  // 返回配置的模型列表
  res.json({
    models: [
      { modelId: ARK_MODEL, name: ARK_MODEL },
      { modelId: "DeepSeek-V4-Pro", name: "DeepSeek V4 Pro" },
      { modelId: "DeepSeek-V3", name: "DeepSeek V3" },
    ],
    defaultModel: ARK_MODEL,
  });
});

// ==================== 会话 API ====================

app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map((session: any) => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length,
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }

    const messages = db.getMessagesBySession(sessionId);

    const parsedMessages = messages.map((msg: any) => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null,
    }));

    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

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
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;

    const success = db.updateSession(sessionId, { title, model });

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ==================== 哲学讨论 API（核心功能） ====================

/**
 * 哲学大讨论 - 统筹Agent调度四位哲学家
 * 支持两种模式：
 * 1. 统筹模式（mode=moderated）：由总Agent统筹，逐一向各哲学家提问
 * 2. 单哲学家模式（mode=single）：直接与某位哲学家对话
 */
app.post("/api/philosophy/discuss", async (req, res) => {
  const {
    sessionId,
    question,
    model,
    mode = "moderated",
    philosopherId,
  } = req.body;

  console.log(`\n[Philosophy] ========== 新哲学讨论 ==========`);
  console.log(`[Philosophy] Mode: ${mode}`);
  console.log(`[Philosophy] Question: ${question?.slice(0, 100)}`);

  if (!question) {
    return res.status(400).json({ error: "请输入哲学问题" });
  }

  if (!ARK_API_KEY) {
    return res.status(500).json({ error: "未配置 ARK_API_KEY，请在 .env 文件中填写火山引擎 Ark API Key" });
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: question.slice(0, 30) + (question.length > 30 ? "..." : ""),
      model: model || ARK_MODEL,
      created_at: now,
      updated_at: now,
    });
  }

  const selectedModel = model || session.model || ARK_MODEL;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息
  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: "user",
    content: question,
    model: null,
    created_at: now,
    tool_calls: null,
  });

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 发送初始化事件
  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    assistantMessageId,
    model: selectedModel,
    mode,
  })}\n\n`);

  try {
    if (mode === "single" && philosopherId) {
      // 单哲学家对话模式
      await handleSinglePhilosopher(res, question, philosopherId, selectedModel, session, assistantMessageId);
    } else {
      // 统筹模式：依次让四位哲学家发言
      await handleModeratedDiscussion(res, question, selectedModel, session, assistantMessageId);
    }
  } catch (error: any) {
    console.error(`[Philosophy] Error:`, error);
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "哲学讨论出错" })}\n\n`);
    res.end();
  }
});

/**
 * 统筹模式：主持人先发言，然后依次调用每位哲学家
 */
async function handleModeratedDiscussion(
  res: express.Response,
  question: string,
  model: string,
  session: any,
  assistantMessageId: string
) {
  const philosopherOrder = ["aristotle", "confucius", "hegel", "zhuangzi"];
  let fullResponse = "";

  // 第一步：主持人开场
  res.write(`data: ${JSON.stringify({
    type: "moderator_start",
    content: "正在召集四位哲学大师进行讨论...",
  })}\n\n`);

  // 依次获取每位哲学家的观点
  for (const philosopherId of philosopherOrder) {
    const philosopher = PHILOSOPHERS[philosopherId];
    if (!philosopher) continue;

    console.log(`[Philosophy] 召唤 ${philosopher.name}...`);

    // 通知前端当前哲学家开始发言
    res.write(`data: ${JSON.stringify({
      type: "philosopher_start",
      philosopherId,
      philosopherName: philosopher.name,
      philosopherEmoji: philosopher.emoji,
      philosopherColor: philosopher.color,
    })}\n\n`);

    try {
      // 为每位哲学家构建提问
      const philosopherPrompt = `关于以下哲学问题，请从你的哲学体系出发给出你的思考与见解：

问题：${question}

请以你自己的身份和哲学思想体系回答，引用你的核心概念和著作，展现你独特的哲学视角。回答请在300字以内，精炼深刻。`;

      let philosopherResponse = "";

      await callArkAPI(
        [{ role: "user", content: philosopherPrompt }],
        philosopher.systemPrompt,
        (textChunk) => {
          philosopherResponse += textChunk;
          res.write(`data: ${JSON.stringify({
            type: "philosopher_text",
            philosopherId,
            content: textChunk,
          })}\n\n`);
        }
      );

      // 哲学家发言完毕
      res.write(`data: ${JSON.stringify({
        type: "philosopher_done",
        philosopherId,
        philosopherName: philosopher.name,
      })}\n\n`);

      fullResponse += `\n\n【${philosopher.emoji} ${philosopher.name}】\n${philosopherResponse}`;

      console.log(`[Philosophy] ${philosopher.name} 发言完毕 (${philosopherResponse.length} 字)`);

    } catch (err: any) {
      console.error(`[Philosophy] ${philosopher.name} 发言出错:`, err);
      res.write(`data: ${JSON.stringify({
        type: "philosopher_error",
        philosopherId,
        error: err?.message || "发言出错",
      })}\n\n`);
    }
  }

  // 最后：主持人总结
  res.write(`data: ${JSON.stringify({
    type: "moderator_summary_start",
    content: "正在生成哲学综合总结...",
  })}\n\n`);

  try {
    const summaryPrompt = `以下是四位哲学家对"${question}"这一问题的回答：

${fullResponse}

请作为一位中立的哲学讨论主持人，用150字左右综合这四位哲学家的智慧，指出其中的共鸣之处与分歧所在，给出对这个问题的多维度哲学启示。`;

    let summaryResponse = "";

    await callArkAPI(
      [{ role: "user", content: summaryPrompt }],
      MODERATOR_SYSTEM_PROMPT,
      (textChunk) => {
        summaryResponse += textChunk;
        res.write(`data: ${JSON.stringify({
          type: "moderator_text",
          content: textChunk,
        })}\n\n`);
      }
    );

    fullResponse += `\n\n【主持人总结】\n${summaryResponse}`;

  } catch (err: any) {
    console.error(`[Philosophy] 总结出错:`, err);
  }

  // 保存完整对话到数据库
  db.createMessage({
    id: assistantMessageId,
    session_id: session.id,
    role: "assistant",
    content: fullResponse,
    model: model,
    created_at: new Date().toISOString(),
    tool_calls: null,
  });

  res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  res.end();
}

/**
 * 单哲学家对话模式
 */
async function handleSinglePhilosopher(
  res: express.Response,
  question: string,
  philosopherId: string,
  model: string,
  session: any,
  assistantMessageId: string
) {
  const philosopher = PHILOSOPHERS[philosopherId];
  if (!philosopher) {
    res.write(`data: ${JSON.stringify({ type: "error", message: `未找到哲学家: ${philosopherId}` })}\n\n`);
    res.end();
    return;
  }

  res.write(`data: ${JSON.stringify({
    type: "philosopher_start",
    philosopherId,
    philosopherName: philosopher.name,
    philosopherEmoji: philosopher.emoji,
    philosopherColor: philosopher.color,
  })}\n\n`);

  let fullResponse = "";

  try {
    await callArkAPI(
      [{ role: "user", content: question }],
      philosopher.systemPrompt,
      (textChunk) => {
        fullResponse += textChunk;
        res.write(`data: ${JSON.stringify({
          type: "philosopher_text",
          philosopherId,
          content: textChunk,
        })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({
      type: "philosopher_done",
      philosopherId,
      philosopherName: philosopher.name,
    })}\n\n`);

    // 保存到数据库
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: "assistant",
      content: `【${philosopher.emoji} ${philosopher.name}】\n${fullResponse}`,
      model: model,
      created_at: new Date().toISOString(),
      tool_calls: null,
    });

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

  } catch (err: any) {
    console.error(`[Philosophy] ${philosopher.name} 对话出错:`, err);
    res.write(`data: ${JSON.stringify({
      type: "error",
      message: err?.message || "对话出错",
    })}\n\n`);
    res.end();
  }
}

// ==================== 普通聊天 API（保持原有功能，改用 Ark API） ====================

app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt } = req.body;

  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? "..." : ""}`);

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  if (!ARK_API_KEY) {
    return res.status(500).json({ error: "未配置 ARK_API_KEY" });
  }

  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? "..." : ""),
      model: model || ARK_MODEL,
      created_at: now,
      updated_at: now,
    });
  }

  const selectedModel = model || session.model || ARK_MODEL;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: "user",
      content: message,
      model: null,
      created_at: now,
      tool_calls: null,
    });
  } catch (dbError: any) {
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const effectiveSystemPrompt = systemPrompt || "你是一个专业的AI助手，善于帮助用户解决各种问题。请用简洁清晰的方式回答问题。";

  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    assistantMessageId,
    model: selectedModel,
  })}\n\n`);

  try {
    let fullResponse = "";

    await callArkAPI(
      [{ role: "user", content: message }],
      effectiveSystemPrompt,
      (textChunk) => {
        fullResponse += textChunk;
        res.write(`data: ${JSON.stringify({ type: "text", content: textChunk })}\n\n`);
      }
    );

    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: "assistant",
      content: fullResponse,
      model: selectedModel,
      created_at: new Date().toISOString(),
      tool_calls: null,
    });

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error(`[Chat] Error:`, error);
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🏛️  哲学家多Agent讨论系统 已启动                      ║
║                                                        ║
║   地址: http://localhost:${PORT}                         ║
║   数据库: SQLite (data/chat.db)                        ║
║                                                        ║
║   哲学家: 亚里士多德 | 孔子 | 黑格尔 | 庄子            ║
║                                                        ║
║   LLM: 火山引擎 Ark API                               ║
║   模型: ${ARK_MODEL.padEnd(43)}║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});
