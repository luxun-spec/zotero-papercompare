# PaperCompare 0.1.0 验证记录

日期：2026-10-16。本文记录首次本地验收；当前公开版本和下载地址见 README 与 GitHub Releases。

## 实际环境

- Windows，Node.js 24.14.1，npm 11.11.0。
- 本机 Zotero 已由先前检查的 10.0.1 更新为 **10.0.6**；本次集成及安装均以 10.0.6 为准。
- 安装兼容范围 10.0.*；未验证 macOS/Linux Zotero GUI。

## 自动验证

- npm ci：成功，审计未报告已知漏洞（仅反映本次 npm 输出）。
- npm test：**17/17 通过**。
- npm run typecheck：通过。
- npm run build：生成 dist/papercompare-0.1.0.xpi。
- 解包检查：manifest、bootstrap、窗口 XHTML、CSS、编译脚本均存在；生产脚本不含 papercompare-test.js 开发执行入口。

测试涵盖实验行独立性、字段 ID、不可变核心操作、非法备份拒绝、存储失败与恢复、串行保存、CSV 转义与公式保护、Markdown 证据、JSON 往返、来源失效、界面工作流以及加载/停用时清理。

## Zotero 隔离集成

测试数据和配置全部位于 work/ 下。合成论文和测试 PDF 不进入用户文库。

开发构建通过真实 Zotero API 和窗口中的 DOM 事件执行集成流程：

1. 创建对比表，加入两篇合成论文，增加至三组实验。
2. 单元格填写 GPU 配置，并关联两条保存的 PDF 高亮。
3. 点击定位，实际创建并打开对应 Zotero PDF Reader。
4. Markdown、CSV、JSON 导出成功；JSON 导入为新表，不覆盖原表。
5. 重新启动后核实三组实验、单元格值和两条证据保持。
6. 通过 Zotero AddonManager 停用再启用：原窗口关闭、菜单清理，重新启用仅有一个菜单。

关键结果原始记录位于 work/integration-first-pass.json、work/test-data/integration-result.json 和 work/test-profile/lifecycle-done.json，属于不提交的机器运行产物。

另外使用 Windows UI Automation 实际操作过创建表、加入论文，并通过 PrintWindow 检查真实深色界面；截图 docs/assets/preview.png 只包含合成数据。界面布局采用可滚动表格和页面；字段很多时需横向滚动，证据在编辑区下方。

## 独立代码审查

一次独立审查指出四处问题，均用失败回归测试复现并修复：

- 批注加载期间更新的文字可能被旧值覆盖：提交时按 ID 重新读取当前单元格。
- 恢复草稿写入失败阻止停用清理：等待保存队列并在 finally 清理。
- toString 等原型属性名可通过备份校验：拒绝这些 ID。
- 窗口加载期间停用可能访问未初始化控制器：可取消加载，清理时独立判空。

## 日常配置安装

通过用户日常 Zotero 的插件管理器安装生产 XPI，插件记录验证为：

- id: papercompare@local.research
- version: 0.1.0
- active: true
- appDisabled: false

已实际通过“工具 → PaperCompare”打开生产窗口，确认显示空白初始界面与创建入口。没有向日常文库添加测试文献或批注。

## 已知边界

- 本版手工摘录，不含 AI、OCR、全文翻译、云同步。
- JSON 不包含 PDF，也不自动跨机器或文库重新匹配引用。
- 群组文库导出证据不生成 Zotero 深链接。
- 首次本地预览包禁用了后台更新；公开发布包已改用 GitHub Releases 更新清单。安装过本地包的用户需手动安装一次公开包。
- 本次本地验收不包含 GitHub Actions 结果；远程 CI 状态请查看仓库 Actions 页面。
- 本轮没有进行真实研究任务的长期用户验收，也没有宣称 GitHub Star 表现。
