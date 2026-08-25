import { langCodeISO6393Schema } from "@read-frog/definitions"
import { z } from "zod"

export const selectionTranslationConfigSchema = z.object({
  enabled: z.boolean(),
  targetCode: langCodeISO6393Schema,
  providerId: z.string().nonempty(),
})

export type SelectionTranslationConfig = z.infer<typeof selectionTranslationConfigSchema>
