import { test, expect } from "@playwright/test";

async function waitApp(page) {
  await page.goto("/?v=pw");
  await page.waitForFunction(() => window.__GEO_TEST__?.byKey?.size > 0, null, {
    timeout: 20_000,
  });
}

test.describe("Geo Hà Nội handover checks", () => {
  test("loads 23 tổ dân phố, no duplicate số 6", async ({ page }) => {
    await waitApp(page);
    const info = await page.evaluate(() => {
      const entries = [...window.__GEO_TEST__.byKey.values()];
      const nums = entries.map((e) => e.props.to_dan_pho);
      return {
        count: entries.length,
        nums,
        dup6: nums.filter((n) => n === 6).length,
        units: document.getElementById("city-units")?.textContent || "",
      };
    });
    expect(info.count).toBe(23);
    expect(info.dup6).toBe(1);
    expect(info.units.toLowerCase()).toContain("đống đa");
  });

  test("initial view fits Đống Đa area", async ({ page }) => {
    await waitApp(page);
    const fit = await page.evaluate(() => {
      const api = window.__GEO_TEST__;
      const wardBounds = api.dongDaBounds;
      const mb = api.map.getBounds();
      const featH = wardBounds.getNorth() - wardBounds.getSouth();
      const viewH = mb.getNorth() - mb.getSouth();
      const featW = wardBounds.getEast() - wardBounds.getWest();
      const viewW = mb.getEast() - mb.getWest();
      return {
        zoom: api.map.getZoom(),
        containsCenter: mb.contains(wardBounds.getCenter()),
        heightRatio: viewH / featH,
        widthRatio: viewW / featW,
      };
    });
    expect(fit.containsCenter).toBe(true);
    expect(fit.zoom).toBeGreaterThanOrEqual(14);
    expect(fit.heightRatio).toBeLessThan(3.5);
    expect(fit.widthRatio).toBeLessThan(3.5);
  });

  test("each tổ has its own color on list and polygon", async ({ page }) => {
    await waitApp(page);
    const colors = await page.evaluate(() => {
      const api = window.__GEO_TEST__;
      const e1 = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 1);
      const e2 = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 2);
      return {
        c1: e1.color,
        c2: e2.color,
        fill1: e1.layer.options.fillColor,
        fill2: e2.layer.options.fillColor,
        expected1: api.colorForTdp(1),
        expected2: api.colorForTdp(2),
      };
    });
    expect(colors.c1).toBe(colors.expected1);
    expect(colors.c2).toBe(colors.expected2);
    expect(colors.c1).not.toBe(colors.c2);
    expect(colors.fill1).toBe(colors.c1);
    expect(colors.fill2).toBe(colors.c2);
  });

  test("select Tổ 1 zooms in to fit polygon on screen", async ({ page }) => {
    await waitApp(page);

    const before = await page.evaluate(() => ({
      zoom: window.__GEO_TEST__.map.getZoom(),
    }));

    await page.evaluate(() => {
      window.__GEO_TEST__.selectByLabel("Tổ dân phố số 1");
    });
    await page.waitForFunction(
      () => window.__GEO_TEST__.map.getZoom() >= 16,
      null,
      { timeout: 5000 }
    );

    const after = await page.evaluate(() => {
      const api = window.__GEO_TEST__;
      const entry = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 1);
      const fb = entry.layer.getBounds();
      const mb = api.map.getBounds();
      const featH = fb.getNorth() - fb.getSouth();
      const viewH = mb.getNorth() - mb.getSouth();
      const featW = fb.getEast() - fb.getWest();
      // Side panel covers the left of the map on desktop: compare against the visible part only
      const panelW = document.getElementById("panel").getBoundingClientRect().width;
      const viewW = (mb.getEast() - mb.getWest()) * ((innerWidth - panelW) / innerWidth);
      return {
        zoom: api.map.getZoom(),
        contains: mb.contains(fb.getCenter()),
        heightRatio: viewH / featH,
        widthRatio: viewW / featW,
        activeLabel: document.querySelector("#ward-list li.active")?.textContent?.trim(),
      };
    });

    expect(after.activeLabel).toContain("Tổ dân phố số 1");
    expect(after.contains).toBe(true);
    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect(after.heightRatio).toBeLessThan(5);
    expect(after.widthRatio).toBeLessThan(5);
    expect(after.zoom).toBeGreaterThanOrEqual(16);
  });

  test("accent-insensitive search finds Đống Đa tổ", async ({ page }) => {
    await waitApp(page);
    await page.fill("#search", "to dan pho so 1");
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll("#ward-list li")]
        .filter((li) => !li.classList.contains("hidden"))
        .map((li) => li.querySelector(".li-name").textContent.trim())
    );
    expect(visible).toEqual(["Tổ dân phố số 1"]);
  });

  test("POI layers load inside the ward and chips toggle them", async ({ page }) => {
    await waitApp(page);
    await page.waitForFunction(() => window.__GEO_TEST__.pois.length > 0);
    const before = await page.locator(".leaflet-marker-pane .poi--school").count();
    expect(before).toBeGreaterThan(0);
    await page.click('.chip[data-poi="school"]');
    await expect(page.locator(".leaflet-marker-pane .poi--school")).toHaveCount(0);
    await expect(page.locator('.chip[data-poi="school"]')).toHaveAttribute("aria-pressed", "false");
  });

  test("detail panel replaces list and back returns to list", async ({ page }) => {
    await waitApp(page);
    await page.evaluate(() => window.__GEO_TEST__.selectByLabel("Tổ dân phố số 3"));
    await expect(page.locator("#detail")).toBeVisible();
    await expect(page.locator("#list-view")).toBeHidden();
    await expect(page.locator("#detail h2")).toHaveText("Tổ dân phố số 3");
    await page.click(".d-back");
    await expect(page.locator("#list-view")).toBeVisible();
    await expect(page.locator("#detail")).toBeHidden();
  });

  test("selected stroke is thicker than idle, same hue", async ({ page }) => {
    await waitApp(page);
    const weights = await page.evaluate(async () => {
      const api = window.__GEO_TEST__;
      const move = api.awaitMoveEnd();
      api.selectByLabel("Tổ dân phố số 1");
      await move;
      const selected = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 1);
      const other = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 2);
      return {
        selectedW: selected.layer.options.weight,
        otherW: other.layer.options.weight,
        selectedColor: selected.layer.options.color,
        fill: selected.layer.options.fillColor,
        expected: selected.color,
      };
    });
    expect(weights.selectedW).toBeGreaterThanOrEqual(4);
    expect(weights.selectedW).toBeGreaterThan(weights.otherW);
    expect(weights.fill).toBe(weights.expected);
  });

  test("detail sheet links to to.html?n= and page loads", async ({ page }) => {
    await waitApp(page);
    await page.evaluate(() => window.__GEO_TEST__.selectByLabel("Tổ dân phố số 3"));
    const href = await page.getAttribute(".detail-actions .btn-primary", "href");
    expect(href).toBe("to.html?n=3");

    await page.goto("/to.html?n=3");
    await expect(page.locator("h1")).toContainText("Tổ dân phố số 3");
    await expect(page.locator("#mini-map .leaflet-overlay-pane path").first()).toBeVisible();
    await expect(page.locator(".col-side .card").first()).toContainText("Diện tích");
    await expect(page.locator("#places .place").first()).toBeVisible();
    await page.goto("/to.html?n=2"); // tổ without POIs still shows the section
    await expect(page.locator("#places")).toContainText("Chưa ghi nhận");
    await page.goto("/to.html?n=3");
    await expect(page.locator(".brand-back")).toHaveAttribute("href", "index.html#tdp-3");
  });
});
