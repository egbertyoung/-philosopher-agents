# 🏛️ 哲学家多Agent讨论系统

> 让亚里士多德、孔子、黑格尔和庄子共同探讨人类智慧的终极问题

一个基于 **CodeBuddy Agent SDK** 构建的多Agent哲学对话系统。四位来自不同文化、不同时代的哲学大师，通过AI模拟，围绕各种哲学命题展开跨越时空的思想交锋。

## ✨ 功能特色

### 四位哲学家 Agent

| 哲学家 | 时代 | 思想体系 | 代表作 |
|--------|------|----------|--------|
| 🏛️ **亚里士多德** | 公元前384–322年 | 逻辑学、德性伦理学、目的论 | 《尼各马可伦理学》《政治学》|
| 📜 **孔子** | 公元前551–479年 | 儒家仁义礼智信、君子之道 | 《论语》|
| ⚡ **黑格尔** | 1770–1831年 | 辩证法、绝对精神、历史哲学 | 《精神现象学》《逻辑学》|
| 🦋 **庄子** | 约公元前369–286年 | 道家自然、逍遥游、齐物论 | 《庄子》|

### 两种讨论模式

- **🎭 群贤共论**：总统筹Agent依次召唤四位哲学家发言，最后给出综合总结
- **💬 独对哲人**：直接与某位哲学家进行深度一对一对话

### 技术特点

- 基于 **SSE（Server-Sent Events）** 的流式实时输出
- 每位哲学家有独立的系统提示词，体现各自的思想体系和语言风格
- 总统筹Agent协调多个子Agent，形成有组织的哲学讨论
- SQLite持久化存储对话历史
- React + TailwindCSS 现代化UI

## 🚀 快速开始

### 前提条件

- Node.js >= 18
- CodeBuddy API Key（从 [codebuddy.cn](https://www.codebuddy.cn) 获取）

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd philosopher-agents

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 CODEBUDDY_API_KEY
```

### 启动

```bash
# 同时启动前端和后端（推荐）
npm run dev

# 或分别启动
npm run dev:server   # 后端服务器 (port 3000)
npm run dev:client   # 前端开发服务器 (port 5173)
```

打开 http://localhost:5173 开始哲学讨论。

## 🏗️ 项目结构

```
philosopher-agents/
├── server/
│   ├── index.ts          # Express + SSE 后端服务器
│   ├── philosophers.ts   # 四位哲学家的 Agent 配置和提示词
│   └── db.ts             # SQLite 数据库操作
├── src/
│   ├── pages/
│   │   └── PhilosophyPage.tsx         # 主讨论页面
│   ├── components/
│   │   ├── PhilosophyDiscussion.tsx   # 讨论界面主组件
│   │   ├── PhilosopherCard.tsx        # 哲学家展示卡片
│   │   └── PhilosopherSpeechBubble.tsx# 哲学家发言气泡
│   ├── hooks/
│   │   └── usePhilosophy.ts           # 讨论逻辑 Hook
│   └── types.ts                        # TypeScript 类型定义
├── .env.example          # 环境变量示例
└── package.json
```

## 🔧 核心API

### 哲学讨论接口

```http
POST /api/philosophy/discuss
Content-Type: application/json

{
  "question": "什么是真正的幸福？",
  "model": "claude-sonnet-4",
  "mode": "moderated",       // "moderated" | "single"
  "philosopherId": "aristotle" // 仅 single 模式需要
}
```

**SSE 事件类型：**

| 事件类型 | 说明 |
|----------|------|
| `init` | 初始化，返回会话ID |
| `philosopher_start` | 某位哲学家开始发言 |
| `philosopher_text` | 哲学家流式文本 |
| `philosopher_done` | 哲学家发言完毕 |
| `moderator_text` | 主持人总结文本 |
| `done` | 全部讨论完成 |

### 哲学家列表

```http
GET /api/philosophers
```

## 🧠 Agent 设计原则

每位哲学家的系统提示词包含：

1. **身份定义**：明确的历史背景和生平信息
2. **核心思想**：该哲学家最重要的哲学概念和体系
3. **语言风格**：独特的表达方式（如孔子的引经据典，庄子的寓言故事）
4. **跨文化对话**：与其他三位哲学家的比较视角

## 💡 示例问题

- 什么是真正的幸福？
- 人性本善还是本恶？
- 死亡是终结还是转化？
- 知识的本质是什么？
- 国家的目的是什么？
- 自由与秩序如何平衡？

## 📄 许可证

MIT License

---

*让古代智慧在现代对话，跨越时空的哲学探索。*
