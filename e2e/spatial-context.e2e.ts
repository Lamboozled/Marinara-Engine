import { expect, test } from "@playwright/test";

const generatedDefinition = {
  schemaVersion: 1,
  ownerMode: "roleplay",
  enabled: false,
  revision: 0,
  startingLocationId: "ai_world",
  locations: [
    {
      id: "ai_world",
      parentId: null,
      name: "Shrouded Coast",
      kind: "region",
      description: "A coast hidden beneath sea fog.",
      modelMemory: "Old shipping routes conceal forgotten coves.",
      icon: "🌫️",
      childPresentation: "map",
      links: [],
      status: "active",
      sortOrder: 0,
    },
    {
      id: "ai_harbor",
      parentId: "ai_world",
      name: "Gloam Harbor",
      kind: "settlement",
      description: "A busy harbor of black piers.",
      modelMemory: "The harbor master keeps a smuggling ledger.",
      icon: "⚓",
      childPresentation: "list",
      placement: { x: 25, y: 60 },
      links: [],
      status: "active",
      sortOrder: 0,
    },
    {
      id: "ai_lighthouse",
      parentId: "ai_world",
      name: "Blackglass Lighthouse",
      kind: "building",
      description: "A dark lighthouse on the cliffs.",
      modelMemory: "Its lamp reveals hidden ink at midnight.",
      icon: "🗼",
      childPresentation: "list",
      placement: { x: 72, y: 25 },
      links: [
        {
          targetId: "ai_sewers",
          label: "Smuggler tunnel",
          bidirectional: true,
          state: "hidden",
        },
      ],
      status: "active",
      sortOrder: 1,
    },
    {
      id: "ai_sewers",
      parentId: "ai_world",
      name: "Old Sewers",
      kind: "place",
      description: "Flooded tunnels beneath the coast.",
      modelMemory: "A sealed gate leads under the lighthouse.",
      icon: "🕳️",
      childPresentation: "list",
      placement: { x: 55, y: 82 },
      links: [],
      status: "active",
      sortOrder: 2,
    },
  ],
} as const;

test("AI map builder previews a validated local draft before save", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: "AI Map Builder Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const mobile = testInfo.project.name.includes("mobile");

  await page.route(`**/api/chats/${chat.id}/spatial-context/generate`, async (route) => {
    const request = route.request().postDataJSON() as {
      size: string;
      instructions?: string;
      debugMode: boolean;
    };
    expect(request).toMatchObject({
      size: "small",
      instructions: "A foggy port with a lighthouse and secret sewers.",
      debugMode: false,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        size: "small",
        source: "roleplay_setup",
        generatedLocationCount: generatedDefinition.locations.length,
        definition: generatedDefinition,
      }),
    });
  });

  try {
    await page.addInitScript(
      ({ chatId, openEditor }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        if (!openEditor) return;
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: {
              hasCompletedOnboarding: true,
              rightPanelOpen: false,
              sidebarOpen: false,
              spatialMapDetailChatId: chatId,
            },
            version: 72,
          }),
        );
      },
      { chatId: chat.id, openEditor: mobile },
    );
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");

    if (!mobile) {
      await page.getByRole("button", { name: "Chat Settings" }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await drawer.getByText("Hierarchical map", { exact: true }).click();
      await drawer.getByRole("button", { name: "Create hierarchical map" }).click();
    }

    await page.getByRole("button", { name: "Draft with AI" }).click();
    await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toBeVisible();
    await page.getByLabel("What should this world include?").fill("A foggy port with a lighthouse and secret sewers.");
    await page.getByRole("button", { name: /Small About 8 places/ }).click();
    await page.getByRole("button", { name: "Generate draft" }).click();
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await expect(page.getByText("4 locations", { exact: true })).toBeVisible();
    await expect(page.getByText("Shrouded Coast", { exact: true })).toBeVisible();

    const beforeApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await beforeApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByRole("button", { name: "Use this draft" }).click();
    await expect(page.getByText("AI map draft applied. Review it, then Save.")).toBeVisible();
    const hierarchy = page.locator('section[aria-label="Location hierarchy"]:visible');
    await expect(hierarchy.getByRole("button", { name: "Shrouded Coast region" })).toBeVisible();

    const afterApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await afterApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByLabel("Disabled", { exact: true }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const stored = (await storedResponse.json()) as {
      definition: { enabled: boolean; locations: Array<{ name: string }> };
    };
    expect(stored.definition.enabled).toBe(true);
    expect(stored.definition.locations.map((location) => location.name)).toEqual([
      "Shrouded Coast",
      "Gloam Harbor",
      "Blackglass Lighthouse",
      "Old Sewers",
    ]);
  } finally {
    if (!mobile) await page.request.delete(`/api/chats/${chat.id}`);
  }
});
