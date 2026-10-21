import type { MigrationFunction } from "./types"

const DEFAULT_SMART_FILTER = {
  enableAI: false,
  providerId: null,
}

/** Add the AI smart filter settings without changing existing translation settings. */
export const migrate: MigrationFunction = (input) => {
  const config = (input && typeof input === "object" ? input : {}) as Record<string, any>
  const translate = (config.translate && typeof config.translate === "object" ? config.translate : {}) as Record<string, any>
  const page = (translate.page && typeof translate.page === "object" ? translate.page : {}) as Record<string, any>
  const smartFilter = (page.smartFilter && typeof page.smartFilter === "object" ? page.smartFilter : {}) as Record<string, any>

  return {
    ...config,
    translate: {
      ...translate,
      page: {
        ...page,
        smartFilter: {
          enableAI: typeof smartFilter.enableAI === "boolean" ? smartFilter.enableAI : DEFAULT_SMART_FILTER.enableAI,
          providerId: typeof smartFilter.providerId === "string" ? smartFilter.providerId : DEFAULT_SMART_FILTER.providerId,
        },
      },
    },
  }
}
