# PaperCompare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method awaits user selection; recommend native execution in this chat. Do not dispatch agents without the selected method authorizing delegation.

**Goal:** 交付可安装的免费 Zotero 插件，支持多论文、多实验行、人工证据关联和可恢复的数据导出。

**Architecture:** 纯 TypeScript 数据模型与导出模块独立于 Zotero。Zotero 适配器提供批注、附件定位和文件存储，独立 XHTML 窗口提供操作界面。使用 esbuild 输出 IIFE，bootstrap.js 管理生命周期；构建脚本将静态资源及编译结果打包为 XPI。

**Tech Stack:** Node.js 24、TypeScript、esbuild、fflate、Node test runner；Zotero 10.0.1。开发依赖锁定到安装时核验的版本并提交 package-lock.json。使用官方接口文档与自主实现，不复制第三方模板。

**Spec:** docs/superpowers/specs/2026-10-16-papercompare-design.md

## Global Constraints

- 免费、离线使用；第一版不需要 API 密钥。
- 初期以 Windows 上的 Zotero 10.0.1 为实际验证环境。
- 不直接写 Zotero SQLite 数据库，不改写论文元数据或原生批注。
- 先成功保存再显示成功状态；读取失败禁止静默以空文件覆盖。
- 每行对应一篇论文的一组实验；一个单元格支持多条证据。
- 界面支持简体中文和英文；默认跟随 Zotero 语言。
- 测试先使用隔离配置与数据目录，不在真实文库中创建或删除测试条目。
- GitHub 远程发布等待本地验证完成；不包含个人 PDF 或文库数据。

## Review Focus

1. 中文和空格路径：打包、插件安装和附件定位正常；任务 5 实机检查。
2. 读到损坏文件或写入失败：拒绝覆盖、可恢复备份、不误报成功；任务 2 自动测试。
3. 多组实验和同名字段：按稳定 ID 关联，删除需确认，不跨行串值；任务 1 自动测试。
4. 原附件或批注失效：快照仍保留，定位失败有可理解提示；任务 3 适配器测试。
5. 导出内容含公式、管道、引号和换行：CSV 防公式执行，Markdown 可读，JSON 完整恢复；任务 4 自动测试。

## File Structure

- package.json, package-lock.json, tsconfig.json: 构建、检查和测试命令。
- scripts/build.mjs: esbuild 与 fflate XPI 打包。
- addon/manifest.json, addon/bootstrap.js: 元数据和生命周期。
- addon/content/compare.xhtml, addon/content/compare.css: 原生 HTML 界面壳和主题。
- src/core/model.ts: 类型、字段模板和不可变数据操作。
- src/core/validate.ts: JSON 备份结构与版本验证。
- src/core/storage.ts: 串行保存、原子写入协议和恢复。
- src/core/export.ts: Markdown、CSV 与 JSON 转换。
- src/zotero/adapter.ts: 文献、批注、定位与存储适配。
- src/zotero/plugin.ts: 窗口与菜单注册清理。
- src/ui/controller.ts, src/ui/i18n.ts: 操作控制、渲染与文案。
- tests/model.test.ts, tests/storage.test.ts, tests/export.test.ts, tests/adapter.test.ts: 行为测试。
- tests/fixtures/demo.json: 仅合成数据。
- scripts/launch-test.ps1, scripts/seed-test.js: 隔离测试启动和合成条目准备。
- README.md, README.zh-CN.md, LICENSE, .gitignore, .github/workflows/ci.yml: 开源交付。

## Shared Interfaces

```ts
export interface PaperRef { libraryID: number; itemKey: string; title: string; }
export interface Evidence {
 id: string; attachmentKey: string; annotationKey: string;
 quote: string; pageLabel: string; position: string;
}
export interface Field { id: string; name: string; }
export interface Cell { value: string; evidence: Evidence[]; }
export interface ExperimentRow {
 id: string; paper: PaperRef; name: string; cells: Record<string, Cell>;
}
export interface Comparison {
 id: string; name: string; fields: Field[]; rows: ExperimentRow[];
 createdAt: string; updatedAt: string;
}
export interface State { schemaVersion: 1; comparisons: Comparison[]; }
export interface FilePort {
 read(path: string): Promise<string>;
 exists(path: string): Promise<boolean>;
 writeAtomic(path: string, text: string): Promise<void>;
}
export interface LibraryPort {
 selectedPapers(): Promise<PaperRef[]>;
 annotations(paper: PaperRef): Promise<Evidence[]>;
 locate(paper: PaperRef, evidence: Evidence): Promise<void>;
}
```

IDs 使用 crypto.randomUUID；Zotero 运行时若不可用则由适配层注入 UUID 生成器。页面正文用 textContent 或创建 DOM 节点显示用户内容，禁止把证据原文直接作为 HTML 注入。

### Task 1: 可测试的数据模型与构建

**Files:** package.json, tsconfig.json, scripts/build.mjs, src/core/model.ts, src/core/validate.ts, tests/model.test.ts。
**Produces:** createComparison(name, template), addRow(comparison, paper, name), setCell(comparison, rowID, fieldID, cell), validateState(input)。各函数返回新对象；传入不存在的 ID 抛出可识别错误。

- [ ] 写测试，验证同一论文的两组实验互不覆盖，以及同名字段使用不同 ID：
```ts
const a = createComparison('Inference', 'ai-infra');
const b = addRow(addRow(a, paper, 'short'), paper, 'long');
const c = setCell(b, b.rows[0].id, b.fields[0].id,
 { value: 'OPT-13B', evidence: [] });
assert.equal(c.rows[1].cells[b.fields[0].id]?.value ?? '', '');
assert.equal(a.rows.length, 0);
assert.throws(() => validateState({schemaVersion: 99, comparisons: []}));
```
- [ ] 先运行该测试确认缺失实现导致失败，再实现共享类型、模板、增删改与 JSON 验证；校验 ID 唯一、引用字段存在、数据类型正确。
- [ ] 定义 npm scripts：test 使用 Node --experimental-strip-types --test tests/*.test.ts，typecheck 使用 tsc --noEmit，build 使用 node scripts/build.mjs。
- [ ] 安装并锁定开发依赖，跑 npm test 和 npm run typecheck；提交通过的模型和构建基础。

### Task 2: 可靠存储与恢复

**Files:** src/core/storage.ts, tests/storage.test.ts。
**Consumes:** State, FilePort, validateState。
**Produces:** Store.load(): Promise<State>, Store.save(state): Promise<void>, Store.restoreBackup(): Promise<State>。队列执行失败后仍可接收后续保存；尚未保存的 UI 草稿不冒充已持久化。

- [ ] 内存 FilePort 测试：主文件损坏但备份有效时 load 报错并提供显式恢复；写入失败后主文件字节不变。
```ts
const original = JSON.stringify(validState);
files.set('papercompare.json', original);
port.failWrites = true;
await assert.rejects(store.save(nextState));
assert.equal(files.get('papercompare.json'), original);
```
- [ ] 实现保存队列；序列化和校验成功后，先以原子写入方式更新上一份有效备份，再原子替换主文件。任一步失败都报告未保存，不更新内存中的已保存状态。
- [ ] 首次无文件返回空状态；主文件存在但无效时进入只读错误态，显式恢复后才开放编辑。主文件不存在但有备份时也提示恢复。
- [ ] 测试顺序保存、失败后重试、备份恢复及损坏备份拒绝；跑测试和类型检查后提交。

### Task 3: Zotero 集成与最小窗口

**Files:** addon/manifest.json, addon/bootstrap.js, src/zotero/adapter.ts, src/zotero/plugin.ts, addon/content/compare.xhtml, tests/adapter.test.ts。
**Consumes:** LibraryPort, FilePort, Store。
**Produces:** 插件菜单、单例窗口、真实文献和批注读取、证据定位。

- [ ] 参照官方开发文档及本机 app/omni.ja 中对应源码核验 Zotero 10 API：Items.getByLibraryAndKeyAsync、getAttachments、getAnnotations、Zotero.Reader.open 和 IOUtils.writeUTF8 的实际参数；把采用的签名记录在适配层注释。
- [ ] 使用隔离的 Zotero mocks，测试附件归一到父文献、libraryID 不混用、无父附件提示、批注失效时 locate 拒绝但不修改快照。
- [ ] 实现 annotationText、annotationPageLabel 和 annotationPosition 的读取，只接受文本高亮；定位优先使用仍存在的 annotationKey，不自动猜测失效批注位置。
- [ ] bootstrap 注册资源、等待 Zotero 初始化完成、注入菜单；shutdown 清理菜单和窗口，重复启用不重复注册。
- [ ] 打包 manifest 版本 0.1.0，兼容范围先限定 10.0.*；以自主代码实现，不宣称未经验证的跨平台或旧版本支持。
- [ ] 自动测试通过后在独立测试配置安装 XPI，确认打开窗口及禁用清理；提交。

### Task 4: 完整对比操作和导出

**Files:** src/ui/controller.ts, src/ui/i18n.ts, addon/content/compare.css, src/core/export.ts, tests/export.test.ts, tests/fixtures/demo.json。
**Consumes:** 上述模型、Store、LibraryPort。
**Produces:** 所有设计中的增删改、证据选择、恢复和导出功能。

- [ ] 编写导出用例：中文、Markdown 管道、双引号、逗号、换行、=HYPERLINK 开头和超长文本；JSON 导入后生成新的表 ID，不覆盖旧表。
```ts
assert.match(toCSV(formulaTable), /'=HYPERLINK/);
assert.match(toMarkdown(pipeTable), /\\\|/);
const imported = importBackup(exportBackup(state), existingState);
assert.notEqual(imported.comparisons.at(-1).id, state.comparisons[0].id);
```
- [ ] CSV 使用 RFC 4180 引号转义，对前导空白后的 =、+、-、@ 及控制字符实施安全文本前缀；Markdown 转义管道与换行；JSON 保持原始内容，导入执行全量校验。
- [ ] 实现左侧表列表、右侧表格与单元格编辑区；添加文献、实验、字段和多证据。删除非空字段/表/实验均弹确认。
- [ ] 每次保存显示保存中/成功/失败；失败保留草稿，阻止未经提示切走；导出基于当前确认保存的数据。
- [ ] 文案中区分尚未记录和用户自行标注未报告；缺失来源显示原文快照和失效提示。
- [ ] 完成中英文、暗色主题、键盘焦点、横向滚动、长文本布局；在真实 Zotero 窗口执行上述完整路径并截图检查，发现问题修正后提交。

### Task 5: 安装包、隔离验收与开源材料

**Files:** scripts/launch-test.ps1, scripts/seed-test.js, README.md, README.zh-CN.md, LICENSE, .gitignore, .github/workflows/ci.yml。
**Produces:** dist/papercompare-0.1.0.xpi、可复现构建步骤、实测记录和本地安装。

- [ ] 启动脚本强制使用项目 work/test-profile 和 work/test-data，参数包含 -no-remote 和 -profile；不指向用户默认配置。通过原生 Zotero API 生成两篇合成文献及测试 PDF 高亮；不给真实文库写测试数据。
- [ ] 实测：创建表、两论文三实验、多字段、多证据、跳转；关闭重开检查持久化；删除确认；非法 JSON 拒绝；导出并重新导入；禁用再启用无重复菜单。
- [ ] 将 dist XPI 解包验证 manifest、bootstrap、界面资源完整；计算 SHA-256；运行 npm ci、npm test、npm run typecheck、npm run build，记录实际结果。
- [ ] 添加 MIT LICENSE（版权主体为 PaperCompare contributors），引用文档来源链接，README 不虚构功能/兼容性或 Star 潜力。CI 在 Windows 和 Ubuntu 执行相同核心测试、检查与构建；跨平台 CI 不代表已测试 Zotero GUI。
- [ ] .gitignore 排除 node_modules、work、dist、个人路径、PDF、配置和密钥；demo 仅含合成证据。
- [ ] 隔离验收通过后，用日常 Zotero 的插件管理器安装，不修改现有文献或批注；核实启用状态，输出安装包、演示步骤与已知限制。
- [ ] 本地提交交付内容。远程 GitHub 发布前核验用户账号、仓库名称与公开内容；无可用登录时明确报告本地交付状态。

## Sources

- https://www.zotero.org/support/dev/zotero_7_for_developers
- https://www.zotero.org/support/dev/zotero_8_for_developers
- https://github.com/zotero/make-it-red

以上文档用于接口思路；Zotero 10 的实际接口以本机代码和隔离实测为准。
