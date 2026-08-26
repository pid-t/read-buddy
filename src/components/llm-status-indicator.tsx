interface LLMStatusIndicatorProps {
  enabled: boolean
  hasLLMProvider: boolean
  disabledText: string
  enabledText: string
  noProviderText: string
}

export function LLMStatusIndicator({ enabled, hasLLMProvider, disabledText, enabledText, noProviderText }: LLMStatusIndicatorProps) {
  const status = !enabled
    ? { color: "bg-gray-400", text: disabledText }
    : hasLLMProvider
      ? { color: "bg-green-500", text: enabledText }
      : { color: "bg-orange-400", text: noProviderText }

  return (
    <div className="flex items-center gap-1.5 mt-2" role="status" aria-live="polite" aria-atomic="true">
      <div className={`size-2 rounded-full ${status.color}`} aria-hidden="true" />
      <span className="text-xs">{status.text}</span>
    </div>
  )
}
