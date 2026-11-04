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

  test("selected stroke is thicker than idle", async ({ page }) => {
    await waitApp(page);
    const weights = await page.evaluate(async () => {
      const api = window.__GEO_TEST__;
      const move = api.awaitMoveEnd();
      api.selectByLabel("Tổ dân phố số 1");
      await move;
      const selected = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 1);
      const other = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 2);
      return {
        selected: selected.layer.options.weight,
        other: other.layer.options.weight,
      };
    });
    expect(weights.selected).toBeGreaterThanOrEqual(6);
    expect(weights.selected).toBeGreaterThan(weights.other);
  });
});
