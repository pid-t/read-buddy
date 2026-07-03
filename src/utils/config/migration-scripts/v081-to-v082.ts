/**
 * Migration script from v081 to v082
 * - Removes the siteControl config. The extension now relies on site-rules
 *   (auto-translate / never-auto-translate patterns) for per-site behavior.
 */
export function migrate(oldConfig: any): any {
  const { siteControl: _siteControl, ...rest } = oldConfig
  return rest
}
