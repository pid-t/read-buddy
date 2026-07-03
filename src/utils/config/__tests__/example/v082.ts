import { testSeries as v081TestSeries } from "./v081"

/**
 * v082 removes the siteControl config. The extension now relies on site-rules
 * (auto-translate / never-auto-translate patterns) for per-site behavior.
 *
 * Each v081 config is projected to its v082 form by stripping the siteControl field.
 */
function withoutSiteControl(config: any): any {
  if (!config || typeof config !== "object") {
    return config
  }
  const { siteControl: _siteControl, ...rest } = config
  return rest
}

export const testSeries = Object.fromEntries(
  Object.entries(v081TestSeries).map(([key, value]) => [
    key,
    {
      description: value.description,
      config: withoutSiteControl(value.config),
    },
  ]),
)
