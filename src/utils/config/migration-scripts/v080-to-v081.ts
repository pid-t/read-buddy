/**
 * Migration script from v080 to v081
 * - Adds optional options UI locale preference.
 *
 * Existing configs keep following the browser UI language until the user selects
 * a language in options.
 */
export function migrate(oldConfig: any): any {
  return oldConfig
}
