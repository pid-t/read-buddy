# Product

## Register

product

## Users

Web readers and video watchers who use a browser extension to translate web pages and YouTube subtitles. They are not necessarily technical experts; they open the options page to make the extension work for their reading and watching habits.

## Product Purpose

ReadBuddy's options page is the central place for configuring translation providers, feature assignments, translation preferences, shortcuts, website rules, and subtitle styling. Success means a user can find the setting they need, change it confidently, and return to reading or watching without confusion.

## Brand Personality

- 清晰 (Clear): every screen has an obvious primary task and unambiguous labels.
- 克制 (Restrained): no decorative noise, no competing accents; visual hierarchy is built on spacing, type, and structure rather than color.
- 可信赖 (Trustworthy): settings are grouped logically, feedback is immediate, and the interface feels stable.

## Anti-references

- Unclear menu division: settings grouped by implementation detail rather than user task, or categories that overlap.
- Cluttered Chrome-style native settings: walls of labels with no visual hierarchy or progressive disclosure.
- Overly decorative SaaS dashboards: big hero metrics, gradient accents, card grids that don't help configuration.
- Competing sidebars, floating panels, or tab bars that fragment a single configuration task.

## Design Principles

1. **Group by user task, not by feature implementation.** A user thinks "translate this page" and "translate subtitles," not "background service" and "content script."
2. **One page, one purpose.** Each options page should surface the decisions that belong together; unrelated decisions go elsewhere.
3. **Progressive disclosure for advanced settings.** Show the essentials first; keep API keys, headers, and fine-grained prompts discoverable but not overwhelming.
4. **Consistent spacing and hierarchy across all pages.** Same section rhythm, same label treatment, same action placement so the UI feels like one tool.
5. **Clarity over density.** A setting with breathing room is faster to scan than a tightly packed grid of the same controls.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: 4.5:1 text contrast, focus indicators visible, labels on all form controls.
- Support keyboard navigation throughout the options page; no mouse-only interactions.
- Respect `prefers-reduced-motion`: state transitions should be instant or subtle when reduced motion is requested.
- Keep language plain; avoid untranslated technical abbreviations in primary labels.
