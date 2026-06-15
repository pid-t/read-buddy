/**
 * Migration script from v079 to v080
 * - Removes the legacy built-in Hacker News auto-translate pattern.
 *
 * Migration scripts are frozen snapshots. Keep values inline.
 */
const LEGACY_HACKER_NEWS_AUTO_TRANSLATE_PATTERN = "news.ycombinator.com"

export function migrate(oldConfig: any): any {
  const pageConfig = oldConfig?.translate?.page
  const autoTranslatePatterns = pageConfig?.autoTranslatePatterns

  if (!Array.isArray(autoTranslatePatterns)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      page: {
        ...pageConfig,
        autoTranslatePatterns: autoTranslatePatterns.filter(
          (pattern: any) => pattern !== LEGACY_HACKER_NEWS_AUTO_TRANSLATE_PATTERN,
        ),
      },
    },
  }
}
