import type { Config } from "@/types/config/config"
import type { LLMProviderConfig, ProviderConfig } from "@/types/config/provider"
import type { BatchQueueConfig, RequestQueueConfig } from "@/types/config/translate"
import type { SubtitlePromptContext, WebPagePromptContext } from "@/types/content"
import type { InlineSmartFilterRequestContext } from "@/types/smart-filter"
import type { PromptResolver } from "@/utils/host/translate/api/ai"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { isEnabledLLMProviderConfig, isLLMProviderConfig } from "@/types/config/provider"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BATCH_SEPARATOR, BATCH_SEPARATOR_LINE_PATTERN } from "@/utils/constants/prompt"
import { generateArticleSummary } from "@/utils/content/summary"
import { cleanText } from "@/utils/content/utils"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { executeInlineSmartFilterTranslation, isInlineSmartFilterResultError } from "@/utils/host/translate/api/inline-smart-filter"
import { microsoftTranslate } from "@/utils/host/translate/api/microsoft"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { normalizeTranslationOutput } from "@/utils/host/translate/translation-output-normalization"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { BatchQueue } from "@/utils/request/batch-queue"
import { RequestQueue } from "@/utils/request/request-queue"
import { attachRequestErrorMeta, getRequestErrorMeta } from "@/utils/request/retry-policy"
import { ensureInitializedConfig } from "./config"

export function parseBatchResult(result: string): string[] {
  return result.trim().split(BATCH_SEPARATOR_LINE_PATTERN).map(t => t.trim())
}

export function shouldUseBatchQueue(providerConfig: ProviderConfig): boolean {
  return isLLMProviderConfig(providerConfig)
}

export async function executeBatchTranslation<TContext>(
  dataList: TranslateBatchData<TContext>[],
  promptResolver: PromptResolver<TContext>,
): Promise<string[]> {
  const { langConfig, providerConfig, context } = dataList[0]
  const texts = dataList.map(d => d.text)

  const batchText = texts.join(`\n\n${BATCH_SEPARATOR}\n\n`)
  const result = await executeTranslate(batchText, langConfig, providerConfig, promptResolver, { isBatch: true, context })
  return parseBatchResult(result)
}

/**
 * Merged filtering and translation for one batch. A structural result error
 * falls back to the normal translation prompt once; the fallback must return
 * one non-empty translation per unit. Any further failure becomes a
 * non-retryable error so the batch queue does not retry or fan out again.
 */
async function executeInlineBatchTranslation<TContext>(
  dataList: TranslateBatchData<TContext>[],
  promptResolver: PromptResolver<TContext>,
): Promise<string[]> {
  const { langConfig, providerConfig, context } = dataList[0]
  if (!isLLMProviderConfig(providerConfig)) {
    throw new Error("Inline smart filter requires an LLM provider")
  }

  try {
    return await executeInlineSmartFilterTranslation(
      dataList,
      LANG_CODE_TO_EN_NAME[langConfig.targetCode],
      providerConfig,
      promptResolver,
      context,
    )
  }
  catch (error) {
    if (!isInlineSmartFilterResultError(error))
      throw error

    logger.warn("Inline smart filter result was invalid; falling back to normal batch translation", error.message)
  }

  try {
    const fallback = await executeBatchTranslation(dataList, promptResolver)
    if (fallback.length !== dataList.length || fallback.some(text => !text.trim())) {
      throw new Error(`Fallback returned ${fallback.length} results for ${dataList.length} units`)
    }
    return fallback
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw attachRequestErrorMeta(
      new Error(`Inline smart filter fallback failed: ${message}`),
      { ...getRequestErrorMeta(error), isRetryable: false },
    )
  }
}

async function getOrGenerateWebPageSummary(
  webTitle: string,
  webContent: string,
  providerConfig: LLMProviderConfig,
  requestQueue: RequestQueue,
): Promise<string | null> {
  const preparedText = cleanText(webContent)
  if (!preparedText) {
    return null
  }

  const textHash = Sha256Hex(preparedText)
  const cacheKey = Sha256Hex(webTitle, textHash, JSON.stringify(providerConfig))

  const cached = await db.articleSummaryCache.get(cacheKey)
  if (cached) {
    logger.info("Using cached summary")
    return cached.summary
  }

  const thunk = async () => {
    const cachedAgain = await db.articleSummaryCache.get(cacheKey)
    if (cachedAgain) {
      return cachedAgain.summary
    }

    const summary = await generateArticleSummary(webTitle, webContent, providerConfig)
    if (!summary) {
      return ""
    }

    await db.articleSummaryCache.put({
      key: cacheKey,
      summary,
      createdAt: new Date(),
    })

    logger.info("Generated and cached new summary")
    return summary
  }

  try {
    const summary = await requestQueue.enqueue(thunk, Date.now(), cacheKey)
    return summary || null
  }
  catch (error) {
    logger.warn("Failed to get/generate summary:", error)
    return null
  }
}

async function getOrGenerateSubtitleSummary(
  videoTitle: string,
  subtitlesContext: string,
  providerConfig: LLMProviderConfig,
  requestQueue: RequestQueue,
): Promise<string | null> {
  const preparedText = cleanText(subtitlesContext)
  if (!preparedText) {
    return null
  }

  const textHash = Sha256Hex(preparedText)
  const cacheKey = Sha256Hex(textHash, JSON.stringify(providerConfig))

  const cached = await db.articleSummaryCache.get(cacheKey)
  if (cached) {
    logger.info("Using cached summary")
    return cached.summary
  }

  const thunk = async () => {
    const cachedAgain = await db.articleSummaryCache.get(cacheKey)
    if (cachedAgain) {
      return cachedAgain.summary
    }

    const summary = await generateArticleSummary(videoTitle, subtitlesContext, providerConfig)
    if (!summary) {
      return ""
    }

    await db.articleSummaryCache.put({
      key: cacheKey,
      summary,
      createdAt: new Date(),
    })

    logger.info("Generated and cached new summary")
    return summary
  }

  try {
    const summary = await requestQueue.enqueue(thunk, Date.now(), cacheKey)
    return summary || null
  }
  catch (error) {
    logger.warn("Failed to get/generate summary:", error)
    return null
  }
}

export interface TranslateBatchData<TContext = unknown> {
  text: string
  langConfig: Config["language"]
  providerConfig: ProviderConfig
  hash: string
  scheduleAt: number
  context?: TContext
  inlineSmartFilter?: InlineSmartFilterRequestContext
}

interface TranslationQueueSetupConfig<TContext = unknown> {
  requestQueueConfig: RequestQueueConfig
  batchQueueConfig: BatchQueueConfig
  promptResolver: PromptResolver<TContext>
}

async function createTranslationQueues<TContext>(config: TranslationQueueSetupConfig<TContext>) {
  const { rate, capacity } = config.requestQueueConfig
  const { maxCharactersPerBatch, maxItemsPerBatch } = config.batchQueueConfig
  const { promptResolver } = config

  const requestQueue = new RequestQueue({
    rate,
    capacity,
    timeoutMs: 20_000,
    maxRetries: 2,
    baseRetryDelayMs: 1_000,
  })

  const batchQueue = new BatchQueue<TranslateBatchData<TContext>, string>({
    maxCharactersPerBatch,
    maxItemsPerBatch,
    batchDelay: 100,
    maxRetries: 3,
    enableFallbackToIndividual: true,
    getBatchKey: (data) => {
      return Sha256Hex(
        `${data.langConfig.sourceCode}-${data.langConfig.targetCode}-${data.providerConfig.id}`,
        data.context ? JSON.stringify(data.context) : "",
        data.inlineSmartFilter
          ? `inlineSmartFilter:${data.inlineSmartFilter.strategyVersion}`
          : "plainTranslation",
      )
    },
    getCharacters: data => data.text.length,
    executeBatch: async (dataList) => {
      const hash = Sha256Hex(...dataList.map(d => d.hash))
      const earliestScheduleAt = Math.min(...dataList.map(d => d.scheduleAt))

      const batchThunk = async (): Promise<string[]> => {
        if (dataList.some(d => d.inlineSmartFilter))
          return executeInlineBatchTranslation(dataList, promptResolver)
        return executeBatchTranslation(dataList, promptResolver)
      }

      return requestQueue.enqueue(batchThunk, earliestScheduleAt, hash)
    },
    executeIndividual: async (data) => {
      const { text, langConfig, providerConfig, hash, scheduleAt, context, inlineSmartFilter } = data
      const thunk = async () => {
        if (inlineSmartFilter) {
          const results = await executeInlineBatchTranslation([data], promptResolver)
          return results[0]
        }
        return executeTranslate(text, langConfig, providerConfig, promptResolver, { context })
      }
      return requestQueue.enqueue(thunk, scheduleAt, hash)
    },
    onError: (error, context) => {
      const errorType = context.isFallback ? "Individual request" : "Batch request"
      logger.error(
        `${errorType} failed (batchKey: ${context.batchKey}, retry: ${context.retryCount}):`,
        error.message,
      )
    },
  })

  return { requestQueue, batchQueue }
}

export async function setUpWebPageTranslationQueue() {
  const config = await ensureInitializedConfig()

  const { translate: { requestQueueConfig, batchQueueConfig } } = config ?? DEFAULT_CONFIG

  const { requestQueue, batchQueue } = await createTranslationQueues({
    requestQueueConfig,
    batchQueueConfig,
    promptResolver: getTranslatePrompt,
  })

  onMessage("enqueueTranslateRequest", async (message) => {
    const { data: { text, langConfig, providerConfig, scheduleAt, hash, webTitle, webDescription, webContent, webSummary, inlineSmartFilter } } = message

    // Check cache first
    if (hash) {
      const cached = await db.translationCache.get(hash)
      if (cached) {
        return normalizeTranslationOutput(providerConfig, cached.translation)
      }
    }

    let result = ""
    const context: WebPagePromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      webContent: normalizePromptContextValue(webContent),
      webSummary: normalizePromptContextValue(webSummary),
    }

    if (shouldUseBatchQueue(providerConfig)) {
      const data = { text, langConfig, providerConfig, hash, scheduleAt, context, inlineSmartFilter }
      result = await batchQueue.enqueue(data)
    }
    else {
      // Create thunk based on type and params
      const thunk = () => executeTranslate(text, langConfig, providerConfig, getTranslatePrompt)
      result = await requestQueue.enqueue(thunk, scheduleAt, hash)
    }

    // Only the merged branch may cache an empty result (an explicit skip).
    if (hash && (result || inlineSmartFilter)) {
      result = normalizeTranslationOutput(providerConfig, result)
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("getOrGenerateWebPageSummary", async (message) => {
    const { webTitle, webContent, providerConfig } = message.data

    if (!isEnabledLLMProviderConfig(providerConfig) || !webTitle || !webContent) {
      return null
    }

    return await getOrGenerateWebPageSummary(webTitle, webContent, providerConfig, requestQueue)
  })

  onMessage("setTranslateRequestQueueConfig", (message) => {
    const { data } = message
    requestQueue.setQueueOptions(data)
  })

  onMessage("setTranslateBatchQueueConfig", (message) => {
    const { data } = message
    batchQueue.setBatchConfig(data)
  })
}

/**
 * Set up subtitles translation queue and message handlers
 */
export async function setUpSubtitlesTranslationQueue() {
  const config = await ensureInitializedConfig()
  const { videoSubtitles: { requestQueueConfig, batchQueueConfig } } = config ?? DEFAULT_CONFIG

  const { requestQueue, batchQueue } = await createTranslationQueues({
    requestQueueConfig,
    batchQueueConfig,
    promptResolver: getSubtitlesTranslatePrompt,
  })

  onMessage("enqueueSubtitlesTranslateRequest", async (message) => {
    const { data: { text, langConfig, providerConfig, scheduleAt, hash, webTitle, webDescription, summary } } = message

    if (hash) {
      const cached = await db.translationCache.get(hash)
      if (cached) {
        return normalizeTranslationOutput(providerConfig, cached.translation)
      }
    }

    let result = ""
    const context: SubtitlePromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      videoSummary: normalizePromptContextValue(summary),
    }

    if (shouldUseBatchQueue(providerConfig)) {
      const data = { text, langConfig, providerConfig, hash, scheduleAt, context }
      result = await batchQueue.enqueue(data)
    }
    else {
      const thunk = () => executeTranslate(text, langConfig, providerConfig, getSubtitlesTranslatePrompt)
      result = await requestQueue.enqueue(thunk, scheduleAt, hash)
    }

    if (result && hash) {
      result = normalizeTranslationOutput(providerConfig, result)
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("getSubtitlesSummary", async (message) => {
    const { videoTitle, subtitlesContext, providerConfig } = message.data

    if (!isLLMProviderConfig(providerConfig) || !videoTitle || !subtitlesContext) {
      return null
    }

    return await getOrGenerateSubtitleSummary(videoTitle, subtitlesContext, providerConfig, requestQueue)
  })

  onMessage("microsoftBatchTranslate", async (message) => {
    const { texts, fromLang, toLang } = message.data
    const hash = Sha256Hex("ms-batch", fromLang, toLang, ...texts)
    const thunk = () => microsoftTranslate(texts, fromLang, toLang)
    return requestQueue.enqueue(thunk, Date.now(), hash)
  })

  onMessage("setSubtitlesRequestQueueConfig", (message) => {
    const { data } = message
    requestQueue.setQueueOptions(data)
  })

  onMessage("setSubtitlesBatchQueueConfig", (message) => {
    const { data } = message
    batchQueue.setBatchConfig(data)
  })
}
