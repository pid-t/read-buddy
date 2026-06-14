import { db } from "@/utils/db/dexie/db"
import { logger } from "@/utils/logger"

export async function cleanupAllTranslationCache() {
  try {
    // Delete all translation cache entries
    await db.translationCache.clear()

    logger.info(`Cache cleanup: Deleted all translation cache entries`)
  }
  catch (error) {
    logger.error("Failed to cleanup all cache:", error)
    throw error
  }
}

export async function cleanupAllSummaryCache() {
  try {
    // Delete all article summary cache entries
    await db.articleSummaryCache.clear()

    logger.info(`Summary cache cleanup: Deleted all article summary cache entries`)
  }
  catch (error) {
    logger.error("Failed to cleanup all summary cache:", error)
    throw error
  }
}

export async function cleanupAllAiSegmentationCache() {
  try {
    await db.aiSegmentationCache.clear()
    logger.info("AI segmentation cache cleanup: Deleted all entries")
  }
  catch (error) {
    logger.error("Failed to cleanup all AI segmentation cache:", error)
    throw error
  }
}
