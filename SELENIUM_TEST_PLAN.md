# SZTUFA Selenium 自动化测试全套计划

## 1. 目标与边界

### 目标

- 用 Selenium 覆盖公开网站与管理后台的关键用户流程。
- 在 Chrome 和 Edge 上执行真实浏览器兼容性验证。
- 测试失败时自动保留截图、页面源码、浏览器日志和错误信息。
- 支持本地一键运行，并逐步接入持续集成（CI）。
- 建立稳定、可维护、可重复执行的端到端回归测试体系。

### 工具分工

- Vitest/Jest：组件、函数和服务层单元测试。
- Supertest/Jest：后端 API 与集成测试。
- Playwright：保留公开站现有用例，不立即迁移或删除。
- Selenium：跨公开站、管理后台和后端的核心业务验收及跨浏览器回归。

Selenium 不负责穷举所有边界条件。输入校验、异常分支和纯 API 逻辑优先放在更快的单元测试或集成测试中。

## 2. 测试环境

### 本地服务

| 服务 | 目录 | 建议地址 | 启动命令 |
| --- | --- | --- | --- |
| 后端 API | `sztufa-server` | `http://localhost:3000` | `npm run start:dev` |
| 公开站 | `sztu-fa-web` | `http://localhost:5173` | `npm run dev` |
| 管理后台 | `sztufa-admin` | `http://localhost:8080` | `npm start` |

实际端口应以项目启动日志为准，并通过测试环境变量覆盖。

### 测试环境变量

在 `test/.env.example` 规划以下变量，不提交真实密码：

```dotenv
WEB_BASE_URL=http://localhost:5173
ADMIN_BASE_URL=http://localhost:8080
API_BASE_URL=http://localhost:3000
E2E_BROWSER=chrome
E2E_HEADLESS=true
E2E_TIMEOUT=10000
E2E_ADMIN_USERNAME=
E2E_ADMIN_PASSWORD=
E2E_COACH_USERNAME=
E2E_COACH_PASSWORD=
```

CI 中的账号和密码必须由密钥管理功能注入，不写入仓库、日志、截图名称或测试报告。

## 3. 目标目录结构

```text
test/
├─ package.json
├─ README.md
├─ SELENIUM_TEST_PLAN.md
├─ .env.example
├─ config/
│  ├─ env.js
│  └─ webdriver.js
├─ fixtures/
│  ├─ users.js
│  └─ test-data.js
├─ pages/
│  ├─ public/
│  └─ admin/
├─ helpers/
│  ├─ api-client.js
│  ├─ artifacts.js
│  ├─ auth.js
│  └─ waits.js
├─ tests/
│  ├─ smoke/
│  ├─ public/
│  ├─ admin/
│  ├─ permissions/
│  └─ selenium/
├─ artifacts/
│  ├─ screenshots/
│  ├─ html/
│  └─ logs/
└─ tools/selenium/
```

### 代码规范

- 使用 Page Object 封装页面定位器和操作。
- 测试文件只描述业务步骤与断言，不堆放大量 CSS 选择器。
- 产品代码优先提供稳定的 `data-testid`；其次使用语义、ID、name。
- 禁止依赖易变的 DOM 层级、动态 class 名或固定 `sleep()`。
- 等待条件使用 `until.elementLocated`、`until.elementIsVisible` 等显式等待。
- 每个用例独立创建和关闭浏览器，不能依赖其他用例的执行顺序。

## 4. 测试分层与执行频率

| 层级 | 内容 | 浏览器 | 执行时机 | 目标耗时 |
| --- | --- | --- | --- | --- |
| Smoke | 启动、首页、登录页、核心接口可用 | Chrome | 每次提交 | 3 分钟内 |
| Critical | 登录、报名、赛程、比分、新闻等核心路径 | Chrome | PR/合并前 | 10 分钟内 |
| Chrome Full | 全分类回归 | Chrome | 每周或发布前 | 20 分钟内 |
| Full regression | 全量业务与权限矩阵 | Chrome + Edge | 发布候选版本 | 30 分钟内 |

## 5. 用例清单与优先级

优先级定义：P0 为系统无法交付时必须阻断；P1 为关键功能；P2 为增强覆盖。

### 5.1 基础 Smoke（第一阶段）

| ID | 优先级 | 用例 | 主要断言 |
| --- | --- | --- | --- |
| SMK-001 | P0 | 公开站首页打开 | 状态正常、标题和核心区域存在 |
| SMK-002 | P0 | 管理后台登录页打开 | 表单字段与登录按钮可见 |
| SMK-003 | P0 | API 健康检查 | 接口返回成功且响应时间可接受 |
| SMK-004 | P0 | 未登录访问后台受保护页面 | 跳转到 `/login` |
| SMK-005 | P1 | 公开站主要导航 | 各入口可点击且无白屏 |

### 5.2 公开站 `sztu-fa-web`

| 模块 | 优先级 | 计划覆盖 |
| --- | --- | --- |
| 首页 `/` | P0 | 主要版块展示、导航、赛程/球队/新闻内容加载 |
| 登录 `/login` | P0 | 成功登录、错误密码、必填校验、会话保持 |
| 注册 `/register` | P1 | 正常注册、重复账号、非法输入、密码规则 |
| 竞猜 `/predictions` | P0 | 查看可竞猜比赛、提交竞猜、截止后不可修改 |
| 我的竞猜 `/my-predictions` | P1 | 登录保护、历史记录、结果与积分展示 |
| 排行榜 `/leaderboard` | P1 | 排名加载、空状态、用户积分一致性 |
| 路由 | P1 | 未知路径重定向、刷新深层页面不白屏 |
| 响应式 | P2 | 1280×900 与常见移动尺寸的核心页面可用性 |

### 5.3 管理后台 `sztufa-admin`

| 模块 | 路由 | 优先级 | 计划覆盖 |
| --- | --- | --- | --- |
| 登录 | `/login` | P0 | 成功/失败登录、退出、过期会话 |
| 教练报名 | `/registration` | P0 | 草稿、提交、修改、状态反馈 |
| 报名审核 | `/registration-review` | P0 | 查看、通过、驳回、权限限制 |
| 球队管理 | `/teams` | P0 | 新增、编辑、删除保护、球员维护 |
| 赛程 | `/schedule` | P0 | 创建/编辑比赛、状态更新、比分录入 |
| 统计 | `/statistics` | P1 | 积分与射手数据展示、筛选、刷新 |
| 新闻 | `/news` | P1 | 创建、编辑、发布、撤回、图片上传 |
| 审计日志 | `/audit-logs` | P1 | 操作记录、筛选、分页、只读性 |
| 系统设置 | `/settings` | P1 | 设置读取、修改、保存反馈 |
| 错误页面 | `/403` `/404` | P1 | 权限不足和未知页面展示正确 |

### 5.4 角色权限矩阵

| 页面/能力 | 超级管理员 | 比赛记录员 | 新闻编辑 | 教练 | 未登录 |
| --- | --- | --- | --- | --- | --- |
| 报名 | 按产品规则 | 禁止 | 禁止 | 允许 | 登录页 |
| 报名审核 | 允许 | 禁止 | 禁止 | 禁止 | 登录页 |
| 球队管理 | 允许 | 允许 | 禁止 | 禁止 | 登录页 |
| 赛程 | 按产品规则 | 按产品规则 | 按产品规则 | 按产品规则 | 登录页 |
| 统计 | 允许 | 允许 | 禁止 | 禁止 | 登录页 |
| 新闻 | 允许 | 允许 | 允许 | 禁止 | 登录页 |
| 审计日志 | 允许 | 禁止 | 禁止 | 禁止 | 登录页 |
| 系统设置 | 允许 | 禁止 | 禁止 | 禁止 | 登录页 |

表中“按产品规则”必须在实施前与当前业务规则确认。每个“禁止”场景同时验证菜单不可见和直接输入 URL 返回 `/403`，避免只做前端隐藏。

## 6. 测试数据策略

- 使用独立测试数据库，禁止直接在生产环境运行写入型 E2E。
- 每次测试运行生成唯一前缀，例如 `e2e-时间戳-随机串`。
- 优先通过 API 准备用户、球队、赛季、比赛和新闻数据，比 UI 创建更快、更稳定。
- UI 仅执行当前用例真正要验证的操作。
- 用例结束后按唯一前缀清理数据；清理失败不能覆盖原测试失败原因。
- 固定账号按角色准备：`super_admin`、`match_scorer`、`news_editor`、`coach`。
- 日期相关数据使用相对时间生成，避免固定赛季和截止日期导致用例自然过期。

## 7. 浏览器与驱动策略

- 日常默认 Chrome 无头模式。
- 发布前执行 Chrome 和 Edge。
- 本地调试使用 `--headed`，必要时增加慢动作或暂停点。
- ChromeDriver 与 Chrome 主版本必须一致；浏览器升级后先执行 Smoke。
- 当前网络对 Selenium Manager 元数据访问不稳定，因此 Chrome 使用项目内驱动。
- 后续增加驱动版本检查脚本：比较浏览器和驱动主版本，不一致时给出明确错误和更新地址。
- `tools/selenium` 中只保留驱动、许可证和第三方声明，不存放浏览器用户数据。

## 8. 失败产物与报告

每个失败用例自动生成：

- `artifacts/screenshots/<用例>-<时间>.png`
- `artifacts/html/<用例>-<时间>.html`
- `artifacts/logs/<套件>_<浏览器>_<时间>.log`（每次运行一个汇总日志）
- `artifacts/reports/<套件>_<浏览器>_<时间>.md`
- `artifacts/reports/LATEST.md`
- 当前 URL、页面标题、浏览器版本、驱动版本和执行耗时

报告要求：

- 每次运行结束自动生成 Markdown 测试结果文档，无论成功或失败。
- 汇总日志集中保存逐用例结果、失败堆栈及浏览器日志，避免每个用例产生独立日志文件。

- 控制台输出用例名称、结果、耗时和失败原因。
- CI 保存失败产物至少 7 天。
- 不在截图和日志中泄露密码、Token、Cookie 或个人隐私信息。
- 用例失败后仍在 `finally` 中执行 `driver.quit()`。

### 8.1 测试分类约束

所有自动化测试必须按业务域存放，禁止直接堆放在 `tests/` 根目录：

| 套件 | 目录 | 范围 |
| :--- | :--- | :--- |
| Smoke | `tests/smoke/` | 三端存活与核心导航 |
| Permissions | `tests/permissions/` | 登录、会话、角色和越权保护 |
| Business | `tests/business/` | 报名、审核、新闻和竞猜闭环 |
| Matches | `tests/matches/` | 比赛创建、状态、阵容、事件和删除 |
| Seasons | `tests/seasons/` | 赛季生命周期与数据隔离 |
| Rules | `tests/rules/` | 小组赛、淘汰赛、点球和排名规则 |
| Data | `tests/data/` | Excel/PDF、备份与恢复 |
| Security | `tests/security/` | 边界、并发、鉴权与故障恢复 |
| Compatibility | `tests/compatibility/` | 多浏览器、响应式、可访问性与性能 |

数据准备工具对应放入 `support/<业务域>/`。会写数据库的套件必须限制为 localhost E2E 环境。

### 8.2 阶段 4完成状态（2026-08-26）

`tests/matches/` 已落地 `MATCH-001`～`MATCH-010`，覆盖比赛创建、状态与场地编辑、首发/替补阵容、进球/黄牌/红牌/换人事件、自动停赛、完赛比分、积分榜与射手统计、竞猜结算、取消比赛与竞猜作废以及删除一致性。

最终复验：Chrome Headless `10/10`（44.69s），Edge Headless `10/10`（46.46s）。

### 8.3 阶段 5 完成状态（2026-08-26）

`tests/seasons/` 已落地 `SEASON-001`～`SEASON-005`，覆盖联赛赛季创建、归档/激活状态、归档往期并创建杯赛、赛季重命名，以及重复名称和非法状态校验。每条用例先快照既有赛季状态，结束时删除仅带 `E2E赛季_` 前缀的测试数据并恢复快照；写操作严格限制 localhost E2E API。

最终复验：Chrome Headless `5/5`（19.56s），Edge Headless `5/5`（20.28s）。下一分类为 `tests/rules/`，计划覆盖小组赛积分、同分排序、淘汰赛、点球及杯赛分组规则。

### 8.4 阶段 6 完成状态（2026-08-26）

`tests/rules/` 已落地 `RULE-001`～`RULE-005`，覆盖常规胜负 3/0 分、普通平局 1/1 分、点球大战 2/0 分、同积分同净胜球时按进球数排序，以及两组前二名按 `A1-B2`、`B1-A2` 生成半决赛。断言同时校验积分缓存 API 的精确数值、淘汰赛球队 ID 和管理端杯赛分组 DOM。

规则夹具使用独立 `E2E规则` 赛季/球队，并在每条用例的 `finally` 中级联清理；首轮测试曾因夹具误用 `completed` 而未进入只接受 `finished` 的统计过滤，现已按真实后端状态修正。最终复验：Chrome + Edge Headless `10/10`（54.38s）。下一分类为 `tests/data/`。

### 8.5 阶段 7 完成状态（2026-08-26）

`tests/data/` 已落地 `DATA-001`～`DATA-005`，覆盖合法历史 JSON 的只读预检与精确实体计数、非法 JSON 结构拒绝、导入摘要不匹配防篡改、PDF 错误扩展名拒绝，以及恢复功能开关和备份删除确认文本保护。每条用例均结合管理端数据灾备/历史导入 DOM 验证。

本套件不会执行正式历史导入、R2 对象删除或数据库覆盖恢复，因此可在本地重复运行；真实备份恢复演练仍需专用隔离数据库和对象存储桶。最终复验：Chrome + Edge Headless `10/10`（48.42s）。下一分类为 `tests/security/`。

### 8.6 阶段 8 完成状态（2026-08-26）

`tests/security/` 已落地 `SEC-001`～`SEC-005`，覆盖未认证 API/页面拦截、新闻记录员读取超管用户数据的角色越权、伪造 JWT、SQL 注入式登录输入，以及超过 5 MB 的图片上传边界。API 状态码与浏览器路由/403/登录页均进行双重验证。

所有错误响应额外扫描密码字段、bcrypt 哈希、SQL、Prisma 内部错误和 JS/TS 堆栈，未发现敏感信息泄露；超大文件在进入对象存储前返回 `413`。最终复验：Chrome + Edge Headless `10/10`（32.19s）。下一分类为 `tests/compatibility/`。

### 8.7 阶段 9 完成状态（2026-08-26）

`tests/compatibility/` 已落地 `COMPAT-001`～`COMPAT-005`，覆盖 1280px 桌面布局、390px 移动设备指标、表单标签/自动填充/键盘焦点、安全响应头，以及 5 秒页面性能预算和严重浏览器控制台错误。全部用例由统一 runner 在 Chrome 与 Edge 参数化执行。

首轮控制台检查发现管理后台 `void` 比赛状态只在显示逻辑中支持、未同步进入 `Match`/`MatchDTO` 类型联合，触发 webpack `TS2367/TS2322` 并产生开发服务器错误遮罩。现已统一状态契约，同时将历史 `completed` 显示为“已结束”；`npm run build` 通过，主入口 106.83 KiB、总 JS 1175.15 KiB，均低于项目预算。最终复验：Chrome + Edge Headless `10/10`（25.02s）。

### 8.8 Chrome 全分类串行验收（2026-08-26）

九个分类共 `52` 条用例已通过 `npm run test:all` 按 Smoke → Permissions → Business → Matches → Seasons → Rules → Data → Security → Compatibility 顺序连续执行。首轮发现旧 Business 用例在 runner 已创建浏览器后又自行创建第二个 WebDriver，长跑中出现资源竞争且失败产物指向未使用的空白页；5 条 Business 用例现已统一使用 runner 注入的单一 driver，并由 runner 集中关闭。

修复后的最终结果为 Chrome Headless `52/52`，总耗时 `282.20s`，无失败、无跨套件数据污染。新增 `test:all:edge` 和 `test:all:browsers`，分别用于 Edge 全套及双浏览器全套回归。

### 8.9 CI 门禁接入（2026-08-26）

按独立第四仓库方案，`test/` 已初始化为 `develop` Git 仓库，并新增 `.github/workflows/selenium-e2e.yml`。根据当前验收决定，CI 不执行 Edge：Push/PR 运行 Chrome Smoke，每周一北京时间约 02:30 和手动 `all` 运行 Chrome 52 条全套。

工作流使用 PostgreSQL 16 Service Container，分别检出三个应用的 `develop` 分支，自动执行依赖安装、Prisma migration、独立 E2E seed、三端生产构建、后台服务启动和健康轮询。测试结束后始终上传单一测试汇总报告、日志、失败截图/HTML 与三端服务日志，保留 7 天。仓库已发布至 `Sad-sheep08/sztufa-selenium-e2e`；首次 Push 触发的 Chrome Smoke 工作流在约 2 分钟内通过。

## 9. npm 命令规划

```json
{
  "scripts": {
    "test": "npm run test:smoke",
    "test:smoke": "node runner.js --suite smoke",
    "test:public": "node runner.js --suite public",
    "test:admin": "node runner.js --suite admin",
    "test:permissions": "node runner.js --suite permissions",
    "test:business": "node runner.js --suite business",
    "test:matches": "node runner.js --suite matches",
    "test:seasons": "node runner.js --suite seasons",
    "test:rules": "node runner.js --suite rules",
    "test:data": "node runner.js --suite data",
    "test:security": "node runner.js --suite security",
    "test:compatibility": "node runner.js --suite compatibility",
    "test:chrome": "node runner.js --browser chrome",
    "test:edge": "node runner.js --browser edge",
    "test:headed": "node runner.js --browser chrome --headed",
    "test:all": "node runner.js --suite all --browser chrome,edge"
  }
}
```

第一阶段可以沿用现有 `selenium:test` 命令，建立统一 runner 后再迁移到上述命名。

## 10. CI 流程

### Pull Request 门禁

1. 安装三个项目及 `test` 的依赖。
2. 执行前后端 lint、typecheck 和单元测试。
3. 启动测试数据库与后端。
4. 启动公开站和管理后台。
5. 轮询健康检查，不能用固定等待代替。
6. 执行 Chrome Smoke 和 P0 用例。
7. 失败时上传截图、HTML 和日志。
8. 无论成功失败都停止服务并清理测试数据。

### 定时与发布门禁

- 每周：Chrome 全分类回归。
- 发布前：完整回归、权限矩阵和生产构建预览环境。
- 连续失败或存在 P0 失败时禁止发布。
- 不稳定用例不得简单重试后忽略；最多重试一次，并建立待修记录。

## 11. 实施阶段

### 阶段 0：基础整理（0.5 天）

- 精简 `test/README.md`，改成独立测试项目说明。
- 增加 `.gitignore`、`.env.example` 和 artifacts 目录规则。
- 增加环境读取、统一 WebDriver 工厂和超时配置。
- 保留当前 fixture 冒烟用例，作为环境自检。

验收：全新终端进入 `test` 后，安装依赖并可一条命令完成 Chrome 自检。

### 阶段 1：真实 Smoke（1 天）

- 增加服务健康检查。
- 覆盖公开站首页、后台登录页和受保护路由。
- 增加失败截图、源码和日志。
- 增加 Chrome/Edge 参数化运行。

验收：本地启动三个服务后，Smoke 全部通过，失败时产物完整。

### 阶段 2：认证与权限（1–2 天）

- 建立登录 Page Object 和角色账号 fixture。
- 覆盖登录、退出、会话失效和直接 URL 越权。
- 完成角色权限矩阵的 P0 路由。

验收：不同角色只能访问允许页面，前端与后端权限表现一致。

### 阶段 3：核心业务（3–5 天）

- 公开站：注册、竞猜、我的竞猜、排行榜。
- 管理后台：报名审核、球队、赛程和比分。
- 通过 API 创建和清理测试数据。

验收：从管理员准备比赛到用户竞猜和查看结果的核心链路可重复执行。

### 阶段 4：内容与运维功能（2–3 天）

- 新闻、统计、审计日志、设置和错误页面。
- 文件上传场景使用安全的小型测试文件。
- 增加空状态、分页、筛选和刷新验证。

验收：P0/P1 用例清单完成，连续运行三次无随机失败。

### 阶段 5：CI 与发布门禁（1–2 天）

- 配置 PR Chrome Smoke、每周 Chrome 全量回归和发布前手动全量回归。
- 上传失败产物并输出测试摘要。
- 记录执行时间和不稳定率。

验收：CI 中能自动启动环境、执行、留存产物并正确阻断失败发布。

## 12. 完成标准

- 所有 P0 用例自动化并稳定通过。
- P1 自动化覆盖率达到 80% 以上。
- Chrome 与 Edge 的核心路径均通过。
- 单次 Smoke 小于 3 分钟，全量回归小于 30 分钟。
- 连续 10 次运行的不稳定失败率低于 2%。
- 每个失败都有截图、URL、日志和可定位错误。
- 所有写入型用例使用测试数据库并能清理数据。
- README 包含安装、启动、运行、调试和常见故障说明。

## 13. 推荐的下一步

立即实施阶段 0 和阶段 1。第一个真实用例应验证：启动后端和公开站，打开首页，等待核心标题或导航出现，并在失败时保存截图。完成这一条后，再实现后台登录与权限 Page Object，避免一开始同时铺开全部业务模块。
