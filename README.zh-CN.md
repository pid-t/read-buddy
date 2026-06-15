# 伴读(ReadBuddy)

[English](./README.md) · **简体中文**

伴读(ReadBuddy) 是一个浏览器翻译插件，用于网页阅读和 YouTube 字幕翻译。它基于 [Read Frog](https://github.com/mengxi-ream/read-frog) 精简修改而来，保留常用翻译能力，调整了部分默认配置和界面。

感谢 Read Frog 原项目作者与贡献者提供的开源基础。

## 功能

### 网页翻译

- 支持整页翻译，阅读时自动处理页面内容。
- 支持滚动到可视区域后加载译文。
- 支持双语对照和仅显示译文两种模式。
- 支持翻译主要内容或全部内容。
- 支持自定义页面翻译快捷键。
- 支持按网站规则自动翻译或排除自动翻译。

### 段落翻译

- 鼠标悬停到文本附近后，可翻译当前段落。
- 支持 `Control`、`Alt`、`Shift`、反引号和鼠标长按触发。
- 已翻译段落可再次触发以隐藏或显示译文。

### YouTube 字幕翻译

- 支持在视频播放器内翻译 YouTube 字幕。
- 支持从播放器控制栏打开或隐藏字幕翻译面板。
- 支持字幕显示样式配置。
- 支持下载源字幕和译文字幕。
- 支持字幕请求速率、批量请求和 AI 分段缓存清理。

### 翻译服务

- 支持 Google Translate、Microsoft Translate、DeepLX 等翻译服务。
- 支持 OpenAI、OpenAI Compatible、DeepSeek、Gemini、Claude、Grok、Groq、Mistral、Ollama 等 AI 服务。
- 支持为网页翻译、字幕翻译、语言检测等功能分配不同服务商。
- 支持配置 API Key、Base URL、模型、请求头、温度和 provider-specific settings。

### 翻译质量

- 支持结合页面上下文的 AI 内容感知翻译。
- 支持自定义翻译提示词。
- 支持跳过已经是目标语言的内容。
- 支持过滤过短段落。
- 支持翻译缓存、请求队列和批量请求。

### 显示样式

- 支持内置译文样式预设。
- 支持自定义译文 CSS。
- 支持配置原字幕和译文字幕的字号、颜色、背景、位置等样式。
- 支持系统、浅色和深色主题。

## 使用

### 配置服务商

打开插件选项页，进入 `API Providers`。

1. 添加或启用翻译服务商。
2. 填写 API Key、Base URL 和模型。
3. 为网页翻译、字幕翻译、语言检测等功能分配服务商。

### 翻译网页

打开任意网页后，可以通过插件弹窗或快捷键开启整页翻译。页面翻译开启后，插件会监听页面内容变化并继续翻译新增内容。

### 翻译段落

在插件弹窗中开启段落翻译，并选择触发方式。鼠标悬停到文本附近后，使用配置好的触发方式即可翻译当前段落。

### 翻译视频字幕

打开 YouTube 视频后，在播放器控制栏中点击字幕翻译按钮。你可以在面板中显示字幕、调整样式并管理字幕翻译。

## 开发

安装依赖：

```bash
pnpm install
```

启动开发模式：

```bash
pnpm dev
```

构建扩展：

```bash
pnpm build
```

类型检查：

```bash
pnpm type-check
```

运行测试：

```bash
SKIP_FREE_API=true pnpm test
```

`src/utils/host/translate/api/__tests__/free-api.test.ts` 依赖外部免费翻译服务。本地验证测试时建议设置 `SKIP_FREE_API=true`。

## 项目来源

本项目 fork 自 [Read Frog](https://github.com/mengxi-ream/read-frog)，并在其基础上做了精简和定制修改。Read Frog 提供了网页翻译、段落翻译、字幕翻译、AI 服务商接入和配置系统等基础能力。

再次感谢 Read Frog 项目和所有贡献者。

## License

本项目沿用原项目许可。具体许可信息请参考仓库中的 license 相关文件。
