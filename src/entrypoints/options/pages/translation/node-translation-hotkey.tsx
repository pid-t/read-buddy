import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { HOTKEY_ICONS, HOTKEYS } from "@/utils/constants/hotkeys"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

export function NodeTranslationHotkey() {
  const [translateConfig, setTranslateConfig] = useAtom(
    configFieldsAtomMap.translate,
  )

  return (
    <ConfigCard
      id="node-translation-hotkey"
      title={i18n.t("options.translation.nodeTranslationHotkey.title")}
      description={i18n.t("options.translation.nodeTranslationHotkey.description")}
    >
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent className="self-center">
            <FieldLabel htmlFor="node-translation-hotkey-toggle">
              {i18n.t("options.translation.nodeTranslationHotkey.enable")}
            </FieldLabel>
          </FieldContent>
          <Switch
            id="node-translation-hotkey-toggle"
            checked={translateConfig.node.enabled}
            onCheckedChange={(checked) => {
              void setTranslateConfig(
                deepmerge(translateConfig, { node: { enabled: checked } }),
              )
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="node-translation-hotkey-select">
            {i18n.t("options.translation.nodeTranslationHotkey.shortcut")}
          </FieldLabel>
          <Select
            value={translateConfig.node.hotkey}
            onValueChange={(value: typeof HOTKEYS[number] | null) => {
              if (!value)
                return
              void setTranslateConfig(
                deepmerge(translateConfig, { node: { hotkey: value } }),
              )
            }}
            disabled={!translateConfig.node.enabled}
          >
            <SelectTrigger
              id="node-translation-hotkey-select"
              className={`w-full ${!translateConfig.node.enabled ? "opacity-50 pointer-events-none" : ""}`}
            >
              <SelectValue render={<span />}>
                {HOTKEY_ICONS[translateConfig.node.hotkey]}
                {" "}
                {i18n.t(`hotkey.${translateConfig.node.hotkey}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {HOTKEYS.map(item => (
                  <SelectItem key={item} value={item}>
                    {HOTKEY_ICONS[item]}
                    {" "}
                    {i18n.t(`hotkey.${item}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </ConfigCard>
  )
}
