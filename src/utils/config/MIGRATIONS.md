# Config Schema Migrations

Configuration lives in `local` storage under the `config` key, alongside a
`ConfigMeta` (`{ schemaVersion, lastModifiedAt }`). When the config schema
changes in a backward-incompatible way, the stored config from an older
schema must be migrated before it can be used.

ReadBuddy has not shipped a public release yet, so the schema is pinned to
**v1** and **no migration scripts exist**. Newly written or dev-installed
copies are simply cleaned by `configSchema.safeParse` (Zod strips unknown
fields). Once a public release exists, every schema change MUST ship a
migration script so existing users' stored configs keep working.

## How migration works at runtime

`src/utils/config/migration.ts`:

1. `import.meta.glob("./migration-scripts/v*-to-v*.ts", { import: "migrate" })`
   auto-discovers every `vNNN-to-vMMM.ts` file. No manual registration.
2. `migrationScripts` maps `toVersion -> migrate`. The loader validates:
   - `toVersion === fromVersion + 1` (single-step)
   - no duplicate `toVersion`
   - no gaps in the chain (every `fromVersion` must itself be a target)
3. `migrateConfig(originalConfig, originalVersion)` runs the chain
   `originalVersion+1 → ... → LATEST`, then `configSchema.safeParse`.
4. `initializeConfig()` (background script) does the same for stored configs
   and also falls back to `DEFAULT_CONFIG` if the stored value fails to parse.

> **Importing a config file** goes through `migrateConfig`, which rejects
> configs whose version is **newer** than `CONFIG_SCHEMA_VERSION`
> (`ConfigVersionTooNewError`). Stored dev configs older than v1 are simply
> stripped by Zod — no migration script is invoked because `LATEST == 1`.

## Standard procedure for a schema change

> The auto-discovery tests (`__tests__/migration-scripts/all-migrations.test.ts`
> and `__tests__/config.test.ts`) iterate from version 2 to
> `LATEST_SCHEMA_VERSION`. They enforce the invariant below — if you skip a
> step, tests fail.

1. **Change the schema** in `src/types/config/*` (e.g. add/rename/remove a
   field or change defaults).
2. **Bump the version** in `src/utils/constants/config.ts`:
   ```ts
   export const CONFIG_SCHEMA_VERSION = 2; // was 1
   ```
3. **Add the migration script**:
   `src/utils/config/migration-scripts/v001-to-v002.ts`:

   ```ts
   /**
    * v001 -> v002: <one-line description of the change>
    */
   export function migrate(oldConfig: any): any {
     // Guard against nullish/non-object input — sibling migrations rely on
     // this. The migration runner should never crash the whole chain.
     if (!oldConfig || typeof oldConfig !== "object") {
       return oldConfig;
     }
     const { removedField: _removedField, ...rest } = oldConfig;
     return { ...rest, newField: defaultValue };
   }
   ```

   - Migration scripts are **frozen snapshots**. Never `import` constants or
     helpers that may change later — inline every value (see existing
     siblings, e.g. `v078-to-v079`).
   - Keep the no-op-safe pattern: idempotent and pure.

4. **Add the test example** (multi-series):
   `src/utils/config/__tests__/example/v002.ts`:

   ```ts
   import type { TestSeriesObject } from "./types";

   export const testSeries: TestSeriesObject = {
     // Reuse the same series id(s) present in v001 so the migration test can
     // compare v001 -> v002 series-by-series.
     default: {
       description: "Standard config migrated to v002",
       config: {
         // The EXPECTED shape after migration (i.e. the post-migration form
         // of v001's `default` series config).
       },
     },
     // Optional: add edge-case series (empty values, boundary numbers,
     // unicode, etc.) — only those with matching ids in BOTH versions are
     // tested.
   };
   ```

5. **Run verification** — no test edits required, the harness is automatic:

   ```bash
   pnpm type-check && pnpm lint && pnpm test

   ```

   - `all-migrations.test.ts` asserts `runMigration(2, oldConfig)` equals
     `v002.testSeries[id].config` for each shared series id.
   - It also asserts `configSchema.safeParse(...)` succeeds on every series
     in the latest example file.
   - `config.test.ts` asserts API-key stripping works on the new example.

## Conventions

- **Version numbers start at 1** and increment by exactly 1. No gaps, no
  jumps.
- **One migration file per version bump**, named `vNNN-to-vMMM.ts` with
  zero-padded three-digit numbers (e.g. `v001-to-v002.ts`, `v012-to-v013.ts`).
- **Never edit an already-shipped migration.** Add a new one instead — a
  user's stored config may have already passed through the old version.
- **Example files mirror the post-migration shape**, not the pre-migration.
  Each series in `vNNN+1` must be the result of feeding the matching series
  in `vNNN` through `migrate()`.
- **Series ids are the contract across versions.** A series is only
  migration-tested if the same id exists in both consecutive version files.
  Keep stable ids (`default`, edge-case slugs) across the chain.

## Reference layout

```
src/utils/config/
  migration.ts                 # runner + loader (do not edit per-change)
  constants/config.ts          # CONFIG_SCHEMA_VERSION (bump here)
  migration-scripts/
    types.ts
    v001-to-v002.ts            # add this when bumping 1 -> 2
  __tests__/
    migration-scripts/
      all-migrations.test.ts   # auto-discovery (do not edit per-change)
      README.md                # test-system docs
    example/
      types.ts
      v001.ts                  # baseline (mirrors DEFAULT_CONFIG)
      v002.ts                  # add this when bumping 1 -> 2

```
