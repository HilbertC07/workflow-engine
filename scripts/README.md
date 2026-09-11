# 验证脚本

真实环境验证脚本，分两类：**纯 API 脚本**（只需后端）与 **CDP 浏览器脚本**（需前后端 + Chrome）。

这些脚本不是单元测试的替代品——单元测试跑 H2 内存库，这些脚本打的是**真实 MySQL + 真实浏览器**，
用于验证"跑起来到底行不行"。

---

## 一、前置条件

| 脚本类型 | 需要运行的服务 |
|---|---|
| 纯 API（`e2e-test.js` / `m2-e2e.js` / `m3/m3-api-chain.js`） | 后端 8080 |
| CDP 浏览器（`cdp-full-test.js` / `m3/cdp-*.js`） | 后端 8080 **且** 前端 5173 **且** 本机装了 Chrome |

启动服务：

```bash
# 窗口1
cd workflow-engine && ./mvnw spring-boot:run

# 窗口2
cd workflow-engine/workflow-ui && npm run dev
```

---

## 二、环境变量（都可选，不设则用默认值）

| 变量 | 默认值 | 用途 |
|---|---|---|
| `WF_API_URL` | `http://localhost:8080` | 后端地址 |
| `WF_UI_URL` | `http://localhost:5173` | 前端地址 |
| `WF_DESIGNER_URL` | `http://localhost:5173/designer` | 设计器地址 |
| `CHROME_PATH` | `C:\Program Files\Google\Chrome\Application\chrome.exe` | Chrome 可执行文件 |

Chrome 装在别处时：

```bash
CHROME_PATH="/usr/bin/google-chrome" node scripts/cdp-full-test.js
```

> 脚本产出的临时 Chrome 用户目录放在系统临时目录下，与用户名无关，不会污染项目。

---

## 三、脚本清单

### 根目录

| 脚本 | 作用 | 依赖 |
|---|---|---|
| `m2-e2e.js` | **设计器 ↔ 引擎咬合验证**：用前端 mapper 的确切输出格式保存流程 → 发起实例 → 会签两人各拿待办 → 依次同意 → 穿透抄送到结束，并核对时间线 | 后端 |
| `e2e-test.js` | **M1 引擎回归**：场景 A 单人请假闭环 / 场景 B 已同意后撤回被拒 / 场景 C 无人处理时撤回成功 | 后端 |
| `cdp-full-test.js` | **M2 设计器完整闭环**（真实浏览器）：拖 4 节点 → 连 3 线 → 保存 → 刷新 → 加载 → 校验节点数 / 坐标 / 连线是否还原 | 前后端 + Chrome |
| `mvn-run.js` | Maven 后台运行封装 | — |

### `m3/` 目录

| 脚本 | 作用 | 依赖 |
|---|---|---|
| `m3-api-chain.js` | **后端完整链路**：发起 → 校验 `canWithdraw=true` → 待办可见 → 撤回成功 → 重起一单 → 审批后校 `canWithdraw=false`；含 `status` 过滤与非法值静默忽略 | 后端 |
| `cdp-m3-e2e.js` | **浏览器端全链路**：1001 发起 → 我的申请排最前且可撤回 → 切 1002 待办出现 → 点同意 → 待办消失 → 已办含该单 → 回流我的申请状态变「已通过」且撤回变灰 | 前后端 + Chrome |
| `cdp-m3-test.js` | 路由与布局探测：`/` 是否跳 `/apply`、乱路径是否 404、四个导航入口、`/designer` 是否不套公共布局 | 前后端 + Chrome |
| `cdp-m3-interaction.js` | 交互探测：切用户后待办 / 我的申请数据联动、撤回按钮 disabled 态 | 前后端 + Chrome |

`m3/*.txt` 是上述脚本在 2026-09-10 的实测输出存档，可作为"预期结果"的参照。

---

## 四、运行

```bash
cd workflow-engine

# 后端链路
node scripts/m3/m3-api-chain.js

# 设计器回归（M2）—— 改动设计器或路由后必跑
node scripts/cdp-full-test.js

# M3 浏览器全链路
node scripts/m3/cdp-m3-e2e.js
```

---

## 五、注意事项

1. **脚本会写真实数据**（新建流程定义、发起实例、审批）。
   在本地开发库上跑没问题，**不要指向生产库**。
2. 脚本查库/发起的标题里带时间戳后缀，便于区分每次运行。
3. CDP 脚本采用**真实鼠标事件**（`Input.dispatchMouseEvent`），而非页面内合成事件——
   这是刻意的：合成事件会绕过真实的拖拽链路，验证不到 M2 那个"锚点被卸载重建"的坑。
4. `cdp-m3-*.js` 与 `cdp-full-test.js` 使用不同的调试端口（9224/9226/9227/9223），
   理论上可并行，但为稳妥建议串行执行。
