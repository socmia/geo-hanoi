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
        note: document.getElementById("layer-note")?.textContent || "",
      };
    });
    expect(info.count).toBe(23);
    expect(info.dup6).toBe(1);
    expect(info.note.toLowerCase()).toContain("đống đa");
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

    const after = await page.evaluate(async () => {
      const api = window.__GEO_TEST__;
      const move = api.awaitMoveEnd();
      api.selectByLabel("Tổ dân phố số 1");
      const moved = await move;
      const entry = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 1);
      const fb = entry.layer.getBounds();
      const mb = api.map.getBounds();
      // Polygon should be mostly inside view; view should not be vastly larger
      const featH = fb.getNorth() - fb.getSouth();
      const viewH = mb.getNorth() - mb.getSouth();
      const featW = fb.getEast() - fb.getWest();
      const viewW = mb.getEast() - mb.getWest();
      return {
        zoom: moved.zoom,
        selected: api.getSelectedKey(),
        contains: mb.contains(fb.getCenter()),
        heightRatio: viewH / featH,
        widthRatio: viewW / featW,
        activeLabel: document.querySelector("#ward-list li.active")?.textContent?.trim(),
      };
    });

    expect(after.activeLabel).toContain("Tổ dân phố số 1");
    expect(after.contains).toBe(true);
    expect(after.zoom).toBeGreaterThan(before.zoom);
    // Fit khít: viewport không rộng hơn polygon quá ~3.5 lần mỗi chiều
    expect(after.heightRatio).toBeLessThan(3.5);
    expect(after.widthRatio).toBeLessThan(3.5);
    expect(after.zoom).toBeGreaterThanOrEqual(16);
  });

  test("accent-insensitive search finds Đống Đa tổ", async ({ page }) => {
    await waitApp(page);
    await page.fill("#search", "to dan pho so 1");
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll("#ward-list li")]
        .filter((li) => !li.classList.contains("hidden"))
        .map((li) => li.textContent.trim())
    );
    expect(visible).toEqual(["Tổ dân phố số 1"]);
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
});
