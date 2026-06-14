import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db.js";
import { 
  PHILOSOPHERS, 
  MODERATOR_SYSTEM_PROMPT, 
  getPhilosopherAgentDefinitions,
  type PhilosopherConfig 
} from "./philosophers.js";

// 待处理的权限请求
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();

// 权限请求超时时间（5分钟）
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// 缓存可用模型列表
let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "claude-sonnet-4";

// ============= 健康检查 =============

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============= 哲学家配置 API =============

// 获取所有哲学家配置
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

// ============= 登录检查 =============

type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string;
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = {
    isLoggedIn: false,
    envConfigured: false,
    cliConfigured: false,
    envVars: {},
  };
  
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;
  
  if (apiKey || authToken) {
    response.envConfigured = true;
    if (apiKey) {
      response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
      response.apiKey = response.envVars!.apiKey;
    }
    if (authToken) {
      response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    }
    if (internetEnv) {
      response.envVars!.internetEnv = internetEnv;
    }
    if (baseUrl) {
      response.envVars!.baseUrl = baseUrl;
    }
  }
  
  try {
    let needsLogin = false;
    
    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        needsLogin = true;
        console.log('[Check Login] 需要登录，认证 URL:', authState.authUrl);
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });
    
    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
      console.log('[Check Login] 已登录用户:', result.userinfo.userName);
    } else if (!needsLogin) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    console.error("[Check Login] SDK Error:", error);
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }
  
  res.json(response);
});

// 保存环境变量配置
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;
  
  if (!apiKey && !authToken) {
    return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
  }
  
  const configuredVars: string[] = [];
  
  if (apiKey) {
    process.env.CODEBUDDY_API_KEY = apiKey;
    configuredVars.push('CODEBUDDY_API_KEY');
  }
  if (authToken) {
    process.env.CODEBUDDY_AUTH_TOKEN = authToken;
    configuredVars.push('CODEBUDDY_AUTH_TOKEN');
  }
  if (internetEnv) {
    process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv;
    configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT');
  }
  if (baseUrl) {
    process.env.CODEBUDDY_BASE_URL = baseUrl;
    configuredVars.push('CODEBUDDY_BASE_URL');
  }
  
  cachedModels = [];
  
  res.json({ 
    success: true, 
    message: `已设置: ${configuredVars.join(', ')}`,
    note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
  });
});

// ============= 模型 API =============

app.get("/api/models", async (req, res) => {
  try {
    if (cachedModels.length === 0) {
      console.log("[Models] Creating session to fetch available models...");
      
      const session = await unstable_v2_createSession({ 
        cwd: process.cwd()
      });
      
      const models = await session.getAvailableModels();
      console.log("[Models] Got", models.length, "models");
      
      if (models && Array.isArray(models)) {
        cachedModels = models;
      }
    }
    
    res.json({ 
      models: cachedModels.length > 0 ? cachedModels : [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }
      ],
      defaultModel 
    });
  } catch (error: any) {
    console.error("[Models] Error:", error);
    res.json({
      models: [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" },
        { modelId: "claude-opus-4", name: "Claude Opus 4" }
      ],
      defaultModel,
      error: error?.message || String(error)
    });
  }
});

// ============= 会话 API =============

app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length
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
    
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    
    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "哲学讨论" } = req.body;
    const now = new Date().toISOString();
    
    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      created_at: now,
      updated_at: now
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

// ============= 权限处理 =============

app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;
  
  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    return res.status(404).json({ error: "权限请求不存在或已超时" });
  }
  
  pendingPermissions.delete(requestId);
  
  if (behavior === 'allow') {
    pending.resolve({
      behavior: 'allow',
      updatedInput: pending.input
    });
  } else {
    pending.resolve({
      behavior: 'deny',
      message: message || '用户拒绝了此操作'
    });
  }
  
  res.json({ success: true });
});

// ============= 哲学讨论 API（核心功能） =============

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
    mode = 'moderated',  // 'moderated' | 'single'
    philosopherId,       // 单哲学家模式下指定哲学家
  } = req.body;
  
  console.log(`\n[Philosophy] ========== 新哲学讨论 ==========`);
  console.log(`[Philosophy] Mode: ${mode}`);
  console.log(`[Philosophy] Question: ${question?.slice(0, 100)}`);

  if (!question) {
    return res.status(400).json({ error: "请输入哲学问题" });
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();
  
  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: question.slice(0, 30) + (question.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
  }

  const selectedModel = model || session.model || defaultModel;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息
  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: 'user',
    content: question,
    model: null,
    created_at: now,
    tool_calls: null
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
    mode
  })}\n\n`);

  try {
    if (mode === 'single' && philosopherId) {
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
  const philosopherOrder = ['aristotle', 'confucius', 'hegel', 'zhuangzi'];
  let fullResponse = '';

  // 第一步：主持人开场
  res.write(`data: ${JSON.stringify({ 
    type: "moderator_start",
    content: "正在召集四位哲学大师进行讨论..."
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

      let philosopherResponse = '';

      const stream = query({
        prompt: philosopherPrompt,
        options: {
          cwd: process.cwd(),
          model: model,
          maxTurns: 3,
          systemPrompt: philosopher.systemPrompt,
          permissionMode: 'bypassPermissions',
        }
      });

      for await (const msg of stream) {
        if (msg.type === "assistant") {
          const content = msg.message.content;
          if (typeof content === "string") {
            philosopherResponse += content;
            res.write(`data: ${JSON.stringify({ 
              type: "philosopher_text",
              philosopherId,
              content
            })}\n\n`);
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text") {
                philosopherResponse += block.text;
                res.write(`data: ${JSON.stringify({ 
                  type: "philosopher_text",
                  philosopherId,
                  content: block.text
                })}\n\n`);
              }
            }
          }
        }
      }

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
        error: err?.message || "发言出错"
      })}\n\n`);
    }
  }

  // 最后：主持人总结
  res.write(`data: ${JSON.stringify({ 
    type: "moderator_summary_start",
    content: "正在生成哲学综合总结..."
  })}\n\n`);

  try {
    const summaryPrompt = `以下是四位哲学家对"${question}"这一问题的回答：

${fullResponse}

请作为一位中立的哲学讨论主持人，用150字左右综合这四位哲学家的智慧，指出其中的共鸣之处与分歧所在，给出对这个问题的多维度哲学启示。`;

    let summaryResponse = '';
    
    const summaryStream = query({
      prompt: summaryPrompt,
      options: {
        cwd: process.cwd(),
        model: model,
        maxTurns: 3,
        systemPrompt: MODERATOR_SYSTEM_PROMPT,
        permissionMode: 'bypassPermissions',
      }
    });

    for await (const msg of summaryStream) {
      if (msg.type === "assistant") {
        const content = msg.message.content;
        if (typeof content === "string") {
          summaryResponse += content;
          res.write(`data: ${JSON.stringify({ 
            type: "moderator_text",
            content
          })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              summaryResponse += block.text;
              res.write(`data: ${JSON.stringify({ 
                type: "moderator_text",
                content: block.text
              })}\n\n`);
            }
          }
        }
      }
    }

    fullResponse += `\n\n【主持人总结】\n${summaryResponse}`;

  } catch (err: any) {
    console.error(`[Philosophy] 总结出错:`, err);
  }

  // 保存完整对话到数据库
  db.createMessage({
    id: assistantMessageId,
    session_id: session.id,
    role: 'assistant',
    content: fullResponse,
    model: model,
    created_at: new Date().toISOString(),
    tool_calls: null
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

  let fullResponse = '';

  const stream = query({
    prompt: question,
    options: {
      cwd: process.cwd(),
      model: model,
      maxTurns: 5,
      systemPrompt: philosopher.systemPrompt,
      permissionMode: 'bypassPermissions',
    }
  });

  for await (const msg of stream) {
    if (msg.type === "assistant") {
      const content = msg.message.content;
      if (typeof content === "string") {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ 
          type: "philosopher_text",
          philosopherId,
          content
        })}\n\n`);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            fullResponse += block.text;
            res.write(`data: ${JSON.stringify({ 
              type: "philosopher_text",
              philosopherId,
              content: block.text
            })}\n\n`);
          }
        }
      }
    }
  }

  res.write(`data: ${JSON.stringify({ 
    type: "philosopher_done",
    philosopherId,
    philosopherName: philosopher.name,
  })}\n\n`);

  // 保存到数据库
  db.createMessage({
    id: assistantMessageId,
    session_id: session.id,
    role: 'assistant',
    content: `【${philosopher.emoji} ${philosopher.name}】\n${fullResponse}`,
    model: model,
    created_at: new Date().toISOString(),
    tool_calls: null
  });

  res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  res.end();
}

// ============= 普通聊天 API（保持原有功能） =============

app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode } = req.body;
  
  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();
  
  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
  }

  const selectedModel = model || session.model;
  const sdkSessionId = session.sdk_session_id;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      created_at: now,
      tool_calls: null
    });
  } catch (dbError: any) {
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const workingDir = cwd || process.cwd();

  try {
    const canUseTool: CanUseTool = async (toolName, input, options) => {
      if (permissionMode === 'bypassPermissions') {
        return { behavior: 'allow', updatedInput: input };
      }
      
      const requestId = uuidv4();
      const permissionRequest = {
        requestId,
        toolUseId: options.toolUseID,
        toolName,
        input,
        sessionId: session.id,
        timestamp: Date.now()
      };
      
      res.write(`data: ${JSON.stringify({ 
        type: "permission_request", 
        ...permissionRequest
      })}\n\n`);
      
      return new Promise<PermissionResult>((resolve, reject) => {
        const pending: PendingPermission = {
          resolve,
          reject,
          toolName,
          input,
          sessionId: session.id,
          timestamp: Date.now()
        };
        
        pendingPermissions.set(requestId, pending);
        
        setTimeout(() => {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            resolve({ behavior: 'deny', message: '权限请求超时' });
          }
        }, PERMISSION_TIMEOUT);
      });
    };
    
    const stream = query({
      prompt: message,
      options: {
        cwd: workingDir,
        model: selectedModel,
        maxTurns: 10,
        systemPrompt: systemPrompt || "你是一个专业的AI助手，善于帮助用户解决各种问题。请用简洁清晰的方式回答问题。",
        permissionMode: permissionMode || 'default',
        canUseTool,
        ...(sdkSessionId ? { resume: sdkSessionId } : {})
      }
    });

    let fullResponse = "";
    let toolCalls: Array<{ 
      id: string; 
      name: string; 
      input?: Record<string, unknown>;
      status: string; 
      result?: string;
      isError?: boolean;
    }> = [];
    let newSdkSessionId: string | null = null;
    let currentToolId: string | null = null;

    res.write(`data: ${JSON.stringify({ 
      type: "init", 
      sessionId: session.id, 
      userMessageId, 
      assistantMessageId,
      model: selectedModel 
    })}\n\n`);

    for await (const msg of stream) {
      if (msg.type === "system" && (msg as any).subtype === "init") {
        newSdkSessionId = (msg as any).session_id;
        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
          db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
        }
      } else if (msg.type === "assistant") {
        const content = msg.message.content;

        if (typeof content === "string") {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              currentToolId = block.id || uuidv4();
              const toolInput = (block as any).input || {};
              const toolCall = { 
                id: currentToolId, 
                name: block.name, 
                input: toolInput,
                status: "running" 
              };
              toolCalls.push(toolCall);
              res.write(`data: ${JSON.stringify({ 
                type: "tool", 
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
                status: toolCall.status
              })}\n\n`);
            }
          }
        }
      } else if (msg.type === "tool_result") {
        const msgAny = msg as any;
        const toolId = msgAny.tool_use_id || currentToolId;
        const isError = msgAny.is_error || false;
        const content = msgAny.content;
        
        const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
        if (tool) {
          tool.status = isError ? "error" : "completed";
          tool.isError = isError;
          tool.result = typeof content === 'string' ? content : JSON.stringify(content);
          res.write(`data: ${JSON.stringify({ 
            type: "tool_result", 
            toolId: tool.id, 
            content: tool.result,
            isError: isError
          })}\n\n`);
        }
        currentToolId = null;
      } else if (msg.type === "result") {
        toolCalls.forEach(tool => {
          if (tool.status === "running") {
            tool.status = "completed";
            res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost })}\n\n`);
      }
    }

    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: selectedModel,
      created_at: new Date().toISOString(),
      tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    });

    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, { 
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel
      });
    }

    res.end();
  } catch (error: any) {
    console.error(`[Chat] Error:`, error);
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// ============= 启动服务器 =============

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
╚════════════════════════════════════════════════════════╝
  `);
});
