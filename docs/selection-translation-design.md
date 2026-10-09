# 划词翻译功能实现设计

状态：已确认
方案：A——独立 `selection.content` 内容脚本
日期：2026-08-24
目标读者：负责实现、评审和测试该功能的开发 Agent

## 1. 目标

为网页阅读场景增加轻量划词翻译能力：

1. 用户完成文本选择后，本地判断选区的主要语言。
2. 选区确认属于目标语言时保持页面原状；选区属于其他语言或语言未知时，在选区附近显示翻译按钮。
3. 用户点击按钮后立即打开浮层并显示加载状态，翻译完成后在浮层中显示译文。
4. 设置页提供功能开关、目标语言和翻译 API 选择。
5. 按钮根据选区几何位置与视口空间自动选择右下、右上、右侧等位置。

该功能应复用现有 Provider、后台翻译队列、缓存、重试、主题和国际化能力。

## 2. 已确认的产品行为

### 2.1 默认行为

- 新安装和 v1 配置迁移后的默认状态均为启用。
- 默认目标语言沿用用户当前的 `language.targetCode`。
- 默认翻译 Provider 沿用用户当前的 `translate.providerId`。
- 默认 Provider 配置列表同时提供 `google-translate-default` 与 `microsoft-translate-default`，两个 Provider 无需 API Key；划词翻译不会强制切换用户当前 Provider。
- 语言识别在本地完成。完成选区本身不会发起网络请求。
- 翻译请求仅由用户点击翻译按钮触发。
- 选区语言识别结果为目标语言时隐藏按钮。
- 识别结果为其他语言或 `und` 时显示按钮。该策略保障单词、短语等短文本拥有稳定入口。

短拉丁词的语言判断天然存在歧义。例如 `gift` 可出现在多种语言中。本功能采用“确认属于目标语言才隐藏”的策略，允许少量多展示，降低漏掉翻译入口的概率。

### 2.2 浮层行为

- 点击按钮后，浮层立即打开并显示加载状态。
- 成功状态显示译文和复制按钮。
- 失败状态显示可读错误和“重试”按钮。
- `Escape`、浮层外点击、新建选区和功能关闭都会关闭当前浮层。
- 用户与按钮或浮层交互时保留选区快照，页面清除原生高亮不会影响当前请求和结果。
- 新选区创建后，旧请求可以在后台完成；旧结果通过会话编号隔离，无法覆盖新选区状态。

### 2.3 本期范围

- 普通 DOM 文本。
- `contenteditable` 中由 `document.getSelection()` 暴露的文本。
- 开放 Shadow DOM 中浏览器能够暴露的选区。
- 顶层页面、同源 iframe 和拥有内容脚本权限的跨源 iframe。
- 鼠标、触控指针和键盘产生的文档选区。
- Chrome、Edge 和 Firefox 的 MV3 构建。

### 2.4 本期范围外

- `<input>` 与 `<textarea>` 内部的值选区。这两类控件使用 `selectionStart`、`selectionEnd` 和独立定位模型，后续以单独能力实现。
- PDF Viewer、浏览器内置页面、扩展商店等禁止内容脚本运行的页面。
- 划词词典、朗读、自定义动作、固定浮层、拖拽缩放和右键菜单。
- 流式 LLM 输出。首版沿用现有非流式翻译队列。
- 独立的划词翻译 Prompt、熟练度和限流设置。首版沿用现有翻译 Prompt、`language.level` 与网页翻译队列配置。

## 3. 方案选择

### 3.1 采用方案

新增独立的 `src/entrypoints/selection.content/` 内容脚本，使用 WXT `createShadowRootUi` 创建隔离 UI。选区监听、按钮、译文浮层和相关状态全部位于该入口内。后台调用继续走 `translateTextCore` 和 `enqueueTranslateRequest`。

选择依据：

- WXT 官方提供 Shadow Root 内容脚本 UI，覆盖挂载、样式注入和失效清理。
- 仓库历史版本曾使用同名入口承载 selection toolbar，已有选区边界、Shadow DOM 与交互保护经验可复用。
- 当前 `host.content` 专注网页和节点翻译。独立入口保持两个运行时的职责清晰。
- 独立入口可以设置 `allFrames: true`，每个 frame 在自己的坐标系内管理选区和浮层。

### 3.2 已评估方案

| 方案                                          | 工作量 | 风险 | 结论                                         |
| --------------------------------------------- | ------ | ---- | -------------------------------------------- |
| 独立 `selection.content` + WXT Shadow Root UI | 中     | 低   | 采用                                         |
| 合并到 `host.content/runtime.ts`              | 中     | 中   | 网页翻译生命周期与选区交互耦合，维护边界较宽 |
| 恢复历史完整 selection toolbar                | 高     | 高   | 带入大量本期范围外能力和依赖                 |

### 3.3 官方能力边界

- [WXT `createShadowRootUi`](https://wxt.dev/api/reference/wxt/utils/content-script-ui/shadow-root/functions/createshadowrootui) 负责 Shadow Root UI 创建。
- [WXT Content Script UI 指南](https://wxt.dev/guide/essentials/content-scripts.html#shadow-root) 给出 `cssInjectionMode: "ui"` 与 React 挂载模式。
- [MDN `selectionchange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event) 用于监听文档选区变化。
- [MDN `Range.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Range/getBoundingClientRect) 与 `Range.getClientRects()` 提供选区视口坐标。
- [Base UI Popover](https://base-ui.com/react/components/popover) 提供浮层锚定、翻转与碰撞处理。

Chrome 138 起提供内置 Language Detector API。该能力目前集中在桌面 Chrome，并涉及首次模型下载和短文本置信度问题。本期继续使用仓库现有 `franc` 链路，获得 Chrome、Edge、Firefox 一致行为。

## 4. 总体架构

涉及的组件超过 3 个，数据流如下：

```text
┌──────────────────────────────────────────────────────────────┐
│ Web page / iframe                                            │
│                                                              │
│  document Selection                                          │
│          │                                                   │
│          ▼                                                   │
│  SelectionController ──► local language decision             │
│          │                         │                          │
│          │ eligible                │ target language          │
│          ▼                         └──► idle                   │
│  SelectionGeometry                                            │
│          │                                                   │
│          ▼                                                   │
│  WXT Shadow Root UI                                          │
│  [translate button] ──click──► [result popover]               │
└───────────────────────┬──────────────────────────────────────┘
                        │ translateTextForSelection
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Existing background translation path                         │
│ enqueueTranslateRequest                                      │
│   ├── translation cache                                      │
│   ├── request / batch queue                                  │
│   └── executeTranslate ──► selected Provider                 │
└──────────────────────────────────────────────────────────────┘

Options page ──writeConfigAtom──► local:config
       ▲                              │
       └──── selection settings       └──storage watch──► UI
```

组件之间保持单向数据流：文档事件生成选区会话，选区会话生成按钮位置，按钮点击生成翻译会话，配置变化使当前会话失效并重新判断。

## 5. 配置设计

### 5.1 Schema

新增 `src/types/config/selection-translation.ts`：

```ts
export const selectionTranslationConfigSchema = z.object({
  enabled: z.boolean(),
  targetCode: langCodeISO6393Schema,
  providerId: z.string().nonempty(),
})

export type SelectionTranslationConfig
  = z.infer<typeof selectionTranslationConfigSchema>
```

`Config` 顶层新增：

```ts
selectionTranslation: selectionTranslationConfigSchema
```

默认配置：

```ts
selectionTranslation: {
  enabled: true,
  targetCode: "cmn",
  providerId: "deepseek-default",
}
```

新安装使用上述值。v1 到 v2 的迁移从旧配置动态继承目标语言和 Provider。v2 到 v3 的迁移为旧配置补入缺失的 Google Translate 与 Microsoft Translate Provider，并保留已有 Provider 的状态和顺序。

### 5.2 默认 Provider 集成

`FEATURE_KEYS` 新增 `"selectionTranslation"`，定义如下：

```ts
selectionTranslation: {
  isProvider: isTranslateProvider,
  getProviderId: config => config.selectionTranslation.providerId,
  configPath: ["selectionTranslation", "providerId"],
}
```

该内部映射带来以下一致性：

- Config Schema 校验 Provider 存在、类型兼容且启用。
- 删除当前 Provider 时自动选择首个兼容 Provider。
- 停用当前 Provider 时原子迁移到首个兼容 Provider。

划词翻译 Provider 在自己的设置页呈现，与网页翻译和字幕翻译采用一致的任务归属。

### 5.3 配置迁移

本次变更将 `CONFIG_SCHEMA_VERSION` 从 `1` 提升到 `3`，新增：

- `src/utils/config/migration-scripts/v001-to-v002.ts`
- `src/utils/config/migration-scripts/v002-to-v003.ts`
- `src/utils/config/__tests__/example/v002.ts`
- `src/utils/config/__tests__/example/v003.ts`

迁移规则：

```ts
selectionTranslation: {
  enabled: true,
  targetCode: oldConfig.language?.targetCode ?? "cmn",
  providerId: oldConfig.translate?.providerId ?? "deepseek-default",
}
```

v2 到 v3 的迁移按 Provider `id` 或 `provider` 类型判断是否已存在，仅向数组末尾追加缺失的免费 Provider，不覆盖用户已有条目。

迁移函数遵循仓库约定：纯函数、幂等、兼容空值、所有默认值直接写入迁移快照。迁移文件避免引用未来可能变化的常量。

### 5.4 配置实时同步

`selection.content` 始终挂载轻量 Shadow Host，React 内部通过 `configAtom` 的 storage watch 获取更新：

- `enabled` 变为 `false`：清空按钮、浮层和当前会话，移除活动监听器。
- `enabled` 变为 `true`：注册活动监听器，并对当前有效选区执行一次判断。
- `targetCode` 或 `providerId` 变化：递增会话编号、关闭旧浮层、重新判断当前选区。

该设计让设置变化在已打开标签页中生效，无需刷新页面。

## 6. 设置页设计

### 6.1 路由与导航

新增路由 `/selection-translation`，侧边栏位置放在“翻译”之后、“站点规则”之前，图标使用 `tabler:text-recognition`。

页面标题使用“划词翻译”。页面保持 `PRODUCT.md` 规定的克制设置风格，使用一个页面承载一个目的。

### 6.2 页面结构

页面包含三个 `ConfigCard`：

1. 功能开关
   - 标题：启用划词翻译
   - 描述：选择非目标语言文本后，在选区附近显示翻译按钮。
   - 控件：`Switch`
2. 目标语言
   - 标题：目标语言
   - 描述：选区将翻译为该语言；已属于该语言的选区隐藏翻译按钮。
   - 控件：可搜索单选语言 `Combobox`
3. 翻译 API
   - 标题：翻译 API
   - 描述：选择划词翻译使用的 Provider。
   - 控件：现有 `ProviderSelector`
   - 数据：启用且满足 `isTranslateProviderConfig` 的 Provider
   - API Key 缺失时显示现有 `SetApiKeyWarning`

功能关闭时，目标语言和 Provider 仍然可见，两个控件进入 disabled 状态。用户可以理解当前配置，并从开关恢复功能。

### 6.3 可复用语言控件

新增 `src/components/target-language-combobox.tsx`，复用：

- `getTargetLanguageItems()`
- `filterLanguage()`
- Base UI `Combobox`
- `getLanguageLabel()` 与 `getLanguageName()`

控件接收 `value`、`onValueChange`、`disabled` 和 `aria-label`。选项页直接使用该受控组件，避免绑定全局 `language` Atom。

### 6.4 国际化

以下 9 个 locale 文件全部新增相同 key 结构：

```text
options.selectionTranslation.title
options.selectionTranslation.enable.title
options.selectionTranslation.enable.description
options.selectionTranslation.targetLanguage.title
options.selectionTranslation.targetLanguage.description
options.selectionTranslation.provider.title
options.selectionTranslation.provider.description
options.selectionTranslation.provider.placeholder
selectionTranslation.action.translate
selectionTranslation.popover.title
selectionTranslation.popover.loading
selectionTranslation.popover.retry
selectionTranslation.popover.copy
selectionTranslation.errors.*
```

涉及 `en`、`zh-CN`、`zh-TW`、`ja`、`ko`、`es`、`ru`、`tr`、`vi`。

## 7. 内容脚本设计

### 7.1 入口

新增 `src/entrypoints/selection.content/index.tsx`：

```ts
defineContentScript({
  matches: ["*://*/*", "file:///*"],
  allFrames: true,
  matchAboutBlank: true,
  cssInjectionMode: "ui",
  // main(ctx) mounts one isolated UI per frame
})
```

入口职责：

- 使用 `window.__READ_FROG_SELECTION_INJECTED__` 防止重复注入。
- 读取初始 config、界面语言和主题。
- 调用 `createShadowRootUi`，设置 `position: "overlay"`、`anchor: "body"`。
- 为 Shadow Host 添加 `REACT_SHADOW_HOST_CLASS` 和稳定的数据属性。
- 使用 `insertShadowRootUIWrapperInto`、`ThemeProvider`、`JotaiProvider` 与 `TooltipProvider`。
- 为按钮和浮层容器添加 `NOTRANSLATE_CLASS`。
- 使用 `isolateEvents` 阻止 UI 的鼠标、指针和键盘事件继续冒泡至网页与节点翻译监听器。
- 在 `ctx.onInvalidated` 和 `onRemove` 中卸载 React Root、监听器、定时器与 animation frame。

每个 frame 只读取和处理自己的 `document.getSelection()`。跨源 frame 拥有独立内容脚本上下文，浮层位置自然使用该 frame 的视口坐标。

### 7.2 目录划分

```text
src/entrypoints/selection.content/
  index.tsx                         # WXT 入口与 Shadow Root 挂载
  app.tsx                           # Provider、主题和顶层状态组合
  selection-controller.ts          # DOM 事件、会话状态与竞态控制
  selection-snapshot.ts             # 选区读取、Range 快照、Shadow DOM 兼容
  selection-geometry.ts             # 候选位置计算与视口约束
  selection-language.ts             # 本地语言判定与目标语言等价关系
  components/
    selection-translate-button.tsx  # 浮动按钮
    selection-translation-popover.tsx # 加载、成功、错误、重试
```

文件名保持职责单一。历史版本的 `selection.content/utils.ts` 可以作为 `selection-snapshot.ts` 的参考来源，按当前范围提取 `normalizeSelectedText`、Range 快照和跨 Shadow Root 边界处理。

## 8. 选区会话与事件模型

### 8.1 数据结构

```ts
interface SelectionRangeSnapshot {
  startContainer: Node
  startOffset: number
  endContainer: Node
  endOffset: number
}

interface SelectionSession {
  id: number
  text: string
  ranges: SelectionRangeSnapshot[]
  createdAt: number
}
```

Range 快照保存边界节点和 offset。需要位置时重新构造 live `Range`，因此滚动、缩放和普通布局变化后可以获取新坐标。DOM 节点失效或 offset 越界时，本次位置计算返回空值并关闭 UI。

### 8.2 有效选区

选区同时满足以下条件时进入语言判断：

- `Selection.isCollapsed === false`
- 具有至少一个可读取 Range
- 规范化文本至少包含一个 Unicode 字母 `\p{L}`
- 规范化文本长度在 1 到 5000 个 Unicode code point 之间
- 选区边界位于网页内容，未位于当前扩展 Shadow Root
- 活动元素属于普通文档或 `contenteditable`

规范化仅移除零宽字符、首尾空白，并将连续空白整理为单个空格。发送翻译时保留段落换行，仅执行现有 `prepareTranslationText`。

### 8.3 事件

`SelectionController` 注册以下事件：

| 事件               | 行为                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `pointerdown`      | 网页区域开始新交互时关闭旧按钮和浮层                                 |
| `pointerup`        | 下一个 animation frame 读取最终选区                                  |
| `keyup`            | 支持 Shift + 方向键等键盘选区，下一帧读取选区                        |
| `selectionchange`  | 空选区时关闭按钮；有效选区使用 120ms debounce 作为触控和脚本选区兜底 |
| `scroll`           | rAF 合并后重新计算按钮位置                                           |
| `resize`           | 重新计算按钮位置和浮层碰撞边界                                       |
| `visibilitychange` | 页面恢复可见时校验 Range 与配置                                      |

所有事件使用同一个 `AbortController.signal` 注册。每个 debounce timer 和 rAF id 都在 teardown 中清理。

### 8.4 竞态处理

每次有效选区、配置变化或关闭操作都会递增 `sessionId`。异步步骤提交状态前比较捕获的 id：

```text
selection A ──detect──────────────┐
selection B ──detect──ready       │
                                  └──A result ignored

session B ──translate─────────────┐
selection C ──new session         │
                                  └──B result cached, UI ignored
```

现有 `enqueueTranslateRequest` 消息没有取消协议。旧请求继续执行并进入现有缓存；UI 会话隔离保证界面一致性。

## 9. 语言判定

### 9.1 流程

1. 从规范化选区文本构造最多 512 字符的检测样本：前 384 字符加后 128 字符。
2. 调用 `detectLanguageWithSource(sample, { enableLLM: false })`。
3. 将 `cmn` 与 `cmn-Hant` 视为同一目标语言族；`yue` 保持独立。
4. 结果与目标语言等价时进入 `idle`。
5. 结果属于其他语言或 `und` 时进入 `ready` 并显示按钮。

选区语言按主要语言判断。混合语言选区由 `franc` 返回的主要语言决定。

### 9.2 成本与隐私

- 语言判断只运行本地库。
- 选区变化期间最多保留一个 debounce 任务。
- 检测样本限制为 512 字符。
- 用户点击前，选区内容不会进入扩展消息或外部 Provider。

## 10. 按钮定位

### 10.1 坐标来源

对会话中的 Range 快照重新创建 `Range`，收集所有宽高大于 0 的 `getClientRects()`。坐标直接使用 viewport 坐标，按钮使用 `position: fixed`，避免加入 `scrollX` 和 `scrollY` 后产生双重偏移。

多行选区使用首行 rect、末行 rect 和整体 `getBoundingClientRect()`。反向选区通过 anchor/focus 边界顺序确定视觉焦点，前向选区使用末行，反向选区使用首行。

### 10.2 候选位置

常量：

```text
BUTTON_SIZE = 32px
SELECTION_GAP = 8px
VIEWPORT_MARGIN = 8px
```

候选顺序：

1. `right-bottom`：焦点行右侧，按钮底边与焦点行底边对齐。
2. `right-top`：焦点行右侧，按钮顶边与焦点行顶边对齐。
3. `right-center`：整体选区右侧，按钮垂直居中。
4. `below-end`：焦点行下方，按钮右边与焦点行右边对齐。
5. `above-end`：焦点行上方，按钮右边与焦点行右边对齐。
6. `left-center`：整体选区左侧，按钮垂直居中。

候选评分规则：

- 完整位于视口安全边距内的候选优先。
- 与任意选区 rect 没有重叠的候选优先。
- 顺序靠前的候选优先。
- 所有候选均发生碰撞时，对第一候选执行 viewport clamp。

该算法在普通段落中优先得到右下或右上位置，在接近视口右边缘时切换到上下方或左侧。

### 10.3 浮层定位

按钮本身作为 Base UI Popover Trigger。浮层默认使用：

```text
side = bottom
align = end
sideOffset = 8
positionMethod = fixed
collisionPadding = 8
collision side = flip
collision align = shift
```

扩展 `src/components/ui/base-ui/popover.tsx` 的 Positioner 透传参数，使调用方可以设置 `positionMethod`、`collisionAvoidance`、`collisionPadding` 和 `sticky`。浮层 Portal 的 `container` 指向当前 Shadow Root wrapper。

## 11. UI 状态机

```text
idle
  └─ valid selection ─► detecting
detecting
  ├─ target language ─► idle
  ├─ other / unknown ─► ready
  └─ invalid/new selection ─► idle/detecting
ready
  ├─ click ─► translating
  ├─ new selection ─► detecting
  └─ dismiss ─► idle
translating
  ├─ success ─► success
  ├─ failure ─► error
  └─ new selection/dismiss ─► idle/detecting
success
  ├─ new selection ─► detecting
  └─ dismiss ─► idle
error
  ├─ retry ─► translating
  ├─ new selection ─► detecting
  └─ dismiss ─► idle
```

按钮只在 `ready`、`translating`、`success`、`error` 且当前会话有效时存在。`translating` 后按钮保持可见并进入 disabled 状态，浮层承载请求进度。

## 12. 翻译调用

### 12.1 新增封装

新增 `src/utils/host/translate/translate-selection.ts`：

```ts
export async function translateTextForSelection(
  config: Config,
  text: string,
): Promise<string>
```

职责：

1. 使用 `resolveProviderConfig(config, "selectionTranslation")` 解析 Provider。
2. 校验 Provider 已启用，API Provider 的密钥满足现有规则。
3. 构造语言配置：

   ```ts
   {
     sourceCode: "auto",
     targetCode: config.selectionTranslation.targetCode,
     level: config.language.level,
   }
   ```

4. 调用 `translateTextCore`：

   ```ts
   {
     text,
     langConfig,
     providerConfig,
     enableAIContentAware: false,
     extraHashTags: ["selectionTranslation:v1"],
   }
   ```

划词翻译关闭 AI 网页上下文，缩短用户点击后的等待时间。LLM Provider 继续使用用户当前的网页翻译 Prompt，目标语言来自划词翻译设置。

### 12.2 后台链路

首版继续使用 `enqueueTranslateRequest`：

- 标准翻译 Provider 进入现有 RequestQueue。
- LLM Provider 进入现有 BatchQueue，单次交互最多增加约 100ms 聚合等待。
- 相同文本、Provider、目标语言和 Prompt 复用已有缓存。
- 缓存清理继续由“系统 > 清除缓存”统一处理。

该方案无需新增消息协议和后台服务。页面翻译大量运行时，划词请求可能等待现有队列令牌；首版接受这一资源共享行为。后续性能数据确认交互延迟明显后，再为交互请求增加队列优先级。

### 12.3 错误映射

UI 统一映射以下错误：

| 条件                  | 用户提示                 | 操作                           |
| --------------------- | ------------------------ | ------------------------------ |
| Provider 缺失或已停用 | 当前翻译 API 不可用      | 打开设置页、重试               |
| API Key 缺失          | 请先配置 API Key         | 打开 API Providers 页          |
| 请求超时              | 翻译请求超时             | 重试                           |
| Provider 限流         | 请求过于频繁，请稍后重试 | 重试                           |
| 扩展上下文失效        | 扩展已更新，请刷新页面   | 刷新页面                       |
| 其他错误              | 翻译失败                 | 重试、保留可复制错误详情给日志 |

错误正文经过 `extractMessage` 归一化，UI 只渲染纯文本。

## 13. 样式与可访问性

### 13.1 按钮

- 32 × 32 px 圆角按钮，使用 `RiTranslate` 或仓库当前翻译图标。
- 使用主题变量 `bg-popover`、`text-popover-foreground`、`border-border` 与 `shadow-floating`。
- `z-index: 2147483647`。
- `aria-label` 与 `title` 使用“翻译所选文本”。
- 支持 Tab 聚焦、Enter 和 Space 激活。
- `prefers-reduced-motion` 下移除位移和缩放动画。

### 13.2 译文浮层

- 桌面宽度 320–420 px；窄视口宽度为 `min(360px, calc(100vw - 16px))`。
- 最大高度为 `min(50vh, 480px)`，译文区域内部滚动。
- 顶部显示“划词翻译”和关闭按钮。
- 加载状态使用 spinner 与文本。
- 译文使用 `whitespace-pre-wrap` 和 `overflow-wrap:anywhere`。
- 成功状态提供复制按钮和复制成功反馈。
- 错误状态使用现有 Alert 视觉语言。
- Base UI Popover 提供 `role`、焦点管理和 `Escape` 关闭能力。

所有扩展节点使用 Shadow DOM、`NOTRANSLATE_CLASS` 和稳定的 `data-read-frog-selection-*` 属性，避免网页翻译处理浮层内容。

## 14. 文件改动清单

预计涉及 30 个以上文件，其中包含 9 个 locale 文件和多组测试。该规模源于配置迁移、独立内容脚本、设置路由与跨语言文案，运行时核心集中在约 9 个文件。

### 14.1 新增文件

| 文件                                                                                            | 作用                     |
| ----------------------------------------------------------------------------------------------- | ------------------------ |
| `src/types/config/selection-translation.ts`                                                     | 配置 Schema 与类型       |
| `src/utils/config/migration-scripts/v001-to-v002.ts`                                            | 选区配置迁移             |
| `src/utils/config/migration-scripts/v002-to-v003.ts`                                            | 免费 Provider 迁移       |
| `src/utils/config/__tests__/example/v002.ts`                                                    | v2 配置快照              |
| `src/utils/config/__tests__/example/v003.ts`                                                    | v3 配置快照              |
| `src/components/target-language-combobox.tsx`                                                   | 受控目标语言控件         |
| `src/entrypoints/options/pages/selection-translation/index.tsx`                                 | 设置页                   |
| `src/entrypoints/selection.content/index.tsx`                                                   | 独立内容脚本入口         |
| `src/entrypoints/selection.content/app.tsx`                                                     | UI 组合                  |
| `src/entrypoints/selection.content/selection-controller.ts`                                     | 事件与状态机             |
| `src/entrypoints/selection.content/selection-snapshot.ts`                                       | 选区快照                 |
| `src/entrypoints/selection.content/selection-geometry.ts`                                       | 定位算法                 |
| `src/entrypoints/selection.content/selection-language.ts`                                       | 语言决策                 |
| `src/entrypoints/selection.content/components/selection-translate-button.tsx`                   | 按钮                     |
| `src/entrypoints/selection.content/components/selection-translation-popover.tsx`                | 译文浮层                 |
| `src/utils/host/translate/translate-selection.ts`                                               | 翻译封装                 |
| `src/entrypoints/selection.content/__tests__/selection-controller.test.ts`                      | 事件、清理与竞态测试     |
| `src/entrypoints/selection.content/__tests__/selection-snapshot.test.ts`                        | Range 与 Shadow DOM 测试 |
| `src/entrypoints/selection.content/__tests__/selection-geometry.test.ts`                        | 候选定位与边界测试       |
| `src/entrypoints/selection.content/__tests__/selection-language.test.ts`                        | 语言显示决策测试         |
| `src/entrypoints/selection.content/components/__tests__/selection-translation-popover.test.tsx` | UI 状态测试              |
| `src/entrypoints/options/pages/selection-translation/__tests__/index.test.tsx`                  | 设置页测试               |
| `src/utils/host/translate/__tests__/translate-selection.test.ts`                                | 翻译参数与错误测试       |

### 14.2 修改文件

| 文件                                                         | 修改                                                |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `src/types/config/config.ts`                                 | 挂载 `selectionTranslation` Schema 与 Provider 校验 |
| `src/utils/constants/config.ts`                              | 默认配置与 Schema 版本 3                            |
| `src/utils/constants/providers.ts`                           | 默认 Provider 列表补入 Google/Microsoft             |
| `src/utils/host/translate/api/microsoft.ts`                  | 使用免 Key Microsoft 翻译端点                       |
| `src/utils/constants/feature-providers.ts`                   | 新增 feature key、路径和 i18n map                   |
| `src/utils/config/__tests__/feature-providers.test.ts`       | Provider 分配与删除回退                             |
| `src/types/config/__tests__/config-provider-enabled.test.ts` | Provider 启用校验                                   |
| `src/entrypoints/options/app-sidebar/nav-items.ts`           | 新路由                                              |
| `src/entrypoints/options/app-sidebar/settings-nav.tsx`       | 新导航项                                            |
| `src/entrypoints/options/app.tsx`                            | lazy page 与 route component                        |
| `src/components/ui/base-ui/popover.tsx`                      | 透传 Positioner 参数                                |
| `src/locales/*.yml`                                          | 9 个 locale 的设置、按钮、状态与错误文案            |

## 15. 测试设计

### 15.1 配置与迁移

- v1 默认配置迁移后，目标语言等于旧 `language.targetCode`。
- v1 自定义网页翻译 Provider 迁移后成为划词翻译 Provider。
- 缺失 `language` 或 `translate` 的异常旧对象使用固定回退值。
- v2 示例通过 `configSchema.safeParse`。
- v2 到 v3 迁移补入缺失的 Google/Microsoft Provider，并保留已有条目、状态与顺序。
- Google/Microsoft Provider 可在无 API Key 配置下完成翻译请求。
- 划词翻译 Provider 缺失、类型错误、已停用时返回准确 issue path。
- 删除当前 Provider 时选择首个启用且兼容的 Provider。
- `buildFeatureProviderPatch` 生成 `selectionTranslation.providerId` 路径。

### 15.2 语言判断

- 空白、零宽字符、纯标点、纯 emoji 隐藏按钮。
- 明确的目标语言长文本隐藏按钮。
- 明确的其他语言文本显示按钮。
- `und`、单词和短语显示按钮。
- `cmn` 与 `cmn-Hant` 互相等价。
- `yue` 与 `cmn` 保持独立。
- 5000 code point 有效，5001 code point 失效。
- 检测结果延迟返回时，新 session 屏蔽旧结果。

### 15.3 选区快照

- 单 Range、多 Range、跨 inline 节点和多段文本正确读取。
- collapsed Selection 返回空。
- Shadow Root 边界通过 `getComposedRanges` 读取，缺少该 API 时使用 `getRangeAt`。
- DOM 节点移除和 offset 失效时安全返回空。
- 扩展 Shadow Root 内部选区被过滤。

### 15.4 定位

- 普通选区优先右下。
- 视口底部选区切换右上或上方。
- 视口右边缘选区切换上下方或左侧。
- 多行前向选区使用末行，反向选区使用首行。
- 所有候选碰撞时结果保持在 8px viewport margin 内。
- 滚动、resize 和 200% zoom 后重新计算。
- 空 rect 和 detached Range 关闭 UI。

### 15.5 内容脚本状态机

- 功能关闭时无活动 DOM 监听器和按钮。
- 启用后当前选区触发判断。
- pointer、keyboard 和 selectionchange debounce 均可创建会话。
- 新选区关闭旧浮层。
- 点击扩展 UI 保留当前会话。
- 关闭浮层和 `Escape` 清理状态。
- config storage 更新实时关闭或重新判断。
- `ctx.onInvalidated` 清理 React Root、事件、timer 和 rAF。
- 每个 frame 只创建一个实例。

### 15.6 翻译与组件

- 点击按钮立即打开 loading 浮层，且只发送一次请求。
- 请求携带 `sourceCode: "auto"`、独立 targetCode 和独立 Provider。
- `extraHashTags` 包含 `selectionTranslation:v1`。
- 成功结果按纯文本呈现并可复制。
- API Key 缺失、超时、限流和通用错误显示对应文案。
- 重试复用当前 selection session。
- 连续点击期间按钮 disabled。
- 旧请求结果无法覆盖新 session。
- Popover 在 Shadow Root 指定容器内渲染。

### 15.7 设置页

- 路由和侧边栏 active 状态正确。
- 开关、目标语言与 Provider 写入 `writeConfigAtom`。
- 功能关闭时两个选择器 disabled。
- Provider 列表只包含启用的翻译 Provider。
- 缺少 API Key 时显示警告。
- 所有控件具有 label、aria-label 和键盘交互。

### 15.8 手工验收矩阵

在 Chrome、Edge、Firefox 中覆盖：

- 普通文章、长段落、多行选区、RTL 页面、深色主题。
- 页面顶部、底部、左右边缘和窄 iframe。
- 同源 iframe、跨源 iframe、`about:blank` 子 frame。
- 鼠标正向选择、反向选择、触控选择、Shift + 方向键选择。
- 目标语言、其他语言、短单词、混合语言、emoji 与超长文本。
- Google/Microsoft、DeepL/DeepLX、LLM Provider。
- 缺失 Key、429、超时、离线和扩展热更新。
- 页面翻译开启、节点翻译开启、字幕脚本存在时的共存行为。

## 16. 验收标准

1. 功能启用后，1–5000 code point 的有效非目标语言或未知语言选区在选区稳定后 200ms 内显示按钮。
2. 明确识别为目标语言的选区保持无按钮状态。
3. 按钮完整位于当前 frame 视口内，与选区重叠只发生在所有候选均受限时。
4. 点击按钮后 100ms 内出现浮层加载状态，并且每次点击产生至多一个翻译请求。
5. 翻译成功后完整显示译文；换行保留，长文本可滚动和复制。
6. Provider 错误拥有用户可执行的重试或设置入口。
7. 新选区、关闭、设置更新和内容脚本失效都不会留下可见孤儿 UI 或活动监听器。
8. 设置页保存后，已打开标签页在 storage watch 到达后生效。
9. 顶层页面与具备注入权限的 iframe 均可独立完成划词翻译。
10. 页面 CSS 无法改变按钮和浮层核心布局，扩展 CSS 也不会污染网页。
11. `pnpm type-check`、`pnpm lint`、`pnpm test`、Chrome 构建和 Firefox 构建全部通过。

## 17. 风险与防护

| 风险                   | 防护                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| 短文本语言识别误差     | 未知语言显示入口；只在确认目标语言时隐藏                               |
| 高频 `selectionchange` | 120ms debounce、512 字符样本、session 竞态隔离                         |
| 网页样式与事件干扰     | WXT Shadow Root、`cssInjectionMode: "ui"`、事件隔离                    |
| 选区在点击按钮后消失   | 保存文本与 Range 边界快照，UI 交互期间锁定 session                     |
| DOM 更新使 Range 失效  | 重建 Range 时捕获异常并关闭 UI                                         |
| 页面翻译队列繁忙       | 共用限流保障 Provider 稳定；记录点击到结果耗时，后续依据数据决定优先级 |
| iframe 重复实例        | frame 内全局注入标记与 `ctx.onInvalidated` 清理                        |
| Provider 删除或停用    | FEATURE_PROVIDER_DEFS 校验与现有回退机制                               |
| 旧请求覆盖新结果       | 单调递增 sessionId，提交前校验                                         |

## 18. 安全、隐私与依赖

### 18.1 数据处理

- 选区语言判断完全本地执行。
- 用户点击后才把选区文本发送给已选择的翻译 Provider。
- 译文继续进入现有本地 Dexie translation cache；缓存 key 为哈希。
- 设置页使用现有本地 storage。
- 译文和错误均按纯文本渲染，禁止 HTML 注入路径。

### 18.2 外部依赖与凭据

本功能不新增外部服务、MCP、CLI、运行时或 npm 包。

所需凭据完全来自用户现有 Provider 配置：

- LLM/DeepL 等 API Provider：继续使用 API Providers 页面中的 API Key。
- Google Translate、Microsoft Translate 等免 Key Provider：继续使用现有实现。
- Ollama、DeepLX 等自定义地址：继续使用现有 Base URL 配置。

开发和测试阶段无需申请新的账号或凭据。

## 19. 回滚策略

配置迁移只新增 `selectionTranslation` 分支，没有不可逆数据转换。需要回滚 UI 时采用前向兼容提交：

1. 保留 v3 Schema、迁移文件和用户配置数据。
2. 将默认 `enabled` 调整为 `false`，并移除或停用 `selection.content` 入口和设置导航。
3. 保留 Provider 引用校验，或通过新的 v3 迁移安全移除该分支。

该路径无需清理用户翻译缓存和 Provider 凭据。

## 20. 推荐实施顺序

1. 完成 v3 Schema、默认值、迁移、Feature Provider 集成和相关测试。
2. 完成设置路由、语言控件、Provider 选择与 locale。
3. 完成选区快照、语言判断和几何定位纯函数及单元测试。
4. 完成 `selection.content` Shadow Root 挂载和事件状态机。
5. 完成 `translateTextForSelection`、按钮、Popover 与错误状态。
6. 完成内容脚本组件测试和手工跨浏览器验收。
7. 执行 `pnpm type-check && pnpm lint && pnpm test`，随后执行 Chrome 与 Firefox 构建。

每一步都保持可独立验证。第三步完成后即可用纯函数测试锁定最容易出现跨浏览器问题的选区与定位逻辑。
