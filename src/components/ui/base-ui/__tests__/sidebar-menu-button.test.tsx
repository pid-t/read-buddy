// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../sidebar"
import { TooltipProvider } from "../tooltip"

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe("sidebar menu button", () => {
  it("keeps custom rendered links clickable when tooltip is enabled", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="/api-providers" />}
                tooltip="API Providers"
              >
                <span>API Providers</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarProvider>
      </TooltipProvider>,
    )

    expect(screen.getByRole("link", { name: "API Providers" })).toHaveAttribute("href", "/api-providers")
  })
})
