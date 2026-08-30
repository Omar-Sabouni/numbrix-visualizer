import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const responsiveViewports = [
  { label: "wide desktop", width: 1440, height: 900 },
  { label: "portrait tablet", width: 768, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
  { label: "minimum mobile", width: 320, height: 720 },
] as const;

async function expectNoDocumentHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        return Math.ceil(Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth);
      }),
    )
    .toBeLessThanOrEqual(1);
}

async function expectPanelReachable(page: Page, selector: string): Promise<void> {
  const panel = page.locator(selector);
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible();

  const bounds = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeGreaterThan(0);
  expect(bounds.top).toBeLessThan(bounds.viewportHeight);
}

async function expectEntirelyWithinViewport(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await expect(element).toBeVisible();

  const bounds = await element.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
}

async function advanceToEvent(page: Page, label: RegExp, maximumSteps = 80): Promise<void> {
  const badge = page.locator("#traceKindBadge");
  const next = page.getByRole("button", { name: "Next frame" });
  for (let step = 0; step <= maximumSteps; step += 1) {
    if (label.test((await badge.textContent()) ?? "")) return;
    if (await next.isDisabled()) break;
    await next.click();
  }
  throw new Error(`Trace never reached event ${label}`);
}

async function boardValues(page: Page): Promise<string[]> {
  return page.locator(".board-cell").evaluateAll((cells) =>
    cells.map((cell) => (cell as HTMLInputElement).value),
  );
}

test.describe("Numbrix explorable explanation", () => {
  test("introduces the algorithm and keeps the editor keyboard accessible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Numbrix", level: 1 })).toBeVisible();
    await expect(page.locator("#explanationPanel")).toBeVisible();

    const inspectors = [
      { selector: ".domain-inspector", heading: "Candidate cells" },
      { selector: ".algorithm-inspector", heading: "Pseudocode" },
      { selector: ".structure-inspector", heading: "Decision stack" },
    ] as const;
    for (const inspector of inspectors) {
      const details = page.locator(inspector.selector);
      await expect(details).not.toHaveAttribute("open", "");
      await details.locator("summary").focus();
      await details.locator("summary").press("Enter");
      await expect(details).toHaveAttribute("open", "");
      await expect(page.getByRole("heading", { name: inspector.heading })).toBeVisible();
      await details.locator("summary").press("Enter");
      await expect(details).not.toHaveAttribute("open", "");
    }

    await page.locator(".skip-link").focus();
    await page.locator(".skip-link").press("Enter");
    await expect(page.locator("#boardHeading")).toBeFocused();
    await expect(page.locator("#algorithmPhase")).toHaveText("Ready");
    await expect(page.locator("#algorithmCode")).not.toHaveAttribute("data-active-line");
    await expect(page.locator("#domainSummary")).toHaveText("No value selected");
    await expect(page.locator("#propagationScan")).toHaveAttribute(
      "data-strategy",
      "fixpoint-scan",
    );
    await expect(page.locator("#decisionStack")).toHaveAttribute("data-depth", "0");

    const size = page.getByLabel("Size", { exact: true });
    const values = await size.locator("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
    expect(values).toEqual(Array.from({ length: 13 }, (_, index) => String(index + 3)));

    await size.selectOption("3");
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(9);

    const first = page.getByRole("textbox", { name: "Row 1, column 1" });
    const right = page.getByRole("textbox", { name: "Row 1, column 2" });
    const down = page.getByRole("textbox", { name: "Row 2, column 2" });
    await first.focus();
    await first.press("ArrowRight");
    await expect(right).toBeFocused();
    await right.press("ArrowDown");
    await expect(down).toBeFocused();
  });

  test("synchronizes board, pseudocode, domains, scans, and rollback while replaying", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByLabel("Example")).toHaveValue("s5-backtracking-lab");
    await expect(page.getByRole("textbox")).toHaveCount(25);
    await page.getByRole("button", { name: "Solve", exact: true }).click();
    await expect(page.locator("#statusMessage")).toContainText(/solved/i, { timeout: 10_000 });

    await expect(page.locator("#boardModeLabel")).toHaveText("Search replay");
    await expect(page.getByRole("button", { name: "Replay search" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#traceKindBadge")).toHaveText("Initialize");
    await expect(page.locator("#algorithmPhase")).toHaveAttribute(
      "data-phase",
      "initialize-domains",
    );
    await expect(page.locator("#algorithmPhase")).toHaveText("Initialize domains");
    await expect(
      page.locator('[data-code-line="seed-candidate-domains"]'),
    ).toHaveAttribute("aria-current", "step");
    await expect(page.locator("#algorithmExplanation")).toContainText(
      /where each of the 25 numbers/i,
    );
    await expect(page.locator("#domainSummary")).toHaveText("No value selected");
    await expect(page.locator('#propagationScan dt', { hasText: "passes" }).locator("+ dd"))
      .toHaveText("0");
    await expect(page.locator("#decisionStack")).toHaveAttribute("data-depth", "0");

    await page.getByRole("button", { name: "Next frame" }).click();
    await expect(page.locator("#traceKindBadge")).toHaveText("Forced");
    await expect(page.locator("#algorithmPhase")).toHaveAttribute(
      "data-phase",
      "propagate-constraints",
    );
    await expect(page.locator("#algorithmCode [aria-current=step]")).toHaveCount(1);
    await expect(page.locator("#algorithmExplanation")).toContainText(/Filled in everything forced/i);
    await expect
      .poll(async () => Number(await page.locator("#propagationScan dd").first().textContent()))
      .toBeGreaterThan(0);
    await expect(page.locator("#domainDeltas")).toContainText(/candidate/i);

    await advanceToEvent(page, /^Select value$/);
    const selectionIndex = Number(await page.locator("#traceScrubber").inputValue());
    const selectionSummary = (await page.locator("#domainSummary").textContent()) ?? "";
    const selectionExplanation = (await page.locator("#algorithmExplanation").textContent()) ?? "";
    const selectionBoard = await boardValues(page);
    const selectionCandidates = await page
      .locator(".cell-slot[data-candidate=true]")
      .evaluateAll((slots) => slots.map((slot) => (slot as HTMLElement).dataset.index));

    await expect(page.locator("#algorithmPhase")).toHaveAttribute("data-phase", "select-variable");
    await expect(page.locator('[data-code-line="select-minimum-domain"]')).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(selectionSummary).toMatch(/^\d+ can go in \d+ squares?$/);
    expect(selectionCandidates.length).toBeGreaterThan(1);
    await expect(page.locator("#domainCandidates .candidate-chip")).toHaveCount(
      selectionCandidates.length,
    );
    await expect(page.locator("#decisionStack")).toHaveAttribute("data-depth", "0");

    await advanceToEvent(page, /^Decision$/);
    await expect(page.locator("#algorithmPhase")).toHaveAttribute("data-phase", "try-candidate");
    await expect(page.locator('[data-code-line="assign-candidate"]')).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.locator("#algorithmExplanation")).toContainText(/Guess 1 of/i);
    await expect(page.locator("#domainSummary")).toContainText(/in 1 square$/);
    await expect(page.locator("#domainCandidates .candidate-chip")).toHaveCount(1);
    await expect(page.locator("#decisionStack")).toHaveAttribute("data-depth", "1");
    await expect(page.locator("#decisionStack li[data-depth=\"1\"]")).toHaveCount(1);
    await expect(page.locator(".cell-slot[data-active-candidate=true]")).toHaveCount(1);

    await advanceToEvent(page, /^Contradiction$/);
    await expect(page.locator("#algorithmPhase")).toHaveAttribute(
      "data-phase",
      "detect-contradiction",
    );
    await expect(page.locator("#algorithmCode [aria-current=step]")).toHaveCount(1);
    await expect(page.locator("#algorithmExplanation")).not.toHaveText("");

    await advanceToEvent(page, /^Backtrack$/);
    await expect(page.locator("#algorithmPhase")).toHaveAttribute("data-phase", "undo-branch");
    await expect(page.locator('[data-code-line="rollback-trail"]')).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.locator("#domainDeltas")).toContainText(/restored/i);
    await expect
      .poll(async () => Number(await page.locator("#domainDeltas").getAttribute("data-changed-candidates")))
      .toBeGreaterThan(0);
    await expect(page.locator(".cell-slot[data-domain-change=restore]").first()).toBeVisible();
    await expect(page.locator(".cell-slot[data-active-candidate=true]")).toHaveCount(0);

    await page.locator("#traceScrubber").fill(String(selectionIndex));
    await expect(page.locator("#traceKindBadge")).toHaveText("Select value");
    await expect(page.locator("#domainSummary")).toHaveText(selectionSummary);
    await expect(page.locator("#algorithmExplanation")).toHaveText(selectionExplanation);
    await expect.poll(() => boardValues(page)).toEqual(selectionBoard);
    await expect
      .poll(() =>
        page
          .locator(".cell-slot[data-candidate=true]")
          .evaluateAll((slots) => slots.map((slot) => (slot as HTMLElement).dataset.index)),
      )
      .toEqual(selectionCandidates);

    await page.locator(".playback-options summary").click();
    await page.locator("#traceSpeed").fill("1");
    await page.getByRole("button", { name: "First frame" }).click();
    await page.getByRole("button", { name: "Play trace" }).click();
    await expect(page.locator("#explanationPanel")).toHaveAttribute("aria-live", "off");
    await page.getByRole("button", { name: "Pause trace" }).click();
    await expect(page.locator("#explanationPanel")).toHaveAttribute("aria-live", "polite");

    await page.getByRole("button", { name: "Solution", exact: true }).click();
    await expect(page.locator("#boardModeLabel")).toHaveText("Solved grid");
    await expect(page.locator("#algorithmPhase")).toHaveAttribute("data-phase", "finish");
    await expect(page.locator('[data-code-line="report-search-result"]')).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.locator("#domainSummary")).toHaveText("No value selected");
  });

  test("solves a complete custom grid and exposes the recording", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Size", { exact: true }).selectOption("3");
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    const solution = [1, 2, 3, 6, 5, 4, 7, 8, 9];
    for (let index = 0; index < solution.length; index += 1) {
      const row = Math.floor(index / 3) + 1;
      const column = (index % 3) + 1;
      await page
        .getByRole("textbox", { name: `Row ${row}, column ${column}` })
        .fill(String(solution[index]));
    }

    await page.getByRole("button", { name: "Solve", exact: true }).click();
    await expect(page.locator("#statusMessage")).toContainText(/solved/i, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Copy grid" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Replay search" })).toBeEnabled();
    await page.getByRole("button", { name: "Replay search" }).click();
    await expect(page.locator("#traceCounter")).not.toHaveText("0 of 0");
  });

  test("cancels an active worker solve without changing the puzzle", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Size", { exact: true }).selectOption("15");
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await page.getByRole("button", { name: "Solve", exact: true }).click();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancel).toBeEnabled();
    await cancel.click();

    await expect(page.locator("#statusMessage")).toContainText(/cancelled/i);
    await expect(page.getByRole("textbox")).toHaveCount(225);
    await expect(page.getByRole("button", { name: "Solve", exact: true })).toBeEnabled();
  });
});

test.describe("responsive workspace", () => {
  for (const viewport of responsiveViewports) {
    test(`keeps every core panel reachable on ${viewport.label} (${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");

      await expectNoDocumentHorizontalOverflow(page);

      for (const selector of [
        "#boardViewport",
        "#explanationPanel",
        "#tracePanel",
        ".counts-inspector > summary",
        ".inspector-panels",
      ]) {
        await expectPanelReachable(page, selector);
      }

      await expect(page.locator(".inspector-details[open]")).toHaveCount(0);

      await expectNoDocumentHorizontalOverflow(page);
    });
  }

  test("keeps mobile settings, playback options, and the paste dialog inside the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const settings = page.locator("details.advanced-settings");
    await settings.locator("summary").click();
    await expect(settings).toHaveAttribute("open", "");
    await expectEntirelyWithinViewport(page, "details.advanced-settings");

    const playbackOptions = page.locator("details.playback-options");
    await playbackOptions.locator("summary").click();
    await expect(playbackOptions).toHaveAttribute("open", "");
    await expectEntirelyWithinViewport(page, "details.playback-options");

    await page.getByRole("button", { name: "Paste grid" }).click();
    await expect(page.locator("#pasteDialog")).toHaveAttribute("open", "");
    await expectEntirelyWithinViewport(page, "#pasteDialog");
    await expectEntirelyWithinViewport(page, "#pasteDialog textarea");
    await page.getByRole("button", { name: "Close paste dialog" }).click();

    for (const selector of [
      ".domain-inspector",
      ".algorithm-inspector",
      ".structure-inspector",
    ]) {
      const details = page.locator(selector);
      await details.locator("summary").click();
      await expect(details).toHaveAttribute("open", "");
      await expectPanelReachable(page, selector);
      await details.locator("summary").click();
    }

    await expectNoDocumentHorizontalOverflow(page);
  });

  test("contains a 15x15 board in its mobile scroll viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByLabel("Size", { exact: true }).selectOption("15");
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    const boardViewport = page.locator("#boardViewport");
    await expectPanelReachable(page, "#boardViewport");
    const dimensions = await boardViewport.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    expect(dimensions.scrollLeft).toBe(0);
    await expectNoDocumentHorizontalOverflow(page);

    await boardViewport.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect
      .poll(() => boardViewport.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(0);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("keeps controls and evidence available at 200% text size", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    const settings = page.locator("details.advanced-settings");
    await settings.locator("summary").click();
    await expect(settings).toHaveAttribute("open", "");
    for (const selector of [
      ".domain-inspector",
      ".algorithm-inspector",
      ".structure-inspector",
    ]) {
      await page.locator(`${selector} > summary`).click();
    }
    await expectNoDocumentHorizontalOverflow(page);

    for (const selector of [
      ".control-strip",
      "#boardViewport",
      "#tracePanel",
      "#explanationPanel",
      ".algorithm-card",
      ".structure-grid",
      ".counts-inspector > summary",
    ]) {
      await expectPanelReachable(page, selector);
    }

    await expectNoDocumentHorizontalOverflow(page);
  });
});

test("draws only real consecutive links in the board currently on screen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Size", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Clear", exact: true }).click();

  const solution = [1, 2, 3, 6, 5, 4, 7, 8, 9];
  for (let index = 0; index < solution.length; index += 1) {
    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    await page
      .getByRole("textbox", { name: `Row ${row}, column ${column}` })
      .fill(String(solution[index]));
  }

  await expect(page.locator(".cell-slot[data-path-out]")).toHaveCount(8);
  await expect(page.locator(".cell-slot[data-path-in]")).toHaveCount(8);
  await expect(page.locator('.cell-slot[data-index="0"]')).toHaveAttribute("data-path-out", "right");
  await expect(page.locator('.cell-slot[data-index="2"]')).toHaveAttribute("data-path-out", "down");
  await expect(page.locator('.cell-slot[data-index="3"]')).toHaveAttribute("data-path-out", "down");

  await page.getByRole("textbox", { name: "Row 1, column 2" }).fill("");
  await expect(page.locator(".cell-slot[data-path-out]")).toHaveCount(6);
  await expect(page.locator('.cell-slot[data-index="0"]')).not.toHaveAttribute("data-path-out", /.+/);
});

test("has no automatically detectable accessibility violations in edit and replay states", async ({
  page,
}) => {
  await page.goto("/");

  const editState = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(editState.violations).toEqual([]);

  await page.getByRole("button", { name: "Solve", exact: true }).click();
  await expect(page.locator("#statusMessage")).toContainText(/solved/i, { timeout: 10_000 });

  for (const selector of [
    ".domain-inspector",
    ".algorithm-inspector",
    ".structure-inspector",
  ]) {
    await page.locator(`${selector} > summary`).click();
  }

  const replayState = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(replayState.violations).toEqual([]);
});
