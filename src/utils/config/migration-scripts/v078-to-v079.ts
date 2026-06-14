/**
 * Migration script from v078 to v079
 * - Projects the full configuration into the translation-only schema.
 *
 * IMPORTANT: All values are read from the old config and copied inline.
 * Migration scripts are frozen snapshots — never import constants or helpers
 * that may change.
 */
export function migrate(oldConfig: any): any {
  return {
    language: oldConfig?.language,
    providersConfig: oldConfig?.providersConfig,
    translate: oldConfig?.translate,
    languageDetection: oldConfig?.languageDetection,
    videoSubtitles: oldConfig?.videoSubtitles,
    siteControl: oldConfig?.siteControl,
  }
}
