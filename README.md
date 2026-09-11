# 审批流引擎 workflow-engine

自研审批流引擎（**不依赖 Flowable / Camunda / Activiti**），含可视化流程设计器与发起/审批前端。

当前进度：**M1 引擎内核 · M2 可视化设计器 · M3 发起/审批/我的申请 —— 均已完成并验收通过。**

| 阶段 | 内容 | 状态 |
|---|---|---|
| M1 | 工程骨架 + 5 张表 + 引擎内核 + REST API + 单元测试 | ✅ |
| M2 | 可视化流程设计器（LogicFlow） | ✅ |
| M3 | 发起申请页 + 待办审批页 + 我的申请页 | ✅ |
| M4 | 条件分支 / 加签 / 超时 / 版本管理 | 待定 |

各阶段的提示词、方案评审、交付验收报告见 [`docs/prompts/`](docs/prompts/)。

---

## 一、技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 后端 | Java + Spring Boot | 17 / 3.3.5 |
| 持久层 | MyBatis-Plus | 3.5.9 |
| 数据库 | MySQL | 8.x |
| 构建 | Maven | 3.9.x（可用自带的 mvnw，免安装） |
| 前端 | Vue 3 + Vite + TypeScript | 3.5 / 6 / 5.6 |
| UI | Element Plus | 2.8 |
| 流程图 | LogicFlow + extension | 2.x |
| 路由/状态 | vue-router / pinia | 4.4 / 2.2 |

---

## 二、环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| **JDK** | **17**（必须） | Spring Boot 3 最低要求 17。建议 Temurin 17 |
| MySQL | 8.0+ | 本机开发用的是 8.4 |
| Node.js | **18+** | 本机开发用的是 22.22 |
| Maven | 3.9+ | **可不装**，用项目自带 `mvnw`（首次自动下载） |

下载地址：
- JDK 17：<https://adoptium.net/temurin/releases/?version=17>
- MySQL 8：<https://dev.mysql.com/downloads/mysql/>
- Node.js：<https://nodejs.org/>（选 LTS）

> Windows 用户注意：配置 `JAVA_HOME` 时指向 JDK 根目录，**不要带 `\bin`**。

---

## 三、快速开始（从零到跑通）

### 步骤 1 · 建库

`schema.sql` 只建表，**不会自动建库**，必须先手动创建数据库：

```bash
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS workflow DEFAULT CHARSET utf8mb4;"
```

表结构由 `src/main/resources/db/schema.sql` 在应用启动时自动执行（`CREATE TABLE IF NOT EXISTS`，可反复执行）。

### 步骤 2 · 启动后端（窗口 1）

```bash
cd workflow-engine
./mvnw spring-boot:run
```

Windows：

```powershell
cd workflow-engine
.\mvnw.cmd spring-boot:run
```

> 若不想用 `mvnw`（首次会下载 Maven，需要网络），也可用已安装的全局 Maven：
> `mvn -B spring-boot:run`

启动成功后监听 **8080**。验证：

```bash
curl http://localhost:8080/api/workflow/users
```

期望返回 5 个测试用户。

### 步骤 3 · 启动前端（窗口 2）

```bash
cd workflow-engine/workflow-ui
npm install
npm run dev
```

打开 <http://localhost:5173> —— `/` 会自动跳转到「发起申请」页。

### 步骤 4 · 走一遍主流程

1. 右上角选「张三（1001）」→ 在「发起申请」选一个流程 → 填标题 → **提交申请**
2. 右上角切「李四（1002）」→「待办审批」→ 点「同意」
3. 切回「张三（1001）」→「我的申请」→ 状态变「已通过」
4. 进「流程设计器」→ 拖节点、连线、保存 → 刷新后加载，坐标应完全还原

---

## 四、换机器 / 多环境配置

**本机开发只需设置数据库密码**，其余配置已内置默认值。换机器或后端不在本机时，改环境变量即可，**不需要动代码**。

### 后端

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `WF_DB_URL` | `jdbc:mysql://localhost:3306/workflow?...` | 数据库连接串 |
| `WF_DB_USER` | `root` | 数据库账号 |
| `WF_DB_PASSWORD` | `123456` | 数据库密码 |
| `WF_SERVER_PORT` | `8080` | 后端监听端口 |
| `WF_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,...` | 前端地址白名单，逗号分隔 |

> 改 `WF_SERVER_PORT` 时，前端的 `VITE_API_BASE_URL` 与后端 `WF_CORS_ORIGINS` 要一起改。三者是联动的。

设置方式：

```bash
# Linux / macOS / Git Bash
export WF_DB_PASSWORD=你的密码
./mvnw spring-boot:run
```

```powershell
# Windows PowerShell
$env:WF_DB_PASSWORD = "你的密码"
.\mvnw.cmd spring-boot:run
```

设置一次、永久生效（Windows 用户级环境变量，重开终端后有效）：

```powershell
setx WF_DB_PASSWORD "你的密码"
```

### 前端

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080` | 后端地址 |

在 `workflow-ui/` 下复制 `.env.example` 为 `.env.local` 并修改（`.env.local` 已被 gitignore，不会误提交）：

```bash
cd workflow-ui
cp .env.example .env.local
# 编辑 .env.local，把 VITE_API_BASE_URL 改成实际后端地址
```

> 前端换端口时，记得把新地址加进后端的 `WF_CORS_ORIGINS`，否则浏览器会拦跨域请求。

---

## 五、目录结构

```
workflow-engine/
├── src/main/java/com/jiatai/workflow/
│   ├── common/          统一返回体 R、异常与全局异常处理器
│   ├── config/          跨域配置
│   ├── controller/      REST 入口（definition / instance / task / user）
│   ├── domain/
│   │   ├── entity/      5 张表的实体
│   │   ├── enums/       状态与类型枚举
│   │   └── model/       流程图模型（FlowGraph / FlowNode / FlowEdge / NodeProps）
│   ├── dto/             出入参对象
│   ├── engine/          引擎内核：ProcessEngine 调度 + GraphParser 解析
│   └── mapper/          MyBatis-Plus Mapper
├── src/main/resources/
│   ├── application.yml  主配置（支持环境变量覆盖）
│   └── db/schema.sql    MySQL 建表 DDL（启动自动执行）
├── src/test/java/       单元测试（继承 BaseEngineTest 以隔离数据）
├── workflow-ui/         前端工程（独立 Vite 项目）
│   └── src/
│       ├── api/         axios 封装与接口定义
│       ├── components/  共用组件（审批时间线）
│       ├── layout/      顶部导航 + 用户切换
│       ├── logicflow/   设计器节点与图数据映射
│       ├── router/      路由表
│       ├── stores/      pinia（当前用户）
│       ├── types/       TS 类型
│       └── views/       apply / todo / my / designer 四个页面
├── docs/
│   ├── prompts/         各阶段提示词、方案评审、交付验收报告
│   └── README.md        文档索引
├── scripts/             验证脚本（见 scripts/README.md）
├── .cursor/rules/       AI 协作规则（领域语义与编码约定）
└── request.http         REST Client 请求样例，可直接在 IDE 里点着调接口
```

---

## 六、业务口径速查

### 状态机

- **实例**：`RUNNING → APPROVED / REJECTED / CANCELLED`（终态不可变）
- **任务**：`PENDING → APPROVED / REJECTED / CANCELLED / TRANSFERRED`

### 关键规则

| 规则 | 说明 |
|---|---|
| 会签 `ALL` | 全部同意才推进；任一驳回即触发驳回策略 |
| 或签 `ANY` | 任一同意即推进，其余任务置 `CANCELLED` |
| 节点类型 | `START / APPROVAL / CC / END`；抄送节点不阻塞，自动完成并流转 |
| 驳回策略 | `TO_INITIATOR`（回到第一审批节点）/ `TERMINATE`；`TO_PREVIOUS_NODE` 仅保留枚举 |
| 撤回条件 | 实例 `RUNNING` 且**不存在任何已处理的审批任务**（含会签中有人已处理的情况） |

### 测试用户（Mock，无需登录）

`IdentityService` 走的是 Mock 实现，通过接口传 `operatorId` / `initiatorId` 即可。

| ID | 姓名 | 角色 |
|---|---|---|
| 1001 | 张三 | 员工 |
| 1002 | 李四 | 部门主管 |
| 1003 | 王五 | 人事 |
| 1004 | 赵六 | 总经理 |
| 1005 | 钱七 | 员工 |

前端右上角下拉可切换当前用户，无需任何鉴权。

### 数据表

| 表 | 说明 | 注意 |
|---|---|---|
| `wf_process_definition` | 流程定义 | `graph_json` 是流程图唯一真相；`wf_node_definition` 是其冗余扁平化，保存时同事务写入 |
| `wf_process_instance` | 流程实例 | 有 `create_time` + `update_time` |
| `wf_task` | 待办任务 | **只有 `create_time` + `finish_time`，没有 `update_time`** |
| `wf_task_record` | 流转记录 | 无 `update_time`，时间线按 `create_time` 排序 |

> ⚠️ 只有 `wf_process_definition` 有 `deleted` 列。全局配了 `logic-delete-field: deleted`，
> 而 `@Select` 原生 SQL **不走** `@TableLogic`，写原生 SQL 时必须显式加 `deleted = 0`。

---

## 七、测试与验证

### 单元测试

```bash
./mvnw -B test
```

当前 **8 个用例全绿**（引擎 4 + M3 查询接口 4）。

> 新增引擎类测试请**继承 `BaseEngineTest`**：它在 `@BeforeEach` 清空 5 张表。
> 因为 `jdbc:h2:mem:test` 是单例内存库、`sql.init` 只建表不清数据，
> 不继承会导致多个测试类互相污染。

### 验证脚本

`scripts/` 下有一组真实环境验证脚本（后端 API 链路 + 真实浏览器 CDP 交互），
用法与前置条件见 [`scripts/README.md`](scripts/README.md)。

---

## 八、常见故障

| 现象 | 原因与处理 |
|---|---|
| 接口返回 `{"code":500,"msg":"系统繁忙"}` | ①**后端改了代码没重启**（不会热加载）②请求路径写错，前缀是 `/api/workflow/...` |
| 后端启动报 `Unknown database 'workflow'` | 没建库，见「快速开始 步骤 1」 |
| 后端启动报 `Access denied for user` | 数据库账号密码不对，设 `WF_DB_USER` / `WF_DB_PASSWORD` |
| 后端启动报 `Port 8080 was already in use` | 端口被占，设 `WF_SERVER_PORT` 换端口（**同步改**前端 `VITE_API_BASE_URL` 与后端 `WF_CORS_ORIGINS`） |
| 前端页面空白、下拉框没数据 | 后端没起，或 `VITE_API_BASE_URL` 指错 |
| 浏览器控制台报 CORS 错误 | 前端端口不在后端白名单里，改 `WF_CORS_ORIGINS` |
| `npm run build` 报 `TS2307: Cannot find module 'xxx'` | 依赖写进了 `package.json` 但没装，跑 `npm install` |
| 设计器拖节点连不出线 | 关键坑，见 `docs/prompts/08-M2交付验收报告.md` 与 `.cursor/rules/frontend-vue.mdc` |
| 测试报 `expected:<1> but was:<5..8>` | 测试类没继承 `BaseEngineTest`，数据被前一个类污染 |

---

## 九、开发约定

- 包名 `com.jiatai.workflow`，表前缀 `wf_`
- 统一返回体 `R<T>`：`code=0` 表示成功，非 0 时前端拦截器自动弹错误提示
- 时间字段由 `TimeMetaObjectHandler` 自动填充，DDL 不写 `ON UPDATE`
- **不引入**任何现成工作流引擎，核心调度自研
- M2 设计器（`views/designer/`、`logicflow/`）经完整闭环验证，改动前请先跑 `scripts/cdp-full-test.js` 回归
- AI 协作的领域语义与编码约定固化在 [`.cursor/rules/`](.cursor/rules/)，改动领域规则时请同步更新

---

## 十、把项目迁到另一台机器

**方式 A：Git（推荐）**

```bash
# 原机器
git add -A && git commit -m "..." 
git remote add origin git@github.com:HilbertC07/workflow-engine.git
git push -u origin master

# 新机器
git clone git@github.com:HilbertC07/workflow-engine.git
cd workflow-engine
# 然后按「三、快速开始」走
```

> **仓库是公开的**（https://github.com/HilbertC07/workflow-engine），任何人可直接克隆，无需账号与认证：
>
> ```bash
> git clone https://github.com/HilbertC07/workflow-engine.git
> ```
>
> 注意：**本机（作者机器）实测 github.com 的 HTTPS（443）连不通**（`git clone https://...` 会卡住后超时），
> 所以这台机器推拉统一用 **SSH** 地址 `git@github.com:HilbertC07/workflow-engine.git`，需先配 SSH key：
>
> ```bash
> ssh-keygen -t ed25519 -C "your-machine"
> cat ~/.ssh/id_ed25519.pub
> ```
>
> 把输出的整行内容粘贴到 https://github.com/settings/keys → `New SSH key`（Key type 选 **Authentication Key**）。
> 推送需要认证、拉取公开仓库不需要，两者互不影响。
>
> 若某台机器 22 端口也被封，可在 `~/.ssh/config` 切到 443 通道：
>
> ```
> Host github.com
>   HostName ssh.github.com
>   Port 443
>   User git
> ```

**方式 B：离线拷贝**

直接复制整个 `workflow-engine` 目录，但**务必排除**以下体积大且可重建的目录：

- `target/`（Maven 构建产物）
- `workflow-ui/node_modules/`（前端依赖）
- `workflow-ui/dist/`（前端构建产物）
- `.git/`（若不需要版本历史）

到新机器后执行 `npm install`（前端）即可，后端依赖由 Maven 自动下载。

> 注意：`node_modules` 与 `target` 里可能含有**平台相关的二进制**（如 esbuild、rollup 的原生模块），
> 跨操作系统直接拷贝大概率跑不起来，必须在新机器重新安装/构建。
