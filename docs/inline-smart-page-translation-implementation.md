# 网页翻译合并筛选请求：实现原理与技术方案

日期：2026-10-22。代码基线：`d55f841abf14eab29740f972cb1006cb35da0c5f`。

本文总结上述代码基线中已经实现的“AI 筛选随网页翻译批次合并请求”功能，供后续维护和代码交接使用，并替代编码前的临时设计方案。

## 1. 功能与原理

网页翻译把一批待翻译文本及各自的 DOM 结构提示一起交给当前翻译模型。模型在同一次响应中为每个单元返回“翻译”或“跳过”，程序完成校验后把结果交回现有显示链路。

这消除了独立分类请求带来的前置等待，也统一了模型、密钥和请求队列。一次请求对应现有队列组成的一个批次；整页内容会随视口、预加载范围和动态内容分成多个批次处理。滚动出现的新内容沿用相同路径。

筛选粒度沿用现有翻译单元。模型根据文本语义和结构提示，跳过独立导航、菜单、工具栏、按钮组、同意提示和重复操作控件；标题、正文、评论、内容列表、搜索结果、正文短词、混合单元及判断不清楚的内容进入翻译。

## 2. 生效条件与配置

| 条件                                                                         | 实际行为                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `translate.page.smartFilter.enableAI = true`，网页翻译 Provider 为已启用 LLM | 筛选与翻译合并请求，跟随网页翻译模型           |
| `enableAI = false`                                                           | 普通网页翻译                                   |
| 网页翻译 Provider 为非 LLM                                                   | 普通网页翻译，设置页禁用筛选开关并提示需要 LLM |

默认 `enableAI` 为 `false`。切换到非 LLM 时保留已保存的开关值，切回有效 LLM 后恢复生效。Provider 或筛选配置变化时，现有配置监听会重新启动正在进行的网页翻译。

合并标记只由自动网页翻译入口传入。划词、悬浮、手动节点、页面标题和字幕使用各自原有翻译路径。

当前配置只保留 `smartFilter.enableAI`；旧 `providerId`、`timeoutSeconds` 在配置读取或导入时由 Zod schema 剥离。请求使用现有翻译队列的 **20 秒执行超时**，该时间属于队列任务，与旧独立筛选超时分离。历史迁移脚本保持原有版本语义。

## 3. 调用链与职责

```text
PageTranslationManager：根据开关及 LLM 可用性设置合并标记
  → translation-walker：沿现有视口、预加载和 DOM 遍历路径传递标记
  → translation-modes：生成单元结构提示与源节点快照，创建段落加载状态
  → translateTextForPage → translateTextCore：生成缓存键并发送单元任务
  → enqueueTranslateRequest：读取缓存，未命中则进入队列
  → BatchQueue：按语言、Provider、页面上下文、模式及策略版本组批
  → RequestQueue：限流、调度、超时和重试
  → executeInlineSmartFilterTranslation：一次调用完成批内筛选与翻译
  → 校验并按 ID 配对 → 缓存结果 → 单元校验后写入 DOM
```

复用原有遍历器、批处理、请求队列、翻译缓存和显示接口。内容脚本得到的结果仍是 `Promise<string>`：有效译文为字符串，明确跳过为 `""`，请求失败进入错误路径。

## 4. 输入数据与结构提示

每个任务携带可选的 `InlineSmartFilterRequestContext`：

```ts
{
  strategyVersion: 1,
  hint: {
    tag: "a",
    role: null,
    ancestors: [
      { tag: "nav", role: "navigation", classes: ["site-nav"] },
    ],
  },
}
```

提示在插入加载 wrapper 前采集，包含当前目标元素的 `tag`、`role`，以及最多三层祖先的标签、角色和 class。每层祖先最多五个 class，角色和单个 class 文本截断到 120 字符；扩展自己的 class 会被过滤。DOM 节点引用保留在内容脚本中。

这种上下文让模型能区分导航中的 `Home` 和正文中的同词，同时控制请求体体积。策略版本定义在 `src/types/smart-filter.ts`；修改筛选规则或提示词协议时应递增版本，使新策略使用新的缓存空间。

## 5. 请求协议与结果校验

后台为批次分配临时 ID `u1`、`u2` 等。ID 用于配对当前批次，单元缓存继续使用内容哈希。

输入示例：

```json
{
  "items": [
    { "id": "u1", "text": "Home", "context": { "tag": "a", "role": null, "ancestors": [{ "tag": "nav", "role": "navigation" }] } },
    { "id": "u2", "text": "Reading gives us a place to think.", "context": { "tag": "p", "role": null, "ancestors": [{ "tag": "article", "role": null }] } }
  ]
}
```

输出示例：

```json
{
  "items": [
    { "id": "u2", "action": "translate", "text": "阅读给了我们思考的空间。" },
    { "id": "u1", "action": "skip", "text": "" }
  ]
}
```

执行器复用 `getTranslatePrompt`，保留目标语言、网页上下文和用户翻译风格，并追加合并任务的 JSON 输出约定。通过 AI SDK 的 `generateText`、`Output.object` 和 Zod 获取结构化结果，沿用当前网页翻译 Provider 的模型、温度和 Provider 参数，SDK 的 `maxRetries` 设为零。

提示词把网页文本、标签、角色和 class 定义为待处理数据，要求模型遵守程序约定。独立正文和混合内容优先翻译，降低误跳过风险。

结果校验包含：

- 输入 ID 必须各出现一次；未知、重复或缺失 ID 均视为结构错误。
- `action` 只能是 `skip` 或 `translate`。跳过文本经 `trim()` 后须为空，并统一返回 `""`；译文经现有输出规范化和 `trim()` 后须非空。
- 允许返回乱序；完整校验通过后按输入 ID 顺序生成 `string[]`，再交给队列分发。

合并分支使用 JSON 协议。普通批量翻译继续使用原有 `%%` 分隔协议。

## 6. 批处理、缓存与失败回退

### 批处理

沿用现有字符数、条数限制和 100ms 组批等待。分组键覆盖源语言、目标语言、Provider ID、页面上下文，以及普通/合并模式和策略版本。

单元结构提示随各自任务进入批次；结构提示参与单元缓存键，允许同一批中包含不同 DOM 位置的文本。批量执行和队列的逐条降级入口均识别合并标记，单条任务也能使用同一协议。

### 缓存

复用 IndexedDB 中的 `translationCache`。单元哈希包含规范化原文、Provider 配置、语言、有效提示词、现有网页上下文相关信息，以及新增的合并策略版本和结构提示。

导航和正文中的相同词可因结构提示不同而使用不同缓存；普通翻译与合并翻译也使用不同缓存键。明确跳过保存为 `translation: ""`，读取时根据缓存记录是否存在判定命中，刷新后可以复用跳过结果。普通回退取得的有效译文也可以写入本次合并缓存键。

结构错误与网络失败进入错误流程；停止翻译通过 DOM 生命周期阻止旧结果写回。空跳过结果仅由经过完整校验的合并响应产生。相对时间等原文变化可能使对应单元缓存失效，新任务随翻译批次处理；当前链路已删除独立分类会话及其整页重新筛选机制。

### 失败与回退

| 结果                             | 处理                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| 合法译文或跳过结果               | 返回单元结果并缓存                                                                         |
| JSON 生成、结构或 ID 校验失败    | 当前任务内最多调用一次普通批量翻译，校验返回数量和非空译文                                 |
| 普通回退再次失败                 | 包装为 `isRetryable: false` 的错误，保留原状态码、响应头和错误类型，阻止继续重试及逐条回退 |
| 网络、鉴权、限流、超时等请求错误 | 交给现有队列重试及停止策略处理                                                             |

普通回退直接调用普通执行函数。401、403、404 和限流等队列级错误仍能触发原有停止策略。20 秒超时覆盖队列任务的单次执行，排队等待另计，每次重试重新计时；合并调用和可能发生的普通回退共享该次执行的时间预算。队列通过 `Promise.race` 判定超时，底层调用仍可能迟到返回。

“合并请求”描述正常成功路径：每批一次调用完成两项工作。结构错误回退和原有请求重试可能增加调用次数；独立启用的网页摘要等上下文功能沿用自身链路。

## 7. 显示、交互与迟到结果保护

等待期间使用现有段落加载动画。当前 HEAD 已删除独立筛选提示条、页面边缘呼吸灯和“跳过筛选”操作。

双语模式拿到译文后写入扩展 wrapper。模型明确跳过时移除 wrapper，保留原节点。仅译文模式保留原内容至有效译文返回，跳过时同样只清理 wrapper。错误保留现有错误 UI。

合并筛选按翻译单元决策。仅译文模式中，单元包含链接、按钮、表单控件、可编辑节点或相应交互角色时，程序提前使用双语显示，以保留原交互节点和事件；纯正文继续使用仅译文模式。

异步返回的有效译文在写入前经过 `canApplyInlineTranslation` 检查：

1. wrapper 与目标节点仍连接，walk 标记匹配；源 roots 仍连接且父节点保持一致。
2. 当前源节点身份序列与请求前快照一致，能识别追加、替换和移动。收集时排除扩展 wrapper 及其加载、错误内容。
3. 当前有效源文本与快照一致；两端都通过 `getUnitSourceText(...).trim()` 规范化，保留带首尾空白的有效译文。
4. 混排容器中的单元额外核对局部边界，向两侧收集相邻 Text，跨过扩展 wrapper，在元素边界停止。

快照范围跟随当前翻译单元：单一元素使用元素子树，完整占有父容器的单元使用该容器，混排单元使用自身 roots 和局部边界。例如 `Intro body<p>Child body</p>Outro body` 中，子段落先完成翻译时，两侧单元仍能正常写入；若等待期间向首段边界插入 ` Updated body`，首段旧译文会被丢弃。

停止翻译、源节点脱离或源内容变化后，旧结果通过上述检查退出并清理加载 wrapper。重新调度继续交给现有遍历和 DOM 监听机制。

## 8. 代码位置

| 文件                                                                                             | 职责                                           |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `src/entrypoints/host.content/translation-control/page-translation.ts`                           | 判断合并模式，接入现有视口及动态内容翻译       |
| `src/entrypoints/host.content/translation-control/handle-config-change.ts`                       | 配置变化后重启正在进行的翻译                   |
| `src/utils/host/translate/core/translation-walker.ts`                                            | 传递合并标记                                   |
| `src/utils/host/translate/core/translation-modes.ts`                                             | DOM 提示、混合交互兼容、单元快照和写入保护     |
| `src/utils/host/translate/translate-variants.ts`、`translate-text.ts`                            | 请求选项传递、原有翻译接口及缓存键扩展         |
| `src/types/smart-filter.ts`、`src/utils/message.ts`                                              | 合并上下文类型、策略版本及消息字段             |
| `src/utils/host/translate/api/inline-smart-filter.ts`                                            | 合并提示词、模型调用、结构化结果校验及 ID 配对 |
| `src/entrypoints/background/translation-queues.ts`                                               | 组批隔离、缓存读写、普通回退及错误元信息保留   |
| `src/entrypoints/options/pages/translation/ai-smart-filter.tsx`、`src/types/config/translate.ts` | 开关可用性及精简后的配置结构                   |

独立分类后台、区域采集器、分类消息、会话缓存、独立超时计时器及筛选提示组件已随 `d55f841a` 删除。维护时沿现有网页翻译链路扩展。

## 9. 最小验证范围

已有回归覆盖协议配对、合法空跳过缓存、一次普通回退及错误元信息，以及混合交互、首尾空白、追加/替换节点、混排并发和局部边界变化。相关用例位于：

- `src/utils/host/translate/api/__tests__/inline-smart-filter.test.ts`
- `src/entrypoints/background/__tests__/translation-queues.test.ts`
- `src/utils/host/translate/__tests__/smart-filter-translation.test.ts`

后续修改优先运行受影响用例，必要时补充一个能够复现问题的回归。效果验收直接使用 Ego Lite 和当前配置的真实模型，组合检查 HN 评论页的正文、导航、滚动与刷新，以及 SQLite About 页的仅译文、链接保留和动态文本。同时检查关闭筛选及非 LLM 的普通翻译路径，并在验收后恢复临时配置。

本次仅整理实现文档，依据上述 HEAD 的源码及现有测试内容核对技术细节。
