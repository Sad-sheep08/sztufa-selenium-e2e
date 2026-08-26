# SZTUFA Selenium 自动化测试体系

本目录为 **深圳技术大学足球协会 (SZTUFA)** 系统全套 E2E 自动化测试环境，基于 `selenium-webdriver`，支持对公开站 (`sztu-fa-web`)、管理后台 (`sztufa-admin`) 和后端 API (`sztufa-server`) 进行端到端回归验证。

## 1. 目录结构

```text
test/
├─ package.json            # npm 脚本定义
├─ README.md              # 本说明文件
├─ SELENIUM_TEST_PLAN.md  # 自动化测试整体规划与用例清单
├─ runner.js              # CLI 测试运行器
├─ .env.example           # 测试环境变量配置模板
├─ config/
│  ├─ env.js              # 环境变量与配置加载器 (兼容 Node 20+ process.loadEnvFile)
│  └─ webdriver.js        # 统一 WebDriver 工厂类 (Chrome / Edge)
├─ helpers/
│  ├─ api-client.js       # 后端 API 健康检查与 Fetch 封装
│  ├─ artifacts.js        # 测试失败产物收集器 (截图, HTML, Logs)
│  └─ waits.js            # 显式等待封装
├─ pages/
│  ├─ public/
│  │  └─ home.page.js     # 公开站 Page Object
│  └─ admin/
│     └─ login.page.js    # 管理后台 Page Object
├─ support/
│  └─ matches/            # 比赛套件的确定性数据准备工具
├─ tests/
│  ├─ smoke/              # 冒烟测试
│  ├─ permissions/        # 认证、会话与角色权限
│  ├─ business/           # 报名、审核、新闻与竞猜闭环
│  ├─ matches/            # 比赛全生命周期
│  ├─ seasons/            # 赛季创建、状态、归档、重命名与校验
│  ├─ rules/              # 积分、点球、排序和淘汰赛规则
│  ├─ data/               # JSON/PDF 预检与备份安全保护
│  ├─ security/           # 鉴权、越权、Token、注入与上传边界
│  └─ compatibility/      # 跨浏览器、响应式、可访问性与性能
├─ artifacts/             # 运行产物 (自动生成，已 gitignore)
│  ├─ logs/               # 每次执行一个汇总日志
│  ├─ reports/            # 时间戳 Markdown 报告与 LATEST.md
│  ├─ screenshots/        # 失败用例截图
│  └─ html/               # 失败用例 DOM 源码
└─ tools/selenium/        # Chrome 驱动及声明文件
```

## 2. 环境配置

在运行测试前，可在 `test` 目录下复制 `.env.example` 并重命名为 `.env`：

```dotenv
WEB_BASE_URL=http://localhost:5173
ADMIN_BASE_URL=http://localhost:8080
API_BASE_URL=http://localhost:3000
E2E_BROWSER=chrome
E2E_HEADLESS=true
E2E_TIMEOUT=10000
```

Node 20/22/26 会自动解析 `.env` 文件，无需额外安装第三方依赖。

## 3. 快捷运行指令

在 `test` 目录下执行以下 npm 命令：

```bash
# 执行基础 Smoke 冒烟测试套件（Chrome 无头模式）
npm test
# 或
npm run test:smoke

# 运行有界面 (Headed) 模式，方便调试
npm run test:headed

# 指定使用 Edge 浏览器运行
npm run test:edge

# 运行所有套件
npm run test:all

# Edge 全套 / Chrome+Edge 全套
npm run test:all:edge
npm run test:all:browsers

# 比赛全生命周期套件
npm run test:matches

# 赛季生命周期套件
npm run test:seasons

# 赛事规则套件
npm run test:rules

# 数据导入与灾备安全套件
npm run test:data

# 安全边界套件
npm run test:security

# 浏览器兼容性与基础质量套件
npm run test:compatibility

# 直接使用 runner.js 自定义参数
node runner.js --suite smoke --browser chrome,edge --headed
```

## 4. 失败产物收集

每次运行结束后，无论成功或失败，系统都会自动生成：

- `artifacts/logs/<套件>_<浏览器>_<时间戳>.log`：本次运行的单一汇总日志，集中记录用例结果、失败堆栈、URL、页面标题和浏览器 Console。
- `artifacts/reports/<套件>_<浏览器>_<时间戳>.md`：本次测试结果文档，包含汇总、逐用例结果和失败产物链接。
- `artifacts/reports/LATEST.md`：最近一次测试结果，方便固定路径查看或由 CI 收集。

只有用例失败时才额外生成：

- `artifacts/screenshots/<用例ID>_<浏览器>-<时间戳>.png`：失败截图。
- `artifacts/html/<用例ID>_<浏览器>-<时间戳>.html`：失败时的完整 DOM 页面源码。

日志按“每次运行一个文件”聚合，不再为每个失败用例创建零散 `.log` 文件。

## 5. 扩充测试用例规范

1. **Page Object 模式**：所有页面 DOM 定位与交互动作必须封装在 `pages/` 中，基于真实 DOM Selector，不得在用例逻辑中堆砌 CSS 选择器。
2. **显式等待**：必须使用 `helpers/waits.js` 中的显式等待（如 `waitForVisible`, `waitForElement`），禁止硬编码 `sleep()`。
3. **用例独立性**：每个测试用例应保持独立，并在 `finally` 块中始终关闭 `driver` 资源。

## 6. GitHub Actions CI

测试目录是独立 Git 仓库，工作流位于 `.github/workflows/selenium-e2e.yml`，仅运行 Chrome：

- `main` / `develop` 的 Push 和 Pull Request：执行 Chrome Smoke。
- 每周一北京时间约 02:30：执行 Chrome 全套 52 条回归。
- `workflow_dispatch`：可手动选择 `smoke` 或 `all`。
- CI 使用 PostgreSQL 16 临时数据库，检出三个应用的 `develop` 分支，自动安装、迁移、准备账号、构建并启动三端。
- 无论成功失败，统一上传 Markdown 报告、汇总日志、失败截图/HTML 和三端服务日志，保留 7 天。

首次发布此测试仓库时，需要在 GitHub 创建空仓库并配置远端：

```bash
git remote add origin <测试仓库地址>
git add .
git commit -m "ci: add Chrome Selenium E2E pipeline"
git push -u origin develop
```

三个应用仓库当前按公开仓库 `Vw1n/sztufa-server`、`Vw1n/sztu-fa-web`、`Vw1n/sztufa-admin` 检出；如改为私有仓库，需要给 Actions 配置可读取这些仓库的 Token。
