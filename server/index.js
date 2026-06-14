var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db.js";
import { PHILOSOPHERS, MODERATOR_SYSTEM_PROMPT } from "./philosophers.js";
var pendingPermissions = new Map();
// 权限请求超时时间（5分钟）
var PERMISSION_TIMEOUT = 5 * 60 * 1000;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3000;
// Middleware
app.use(express.json());
// 缓存可用模型列表
var cachedModels = [];
var defaultModel = "claude-sonnet-4";
// ============= 健康检查 =============
app.get("/api/health", function (req, res) {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// ============= 哲学家配置 API =============
// 获取所有哲学家配置
app.get("/api/philosophers", function (req, res) {
    var philosophers = Object.values(PHILOSOPHERS).map(function (p) { return ({
        id: p.id,
        name: p.name,
        nameEn: p.nameEn,
        era: p.era,
        origin: p.origin,
        emoji: p.emoji,
        color: p.color,
        description: p.description,
        keyPhilosophies: p.keyPhilosophies,
    }); });
    res.json({ philosophers: philosophers });
});
app.get("/api/check-login", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var response, apiKey, authToken, internetEnv, baseUrl, needsLogin_1, result, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                response = {
                    isLoggedIn: false,
                    envConfigured: false,
                    cliConfigured: false,
                    envVars: {},
                };
                apiKey = process.env.CODEBUDDY_API_KEY;
                authToken = process.env.CODEBUDDY_AUTH_TOKEN;
                internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
                baseUrl = process.env.CODEBUDDY_BASE_URL;
                if (apiKey || authToken) {
                    response.envConfigured = true;
                    if (apiKey) {
                        response.envVars.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
                        response.apiKey = response.envVars.apiKey;
                    }
                    if (authToken) {
                        response.envVars.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
                    }
                    if (internetEnv) {
                        response.envVars.internetEnv = internetEnv;
                    }
                    if (baseUrl) {
                        response.envVars.baseUrl = baseUrl;
                    }
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                needsLogin_1 = false;
                return [4 /*yield*/, unstable_v2_authenticate({
                        environment: 'external',
                        onAuthUrl: function (authState) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                needsLogin_1 = true;
                                console.log('[Check Login] 需要登录，认证 URL:', authState.authUrl);
                                response.error = '未登录，请先登录 CodeBuddy CLI';
                                return [2 /*return*/];
                            });
                        }); }
                    })];
            case 2:
                result = _a.sent();
                if (!needsLogin_1 && (result === null || result === void 0 ? void 0 : result.userinfo)) {
                    response.isLoggedIn = true;
                    response.cliConfigured = true;
                    response.method = response.envConfigured ? 'env' : 'cli';
                    console.log('[Check Login] 已登录用户:', result.userinfo.userName);
                }
                else if (!needsLogin_1) {
                    response.isLoggedIn = true;
                    response.cliConfigured = true;
                    response.method = response.envConfigured ? 'env' : 'cli';
                }
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                console.error("[Check Login] SDK Error:", error_1);
                if (response.envConfigured) {
                    response.isLoggedIn = true;
                    response.method = 'env';
                }
                else {
                    response.error = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1);
                    response.method = 'none';
                }
                return [3 /*break*/, 4];
            case 4:
                res.json(response);
                return [2 /*return*/];
        }
    });
}); });
// 保存环境变量配置
app.post("/api/save-env-config", function (req, res) {
    var _a = req.body, apiKey = _a.apiKey, authToken = _a.authToken, internetEnv = _a.internetEnv, baseUrl = _a.baseUrl;
    if (!apiKey && !authToken) {
        return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
    }
    var configuredVars = [];
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
        message: "\u5DF2\u8BBE\u7F6E: ".concat(configuredVars.join(', ')),
        note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
    });
});
// ============= 模型 API =============
app.get("/api/models", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var session, models, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                if (!(cachedModels.length === 0)) return [3 /*break*/, 3];
                console.log("[Models] Creating session to fetch available models...");
                return [4 /*yield*/, unstable_v2_createSession({
                        cwd: process.cwd()
                    })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, session.getAvailableModels()];
            case 2:
                models = _a.sent();
                console.log("[Models] Got", models.length, "models");
                if (models && Array.isArray(models)) {
                    cachedModels = models;
                }
                _a.label = 3;
            case 3:
                res.json({
                    models: cachedModels.length > 0 ? cachedModels : [
                        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }
                    ],
                    defaultModel: defaultModel
                });
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                console.error("[Models] Error:", error_2);
                res.json({
                    models: [
                        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" },
                        { modelId: "claude-opus-4", name: "Claude Opus 4" }
                    ],
                    defaultModel: defaultModel,
                    error: (error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || String(error_2)
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ============= 会话 API =============
app.get("/api/sessions", function (req, res) {
    try {
        var sessions = db.getAllSessions();
        var sessionsWithMessages = sessions.map(function (session) {
            var messages = db.getMessagesBySession(session.id);
            return __assign(__assign({}, session), { messageCount: messages.length });
        });
        res.json({ sessions: sessionsWithMessages });
    }
    catch (error) {
        console.error("[Sessions] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
app.get("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var session = db.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: "会话不存在" });
        }
        var messages = db.getMessagesBySession(sessionId);
        var parsedMessages = messages.map(function (msg) { return (__assign(__assign({}, msg), { tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null })); });
        res.json({ session: session, messages: parsedMessages });
    }
    catch (error) {
        console.error("[Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
app.post("/api/sessions", function (req, res) {
    try {
        var _a = req.body, _b = _a.model, model = _b === void 0 ? defaultModel : _b, _c = _a.title, title = _c === void 0 ? "哲学讨论" : _c;
        var now = new Date().toISOString();
        var session = db.createSession({
            id: uuidv4(),
            title: title,
            model: model,
            created_at: now,
            updated_at: now
        });
        res.json({ session: session });
    }
    catch (error) {
        console.error("[Create Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "创建会话失败" });
    }
});
app.patch("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var _a = req.body, title = _a.title, model = _a.model;
        var success = db.updateSession(sessionId, { title: title, model: model });
        if (!success) {
            return res.status(404).json({ error: "会话不存在" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Update Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "更新会话失败" });
    }
});
app.delete("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var success = db.deleteSession(sessionId);
        if (!success) {
            return res.status(404).json({ error: "会话不存在" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Delete Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "删除会话失败" });
    }
});
// ============= 权限处理 =============
app.post("/api/permission-response", function (req, res) {
    var _a = req.body, requestId = _a.requestId, behavior = _a.behavior, message = _a.message;
    var pending = pendingPermissions.get(requestId);
    if (!pending) {
        return res.status(404).json({ error: "权限请求不存在或已超时" });
    }
    pendingPermissions.delete(requestId);
    if (behavior === 'allow') {
        pending.resolve({
            behavior: 'allow',
            updatedInput: pending.input
        });
    }
    else {
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
app.post("/api/philosophy/discuss", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, sessionId, question, model, _b, mode, philosopherId, session, now, selectedModel, userMessageId, assistantMessageId, error_3;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = req.body, sessionId = _a.sessionId, question = _a.question, model = _a.model, _b = _a.mode, mode = _b === void 0 ? 'moderated' : _b, philosopherId = _a.philosopherId;
                console.log("\n[Philosophy] ========== \u65B0\u54F2\u5B66\u8BA8\u8BBA ==========");
                console.log("[Philosophy] Mode: ".concat(mode));
                console.log("[Philosophy] Question: ".concat(question === null || question === void 0 ? void 0 : question.slice(0, 100)));
                if (!question) {
                    return [2 /*return*/, res.status(400).json({ error: "请输入哲学问题" })];
                }
                session = sessionId ? db.getSession(sessionId) : null;
                now = new Date().toISOString();
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
                selectedModel = model || session.model || defaultModel;
                userMessageId = uuidv4();
                assistantMessageId = uuidv4();
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
                res.write("data: ".concat(JSON.stringify({
                    type: "init",
                    sessionId: session.id,
                    userMessageId: userMessageId,
                    assistantMessageId: assistantMessageId,
                    model: selectedModel,
                    mode: mode
                }), "\n\n"));
                _c.label = 1;
            case 1:
                _c.trys.push([1, 6, , 7]);
                if (!(mode === 'single' && philosopherId)) return [3 /*break*/, 3];
                // 单哲学家对话模式
                return [4 /*yield*/, handleSinglePhilosopher(res, question, philosopherId, selectedModel, session, assistantMessageId)];
            case 2:
                // 单哲学家对话模式
                _c.sent();
                return [3 /*break*/, 5];
            case 3: 
            // 统筹模式：依次让四位哲学家发言
            return [4 /*yield*/, handleModeratedDiscussion(res, question, selectedModel, session, assistantMessageId)];
            case 4:
                // 统筹模式：依次让四位哲学家发言
                _c.sent();
                _c.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                error_3 = _c.sent();
                console.error("[Philosophy] Error:", error_3);
                res.write("data: ".concat(JSON.stringify({ type: "error", message: (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || "哲学讨论出错" }), "\n\n"));
                res.end();
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
/**
 * 统筹模式：主持人先发言，然后依次调用每位哲学家
 */
function handleModeratedDiscussion(res, question, model, session, assistantMessageId) {
    return __awaiter(this, void 0, void 0, function () {
        var philosopherOrder, fullResponse, _i, philosopherOrder_1, philosopherId, philosopher, philosopherPrompt, philosopherResponse, stream, _a, stream_1, stream_1_1, msg, content, _b, content_1, block, e_1_1, err_1, summaryPrompt, summaryResponse, summaryStream, _c, summaryStream_1, summaryStream_1_1, msg, content, _d, content_2, block, e_2_1, err_2;
        var _e, e_1, _f, _g, _h, e_2, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    philosopherOrder = ['aristotle', 'confucius', 'hegel', 'zhuangzi'];
                    fullResponse = '';
                    // 第一步：主持人开场
                    res.write("data: ".concat(JSON.stringify({
                        type: "moderator_start",
                        content: "正在召集四位哲学大师进行讨论..."
                    }), "\n\n"));
                    _i = 0, philosopherOrder_1 = philosopherOrder;
                    _l.label = 1;
                case 1:
                    if (!(_i < philosopherOrder_1.length)) return [3 /*break*/, 17];
                    philosopherId = philosopherOrder_1[_i];
                    philosopher = PHILOSOPHERS[philosopherId];
                    if (!philosopher)
                        return [3 /*break*/, 16];
                    console.log("[Philosophy] \u53EC\u5524 ".concat(philosopher.name, "..."));
                    // 通知前端当前哲学家开始发言
                    res.write("data: ".concat(JSON.stringify({
                        type: "philosopher_start",
                        philosopherId: philosopherId,
                        philosopherName: philosopher.name,
                        philosopherEmoji: philosopher.emoji,
                        philosopherColor: philosopher.color,
                    }), "\n\n"));
                    _l.label = 2;
                case 2:
                    _l.trys.push([2, 15, , 16]);
                    philosopherPrompt = "\u5173\u4E8E\u4EE5\u4E0B\u54F2\u5B66\u95EE\u9898\uFF0C\u8BF7\u4ECE\u4F60\u7684\u54F2\u5B66\u4F53\u7CFB\u51FA\u53D1\u7ED9\u51FA\u4F60\u7684\u601D\u8003\u4E0E\u89C1\u89E3\uFF1A\n\n\u95EE\u9898\uFF1A".concat(question, "\n\n\u8BF7\u4EE5\u4F60\u81EA\u5DF1\u7684\u8EAB\u4EFD\u548C\u54F2\u5B66\u601D\u60F3\u4F53\u7CFB\u56DE\u7B54\uFF0C\u5F15\u7528\u4F60\u7684\u6838\u5FC3\u6982\u5FF5\u548C\u8457\u4F5C\uFF0C\u5C55\u73B0\u4F60\u72EC\u7279\u7684\u54F2\u5B66\u89C6\u89D2\u3002\u56DE\u7B54\u8BF7\u5728300\u5B57\u4EE5\u5185\uFF0C\u7CBE\u70BC\u6DF1\u523B\u3002");
                    philosopherResponse = '';
                    stream = query({
                        prompt: philosopherPrompt,
                        options: {
                            cwd: process.cwd(),
                            model: model,
                            maxTurns: 3,
                            systemPrompt: philosopher.systemPrompt,
                            permissionMode: 'bypassPermissions',
                        }
                    });
                    _l.label = 3;
                case 3:
                    _l.trys.push([3, 8, 9, 14]);
                    _a = true, stream_1 = (e_1 = void 0, __asyncValues(stream));
                    _l.label = 4;
                case 4: return [4 /*yield*/, stream_1.next()];
                case 5:
                    if (!(stream_1_1 = _l.sent(), _e = stream_1_1.done, !_e)) return [3 /*break*/, 7];
                    _g = stream_1_1.value;
                    _a = false;
                    msg = _g;
                    if (msg.type === "assistant") {
                        content = msg.message.content;
                        if (typeof content === "string") {
                            philosopherResponse += content;
                            res.write("data: ".concat(JSON.stringify({
                                type: "philosopher_text",
                                philosopherId: philosopherId,
                                content: content
                            }), "\n\n"));
                        }
                        else if (Array.isArray(content)) {
                            for (_b = 0, content_1 = content; _b < content_1.length; _b++) {
                                block = content_1[_b];
                                if (block.type === "text") {
                                    philosopherResponse += block.text;
                                    res.write("data: ".concat(JSON.stringify({
                                        type: "philosopher_text",
                                        philosopherId: philosopherId,
                                        content: block.text
                                    }), "\n\n"));
                                }
                            }
                        }
                    }
                    _l.label = 6;
                case 6:
                    _a = true;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 14];
                case 8:
                    e_1_1 = _l.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 14];
                case 9:
                    _l.trys.push([9, , 12, 13]);
                    if (!(!_a && !_e && (_f = stream_1.return))) return [3 /*break*/, 11];
                    return [4 /*yield*/, _f.call(stream_1)];
                case 10:
                    _l.sent();
                    _l.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 13: return [7 /*endfinally*/];
                case 14:
                    // 哲学家发言完毕
                    res.write("data: ".concat(JSON.stringify({
                        type: "philosopher_done",
                        philosopherId: philosopherId,
                        philosopherName: philosopher.name,
                    }), "\n\n"));
                    fullResponse += "\n\n\u3010".concat(philosopher.emoji, " ").concat(philosopher.name, "\u3011\n").concat(philosopherResponse);
                    console.log("[Philosophy] ".concat(philosopher.name, " \u53D1\u8A00\u5B8C\u6BD5 (").concat(philosopherResponse.length, " \u5B57)"));
                    return [3 /*break*/, 16];
                case 15:
                    err_1 = _l.sent();
                    console.error("[Philosophy] ".concat(philosopher.name, " \u53D1\u8A00\u51FA\u9519:"), err_1);
                    res.write("data: ".concat(JSON.stringify({
                        type: "philosopher_error",
                        philosopherId: philosopherId,
                        error: (err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || "发言出错"
                    }), "\n\n"));
                    return [3 /*break*/, 16];
                case 16:
                    _i++;
                    return [3 /*break*/, 1];
                case 17:
                    // 最后：主持人总结
                    res.write("data: ".concat(JSON.stringify({
                        type: "moderator_summary_start",
                        content: "正在生成哲学综合总结..."
                    }), "\n\n"));
                    _l.label = 18;
                case 18:
                    _l.trys.push([18, 31, , 32]);
                    summaryPrompt = "\u4EE5\u4E0B\u662F\u56DB\u4F4D\u54F2\u5B66\u5BB6\u5BF9\"".concat(question, "\"\u8FD9\u4E00\u95EE\u9898\u7684\u56DE\u7B54\uFF1A\n\n").concat(fullResponse, "\n\n\u8BF7\u4F5C\u4E3A\u4E00\u4F4D\u4E2D\u7ACB\u7684\u54F2\u5B66\u8BA8\u8BBA\u4E3B\u6301\u4EBA\uFF0C\u7528150\u5B57\u5DE6\u53F3\u7EFC\u5408\u8FD9\u56DB\u4F4D\u54F2\u5B66\u5BB6\u7684\u667A\u6167\uFF0C\u6307\u51FA\u5176\u4E2D\u7684\u5171\u9E23\u4E4B\u5904\u4E0E\u5206\u6B67\u6240\u5728\uFF0C\u7ED9\u51FA\u5BF9\u8FD9\u4E2A\u95EE\u9898\u7684\u591A\u7EF4\u5EA6\u54F2\u5B66\u542F\u793A\u3002");
                    summaryResponse = '';
                    summaryStream = query({
                        prompt: summaryPrompt,
                        options: {
                            cwd: process.cwd(),
                            model: model,
                            maxTurns: 3,
                            systemPrompt: MODERATOR_SYSTEM_PROMPT,
                            permissionMode: 'bypassPermissions',
                        }
                    });
                    _l.label = 19;
                case 19:
                    _l.trys.push([19, 24, 25, 30]);
                    _c = true, summaryStream_1 = __asyncValues(summaryStream);
                    _l.label = 20;
                case 20: return [4 /*yield*/, summaryStream_1.next()];
                case 21:
                    if (!(summaryStream_1_1 = _l.sent(), _h = summaryStream_1_1.done, !_h)) return [3 /*break*/, 23];
                    _k = summaryStream_1_1.value;
                    _c = false;
                    msg = _k;
                    if (msg.type === "assistant") {
                        content = msg.message.content;
                        if (typeof content === "string") {
                            summaryResponse += content;
                            res.write("data: ".concat(JSON.stringify({
                                type: "moderator_text",
                                content: content
                            }), "\n\n"));
                        }
                        else if (Array.isArray(content)) {
                            for (_d = 0, content_2 = content; _d < content_2.length; _d++) {
                                block = content_2[_d];
                                if (block.type === "text") {
                                    summaryResponse += block.text;
                                    res.write("data: ".concat(JSON.stringify({
                                        type: "moderator_text",
                                        content: block.text
                                    }), "\n\n"));
                                }
                            }
                        }
                    }
                    _l.label = 22;
                case 22:
                    _c = true;
                    return [3 /*break*/, 20];
                case 23: return [3 /*break*/, 30];
                case 24:
                    e_2_1 = _l.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 30];
                case 25:
                    _l.trys.push([25, , 28, 29]);
                    if (!(!_c && !_h && (_j = summaryStream_1.return))) return [3 /*break*/, 27];
                    return [4 /*yield*/, _j.call(summaryStream_1)];
                case 26:
                    _l.sent();
                    _l.label = 27;
                case 27: return [3 /*break*/, 29];
                case 28:
                    if (e_2) throw e_2.error;
                    return [7 /*endfinally*/];
                case 29: return [7 /*endfinally*/];
                case 30:
                    fullResponse += "\n\n\u3010\u4E3B\u6301\u4EBA\u603B\u7ED3\u3011\n".concat(summaryResponse);
                    return [3 /*break*/, 32];
                case 31:
                    err_2 = _l.sent();
                    console.error("[Philosophy] \u603B\u7ED3\u51FA\u9519:", err_2);
                    return [3 /*break*/, 32];
                case 32:
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
                    res.write("data: ".concat(JSON.stringify({ type: "done" }), "\n\n"));
                    res.end();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * 单哲学家对话模式
 */
function handleSinglePhilosopher(res, question, philosopherId, model, session, assistantMessageId) {
    return __awaiter(this, void 0, void 0, function () {
        var philosopher, fullResponse, stream, _a, stream_2, stream_2_1, msg, content, _i, content_3, block, e_3_1;
        var _b, e_3, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    philosopher = PHILOSOPHERS[philosopherId];
                    if (!philosopher) {
                        res.write("data: ".concat(JSON.stringify({ type: "error", message: "\u672A\u627E\u5230\u54F2\u5B66\u5BB6: ".concat(philosopherId) }), "\n\n"));
                        res.end();
                        return [2 /*return*/];
                    }
                    res.write("data: ".concat(JSON.stringify({
                        type: "philosopher_start",
                        philosopherId: philosopherId,
                        philosopherName: philosopher.name,
                        philosopherEmoji: philosopher.emoji,
                        philosopherColor: philosopher.color,
                    }), "\n\n"));
                    fullResponse = '';
                    stream = query({
                        prompt: question,
                        options: {
                            cwd: process.cwd(),
                            model: model,
                            maxTurns: 5,
                            systemPrompt: philosopher.systemPrompt,
                            permissionMode: 'bypassPermissions',
                        }
                    });
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 6, 7, 12]);
                    _a = true, stream_2 = __asyncValues(stream);
                    _e.label = 2;
                case 2: return [4 /*yield*/, stream_2.next()];
                case 3:
                    if (!(stream_2_1 = _e.sent(), _b = stream_2_1.done, !_b)) return [3 /*break*/, 5];
                    _d = stream_2_1.value;
                    _a = false;
                    msg = _d;
                    if (msg.type === "assistant") {
                        content = msg.message.content;
                        if (typeof content === "string") {
                            fullResponse += content;
                            res.write("data: ".concat(JSON.stringify({
                                type: "philosopher_text",
                                philosopherId: philosopherId,
                                content: content
                            }), "\n\n"));
                        }
                        else if (Array.isArray(content)) {
                            for (_i = 0, content_3 = content; _i < content_3.length; _i++) {
                                block = content_3[_i];
                                if (block.type === "text") {
                                    fullResponse += block.text;
                                    res.write("data: ".concat(JSON.stringify({
                                        type: "philosopher_text",
                                        philosopherId: philosopherId,
                                        content: block.text
                                    }), "\n\n"));
                                }
                            }
                        }
                    }
                    _e.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_3_1 = _e.sent();
                    e_3 = { error: e_3_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _e.trys.push([7, , 10, 11]);
                    if (!(!_a && !_b && (_c = stream_2.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _c.call(stream_2)];
                case 8:
                    _e.sent();
                    _e.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_3) throw e_3.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12:
                    res.write("data: ".concat(JSON.stringify({
                        type: "philosopher_done",
                        philosopherId: philosopherId,
                        philosopherName: philosopher.name,
                    }), "\n\n"));
                    // 保存到数据库
                    db.createMessage({
                        id: assistantMessageId,
                        session_id: session.id,
                        role: 'assistant',
                        content: "\u3010".concat(philosopher.emoji, " ").concat(philosopher.name, "\u3011\n").concat(fullResponse),
                        model: model,
                        created_at: new Date().toISOString(),
                        tool_calls: null
                    });
                    res.write("data: ".concat(JSON.stringify({ type: "done" }), "\n\n"));
                    res.end();
                    return [2 /*return*/];
            }
        });
    });
}
// ============= 普通聊天 API（保持原有功能） =============
app.post("/api/chat", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, sessionId, message, model, systemPrompt, cwd, permissionMode, session, now, selectedModel, sdkSessionId, userMessageId, assistantMessageId, workingDir, canUseTool, stream, fullResponse, toolCalls, newSdkSessionId, currentToolId, _loop_1, _b, stream_3, stream_3_1, e_4_1, messages, error_4, errorMessage;
    var _c, e_4, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _a = req.body, sessionId = _a.sessionId, message = _a.message, model = _a.model, systemPrompt = _a.systemPrompt, cwd = _a.cwd, permissionMode = _a.permissionMode;
                console.log("\n[Chat] ========== \u65B0\u8BF7\u6C42 ==========");
                console.log("[Chat] SessionId: ".concat(sessionId));
                console.log("[Chat] Model: ".concat(model));
                console.log("[Chat] Message: ".concat(message === null || message === void 0 ? void 0 : message.slice(0, 100)).concat((message === null || message === void 0 ? void 0 : message.length) > 100 ? '...' : ''));
                if (!message) {
                    return [2 /*return*/, res.status(400).json({ error: "消息不能为空" })];
                }
                session = sessionId ? db.getSession(sessionId) : null;
                now = new Date().toISOString();
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
                selectedModel = model || session.model;
                sdkSessionId = session.sdk_session_id;
                userMessageId = uuidv4();
                assistantMessageId = uuidv4();
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
                }
                catch (dbError) {
                    return [2 /*return*/, res.status(500).json({ error: "保存消息失败", detail: dbError === null || dbError === void 0 ? void 0 : dbError.message })];
                }
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                workingDir = cwd || process.cwd();
                _f.label = 1;
            case 1:
                _f.trys.push([1, 14, , 15]);
                canUseTool = function (toolName, input, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var requestId, permissionRequest;
                    return __generator(this, function (_a) {
                        if (permissionMode === 'bypassPermissions') {
                            return [2 /*return*/, { behavior: 'allow', updatedInput: input }];
                        }
                        requestId = uuidv4();
                        permissionRequest = {
                            requestId: requestId,
                            toolUseId: options.toolUseID,
                            toolName: toolName,
                            input: input,
                            sessionId: session.id,
                            timestamp: Date.now()
                        };
                        res.write("data: ".concat(JSON.stringify(__assign({ type: "permission_request" }, permissionRequest)), "\n\n"));
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                var pending = {
                                    resolve: resolve,
                                    reject: reject,
                                    toolName: toolName,
                                    input: input,
                                    sessionId: session.id,
                                    timestamp: Date.now()
                                };
                                pendingPermissions.set(requestId, pending);
                                setTimeout(function () {
                                    if (pendingPermissions.has(requestId)) {
                                        pendingPermissions.delete(requestId);
                                        resolve({ behavior: 'deny', message: '权限请求超时' });
                                    }
                                }, PERMISSION_TIMEOUT);
                            })];
                    });
                }); };
                stream = query({
                    prompt: message,
                    options: __assign({ cwd: workingDir, model: selectedModel, maxTurns: 10, systemPrompt: systemPrompt || "你是一个专业的AI助手，善于帮助用户解决各种问题。请用简洁清晰的方式回答问题。", permissionMode: permissionMode || 'default', canUseTool: canUseTool }, (sdkSessionId ? { resume: sdkSessionId } : {}))
                });
                fullResponse = "";
                toolCalls = [];
                newSdkSessionId = null;
                currentToolId = null;
                res.write("data: ".concat(JSON.stringify({
                    type: "init",
                    sessionId: session.id,
                    userMessageId: userMessageId,
                    assistantMessageId: assistantMessageId,
                    model: selectedModel
                }), "\n\n"));
                _f.label = 2;
            case 2:
                _f.trys.push([2, 7, 8, 13]);
                _loop_1 = function () {
                    _e = stream_3_1.value;
                    _b = false;
                    var msg = _e;
                    if (msg.type === "system" && msg.subtype === "init") {
                        newSdkSessionId = msg.session_id;
                        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
                            db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
                        }
                    }
                    else if (msg.type === "assistant") {
                        var content = msg.message.content;
                        if (typeof content === "string") {
                            fullResponse += content;
                            res.write("data: ".concat(JSON.stringify({ type: "text", content: content }), "\n\n"));
                        }
                        else if (Array.isArray(content)) {
                            for (var _i = 0, content_4 = content; _i < content_4.length; _i++) {
                                var block = content_4[_i];
                                if (block.type === "text") {
                                    fullResponse += block.text;
                                    res.write("data: ".concat(JSON.stringify({ type: "text", content: block.text }), "\n\n"));
                                }
                                else if (block.type === "tool_use") {
                                    currentToolId = block.id || uuidv4();
                                    var toolInput = block.input || {};
                                    var toolCall = {
                                        id: currentToolId,
                                        name: block.name,
                                        input: toolInput,
                                        status: "running"
                                    };
                                    toolCalls.push(toolCall);
                                    res.write("data: ".concat(JSON.stringify({
                                        type: "tool",
                                        id: toolCall.id,
                                        name: toolCall.name,
                                        input: toolCall.input,
                                        status: toolCall.status
                                    }), "\n\n"));
                                }
                            }
                        }
                    }
                    else if (msg.type === "tool_result") {
                        var msgAny = msg;
                        var toolId_1 = msgAny.tool_use_id || currentToolId;
                        var isError = msgAny.is_error || false;
                        var content = msgAny.content;
                        var tool = toolCalls.find(function (t) { return t.id === toolId_1; }) || toolCalls[toolCalls.length - 1];
                        if (tool) {
                            tool.status = isError ? "error" : "completed";
                            tool.isError = isError;
                            tool.result = typeof content === 'string' ? content : JSON.stringify(content);
                            res.write("data: ".concat(JSON.stringify({
                                type: "tool_result",
                                toolId: tool.id,
                                content: tool.result,
                                isError: isError
                            }), "\n\n"));
                        }
                        currentToolId = null;
                    }
                    else if (msg.type === "result") {
                        toolCalls.forEach(function (tool) {
                            if (tool.status === "running") {
                                tool.status = "completed";
                                res.write("data: ".concat(JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" }), "\n\n"));
                            }
                        });
                        res.write("data: ".concat(JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost }), "\n\n"));
                    }
                };
                _b = true, stream_3 = __asyncValues(stream);
                _f.label = 3;
            case 3: return [4 /*yield*/, stream_3.next()];
            case 4:
                if (!(stream_3_1 = _f.sent(), _c = stream_3_1.done, !_c)) return [3 /*break*/, 6];
                _loop_1();
                _f.label = 5;
            case 5:
                _b = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_4_1 = _f.sent();
                e_4 = { error: e_4_1 };
                return [3 /*break*/, 13];
            case 8:
                _f.trys.push([8, , 11, 12]);
                if (!(!_b && !_c && (_d = stream_3.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _d.call(stream_3)];
            case 9:
                _f.sent();
                _f.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_4) throw e_4.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13:
                db.createMessage({
                    id: assistantMessageId,
                    session_id: session.id,
                    role: 'assistant',
                    content: fullResponse,
                    model: selectedModel,
                    created_at: new Date().toISOString(),
                    tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
                });
                messages = db.getMessagesBySession(session.id);
                if (messages.length <= 2) {
                    db.updateSession(session.id, {
                        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
                        model: selectedModel
                    });
                }
                res.end();
                return [3 /*break*/, 15];
            case 14:
                error_4 = _f.sent();
                console.error("[Chat] Error:", error_4);
                errorMessage = (error_4 === null || error_4 === void 0 ? void 0 : error_4.message) || "处理请求时发生错误";
                res.write("data: ".concat(JSON.stringify({ type: "error", message: errorMessage }), "\n\n"));
                res.end();
                return [3 /*break*/, 15];
            case 15: return [2 /*return*/];
        }
    });
}); });
// ============= 启动服务器 =============
app.listen(PORT, function () {
    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551                                                        \u2551\n\u2551   \uD83C\uDFDB\uFE0F  \u54F2\u5B66\u5BB6\u591AAgent\u8BA8\u8BBA\u7CFB\u7EDF \u5DF2\u542F\u52A8                      \u2551\n\u2551                                                        \u2551\n\u2551   \u5730\u5740: http://localhost:".concat(PORT, "                         \u2551\n\u2551   \u6570\u636E\u5E93: SQLite (data/chat.db)                        \u2551\n\u2551                                                        \u2551\n\u2551   \u54F2\u5B66\u5BB6: \u4E9A\u91CC\u58EB\u591A\u5FB7 | \u5B54\u5B50 | \u9ED1\u683C\u5C14 | \u5E84\u5B50            \u2551\n\u2551                                                        \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n  "));
});
