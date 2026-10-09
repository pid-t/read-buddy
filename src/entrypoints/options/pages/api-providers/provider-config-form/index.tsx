import { useStore } from "@tanstack/react-form"
import { useAtom, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { isAPIProviderConfig, isLLMProvider, isTranslateProvider } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { makeProviderUnavailableAtom, providerConfigAtom } from "@/utils/atoms/provider"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { selectedProviderIdAtom } from "../atoms"
import { duplicateProvider } from "../utils"
import { APIKeyField } from "./api-key-field"
import { BaseURLField } from "./base-url-field"
import { AdvancedOptionsSection } from "./components/advanced-options-section"
import { ConfigHeader } from "./config-header"
import { formOpts, useAppForm } from "./form"
import { ProviderHeadersField } from "./provider-headers-field"
import { ProviderOptionsField } from "./provider-options-field"
import { chooseNextProviderConfig } from "./provider-selection"
import { ProviderSpecificSettingsField } from "./provider-specific-settings-field"
import { TemperatureField } from "./temperature-field"
import { TranslateModelSelector } from "./translate-model-selector"

export function ProviderConfigForm() {
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const [providerConfig, setProviderConfig] = useAtom(providerConfigAtom(selectedProviderId ?? ""))
  const [allProvidersConfig, setAllProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const makeProviderUnavailable = useSetAtom(makeProviderUnavailableAtom)

  const specificFormOpts = {
    ...formOpts,
    defaultValues: providerConfig && isAPIProviderConfig(providerConfig) ? providerConfig : undefined,
  }

  const form = useAppForm({
    ...specificFormOpts,
    onSubmit: async ({ value }) => {
      void setProviderConfig(value)
    },
  })

  const providerType = useStore(form.store, state => state.values.provider)
  const isTranslateProviderType = isTranslateProvider(providerType)
  const isLLM = isLLMProvider(providerType)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    if (providerConfig && isAPIProviderConfig(providerConfig)) {
      form.reset(providerConfig)
    }
  }, [providerConfig, form])

  if (!providerConfig || !isAPIProviderConfig(providerConfig)) {
    return null
  }

  const handleDuplicate = async () => {
    await duplicateProvider(providerConfig, allProvidersConfig, setAllProvidersConfig, setSelectedProviderId)
  }

  const handleDelete = async () => {
    const plan = await makeProviderUnavailable({ providerId: providerConfig.id, operation: "delete" })
    if (plan.status === "blocked") {
      toast.error(i18n.t("options.apiProviders.form.atLeastOneTranslationProvider"))
      return
    }

    setSelectedProviderId(chooseNextProviderConfig(plan.providersConfig)?.id)
  }

  return (
    <form.AppForm>
      <div className={cn("flex-1 bg-card rounded-xl p-4 border flex flex-col justify-between", selectedProviderId !== providerConfig.id && "hidden")}>
        <div className="flex flex-col gap-4">
          <ConfigHeader providerType={providerType} />
          <form.AppField
            name="name"
            validators={{
              onChange: ({ value }) => {
                const duplicateProvider = allProvidersConfig.find(provider =>
                  provider.name === value && provider.id !== providerConfig.id,
                )
                if (duplicateProvider) {
                  return i18n.t("options.apiProviders.form.duplicateProviderName", [value])
                }
                return undefined
              },
            }}
          >
            {field => <field.InputFieldAutoSave formForSubmit={form} label={i18n.t("options.apiProviders.form.fields.name")} />}
          </form.AppField>
          <form.AppField name="description">
            {field => <field.InputFieldAutoSave formForSubmit={form} label={i18n.t("options.apiProviders.form.fields.description")} />}
          </form.AppField>

          <APIKeyField form={form} />
          <BaseURLField form={form} />
          <ProviderSpecificSettingsField form={form} />
          {isTranslateProviderType && (
            <TranslateModelSelector form={form} />
          )}
          {isLLM && (
            <AdvancedOptionsSection>
              <TemperatureField form={form} />
              <ProviderOptionsField form={form} />
              <ProviderHeadersField form={form} />
            </AdvancedOptionsSection>
          )}
        </div>
        <div className="flex justify-between mt-8">
          <Button type="button" variant="outline" onClick={handleDuplicate}>
            {i18n.t("options.apiProviders.form.duplicate")}
          </Button>
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
              {i18n.t("options.apiProviders.form.delete")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{i18n.t("options.apiProviders.form.deleteDialog.title")}</AlertDialogTitle>
                <AlertDialogDescription>{i18n.t("options.apiProviders.form.deleteDialog.description")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t("options.apiProviders.form.deleteDialog.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>{i18n.t("options.apiProviders.form.deleteDialog.confirm")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </form.AppForm>
  )
}
