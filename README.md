# 伴读(ReadBuddy)

**English** · [简体中文](./README.zh-CN.md)

伴读(ReadBuddy) is a browser translation extension for web reading and YouTube subtitle translation. It is a streamlined fork of [Read Frog](https://github.com/mengxi-ream/read-frog), with a smaller feature surface, adjusted defaults, and a few UI changes.

Thanks to the Read Frog maintainers and contributors for the open-source work this project builds on.

## Features

### Web Page Translation

- Translate full web pages as you read.
- Load translations for visible content while scrolling.
- Switch between bilingual mode and translation-only mode.
- Choose between translating the main content area or the full page.
- Configure a custom shortcut for page translation.
- Set website rules for auto-translation and exclusion.

### Paragraph Translation

- Hover near text and trigger translation for the current paragraph.
- Use `Control`, `Alt`, `Shift`, backtick, or click-and-hold as the trigger.
- Trigger an already translated paragraph again to hide or show its translation.

### YouTube Subtitle Translation

- Translate YouTube subtitles inside the video player.
- Open or hide the subtitle translation panel from the player controls.
- Configure subtitle display styles.
- Download source subtitles and translated subtitles.
- Configure request rate, request batching, and AI segmentation cache cleanup.

### Translation Providers

- Use Google Translate, Microsoft Translate, DeepLX, and other translation services.
- Use AI providers such as OpenAI, OpenAI Compatible, DeepSeek, Gemini, Claude, Grok, Groq, Mistral, and Ollama.
- Assign different providers to page translation, subtitle translation, language detection, and other features.
- Configure API keys, base URLs, models, request headers, temperature, and provider-specific settings.

### Translation Quality

- Use AI content-aware translation with page context.
- Configure custom translation prompts.
- Skip content that already matches the target language.
- Filter very short paragraphs.
- Use translation cache, request queues, and batch requests.

### Display Styles

- Choose built-in translation style presets.
- Write custom CSS for translated text.
- Configure font size, color, background, and position for original and translated subtitles.
- Use system, light, or dark theme.

## Usage

### Configure Providers

Open the extension options page and go to `API Providers`.

1. Add or enable a provider.
2. Fill in the API key, base URL, and model.
3. Assign providers to features such as page translation, subtitle translation, and language detection.

### Translate Web Pages

Open a web page and start page translation from the popup or with the configured shortcut. When page translation is active, the extension watches the page and translates new content as it appears.

### Translate Paragraphs

Enable paragraph translation in the popup and choose a trigger. Hover near the text you want to translate, then use the configured trigger.

### Translate Video Subtitles

Open a YouTube video and click the subtitle translation button in the player controls. Use the panel to show subtitles, adjust styles, and manage subtitle translation.

## Development

Install dependencies:

```bash
pnpm install
```

Start development mode:

```bash
pnpm dev
```

Build the extension:

```bash
pnpm build
```

Run type checking:

```bash
pnpm type-check
```

Run tests:

```bash
SKIP_FREE_API=true pnpm test
```

`src/utils/host/translate/api/__tests__/free-api.test.ts` depends on live external translation services. Set `SKIP_FREE_API=true` for local validation.

## Origin

This project is forked from [Read Frog](https://github.com/mengxi-ream/read-frog) and customized for a narrower extension experience. Read Frog provides the original foundation for web page translation, paragraph translation, subtitle translation, AI provider integration, and configuration management.

Thanks again to the Read Frog project and its contributors.

## License

This project follows the original project's license. See the license files in this repository for details.
