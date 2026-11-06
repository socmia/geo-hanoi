import { test, expect } from "@playwright/test";

async function waitApp(page, hash = "") {
  await page.goto(`/?v=pw${hash}`);
  await page.waitForFunction(() => window.__GEO_TEST__?.byKey?.size > 0, null, { timeout: 20_000 });
}

test.describe("map page", () => {
  test("loads 23 tổ dân phố, no duplicate số 6, select lists them in order", async ({ page }) => {
    await waitApp(page);
    const nums = await page.evaluate(() => [...window.__GEO_TEST__.byKey.values()].map((e) => e.props.to_dan_pho));
    expect(nums).toHaveLength(23);
    expect(nums.filter((n) => n === 6)).toHaveLength(1);
    const options = await page.locator("#tdp-select option").allTextContents();
    expect(options).toHaveLength(24); // placeholder + 23
    expect(options[1]).toBe("Tổ dân phố số 1");
    expect(options[23]).toBe("Tổ dân phố số 23");
    await expect(page.locator("#ward-select")).toHaveValue("922");
  });

  test("initial view fits Đống Đa area", async ({ page }) => {
    await waitApp(page);
    const fit = await page.evaluate(() => {
      const api = window.__GEO_TEST__;
      const wb = api.dongDaBounds;
      const mb = api.map.getBounds();
      return {
        zoom: api.map.getZoom(),
        containsCenter: mb.contains(wb.getCenter()),
        heightRatio: (mb.getNorth() - mb.getSouth()) / (wb.getNorth() - wb.getSouth()),
        widthRatio: (mb.getEast() - mb.getWest()) / (wb.getEast() - wb.getWest()),
      };
    });
    expect(fit.containsCenter).toBe(true);
    expect(fit.zoom).toBeGreaterThanOrEqual(14);
    expect(fit.heightRatio).toBeLessThan(3.5);
    expect(fit.widthRatio).toBeLessThan(3.5);
  });

  test("each tổ has its own colour; labels read 'Tổ dân phố N' with that colour", async ({ page }) => {
    await waitApp(page);
    const o = await page.evaluate(() => {
      const es = [...window.__GEO_TEST__.byKey.values()];
      const e1 = es.find((e) => e.props.to_dan_pho === 1);
      return {
        colors: new Set(es.map((e) => e.color)).size,
        fill: e1.layer.options.fillColor, color: e1.layer.options.color, expected: window.__GEO_TEST__.colorForTdp(1),
        label: e1.layer.getTooltip().getContent(),
      };
    });
    expect(o.colors).toBe(23);
    expect(o.fill).toBe(o.expected);
    expect(o.color).toBe(o.expected);
    expect(o.label).toContain(">Tổ dân phố 1<");
    expect(o.label).toContain(`border-left-color:${o.expected}`);
    await expect(page.locator(".poly-label .tag", { hasText: /^Tổ dân phố 23$/ })).toBeVisible();
  });

  test("choosing a tổ in the select shows the info card and fits the polygon", async ({ page }) => {
    await waitApp(page);
    await expect(page.locator("#info")).toBeHidden();
    const before = await page.evaluate(() => window.__GEO_TEST__.map.getZoom());
    await page.selectOption("#tdp-select", { label: "Tổ dân phố số 1" });
    await expect(page.locator("#info")).toBeVisible();
    await expect(page.locator("#info-title")).toHaveText("Tổ dân phố số 1");
    await expect(page.locator("#info-detail")).toHaveAttribute("href", "to.html?n=1");
    await page.waitForFunction(() => window.__GEO_TEST__.map.getZoom() >= 16, null, { timeout: 5000 });
    const after = await page.evaluate(() => {
      const api = window.__GEO_TEST__;
      const e = [...api.byKey.values()].find((x) => x.props.to_dan_pho === 1);
      return { zoom: api.map.getZoom(), contains: api.map.getBounds().contains(e.layer.getBounds().getCenter()) };
    });
    expect(after.zoom).toBeGreaterThan(before);
    expect(after.contains).toBe(true);
  });

  test("info card shows contacts as tel: links matching tdp-extra.json", async ({ page }) => {
    await waitApp(page);
    const extra = await (await page.request.get("/data/tdp-extra.json")).json();
    await page.selectOption("#tdp-select", { label: "Tổ dân phố số 3" });
    const e = extra["3"];
    await expect(page.locator("#info-body")).toContainText(e.to_truong.ten);
    await expect(page.locator("#info-body")).toContainText(e.cskv.ten);
    const digits = e.to_truong.dt.replace(/\D/g, "");
    await expect(page.locator(`#info-body a[href="tel:${digits}"]`).first()).toBeVisible();
    await expect(page.locator("#info-body")).toContainText(`${e.ho_dan.toLocaleString("vi-VN")} hộ dân`);
  });

  test("deep link #tdp-1 selects, hashchange re-selects, close clears", async ({ page }) => {
    await waitApp(page, "#tdp-1");
    await expect(page.locator("#info-title")).toHaveText("Tổ dân phố số 1");
    await expect(page.locator("#tdp-select option:checked")).toHaveText("Tổ dân phố số 1");
    await page.evaluate(() => (location.hash = "#tdp-5"));
    await expect(page.locator("#info-title")).toHaveText("Tổ dân phố số 5");
    await page.click("#info-close");
    await expect(page.locator("#info")).toBeHidden();
    await expect(page.locator("#tdp-select")).toHaveValue("");
    expect(await page.evaluate(() => location.hash)).toBe("");
  });

  test("selected tổ is stronger and dashed, others stay visible", async ({ page }) => {
    await waitApp(page);
    const s = await page.evaluate(() => {
      const api = window.__GEO_TEST__;
      api.selectByLabel("Tổ dân phố số 1");
      const sel = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 1).layer.options;
      const other = [...api.byKey.values()].find((e) => e.props.to_dan_pho === 2).layer.options;
      return { sel, other };
    });
    expect(s.sel.fillOpacity).toBeGreaterThan(s.other.fillOpacity);
    expect(s.sel.dashArray).toBeTruthy();
    expect(s.sel.color).toBe("#3b0764");
    expect(s.other.fillOpacity).toBeGreaterThanOrEqual(0.3);
  });

  test("picking the placeholder option clears the selection", async ({ page }) => {
    await waitApp(page, "#tdp-2");
    await expect(page.locator("#info")).toBeVisible();
    await page.selectOption("#tdp-select", "");
    await expect(page.locator("#info")).toBeHidden();
    expect(await page.evaluate(() => location.hash)).toBe("");
  });

  test("Lớp dữ liệu toggles satellite and back", async ({ page }) => {
    await waitApp(page);
    await expect(page.locator("#layers-btn")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".leaflet-tile-pane img").first()).toHaveAttribute("src", /World_Street_Map/);
    await page.click("#layers-btn");
    await expect(page.locator("#layers-btn")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".leaflet-tile-pane img").first()).toHaveAttribute("src", /World_Imagery/);
  });

  test("Lấy tọa độ shows lat,lng toast after a map click", async ({ page }) => {
    await waitApp(page);
    await page.click("#coord-btn");
    await page.mouse.click(640, 450);
    await expect(page.locator("#toast")).toContainText(/\d+\.\d{6}, \d+\.\d{6}/);
    await expect(page.locator("#toast button")).toHaveText("Sao chép");
  });

  test("POI markers show at zoom >= 15", async ({ page }) => {
    await waitApp(page);
    await page.waitForFunction(() => window.__GEO_TEST__.pois.length > 0);
    await page.evaluate(() => window.__GEO_TEST__.map.setZoom(16, { animate: false }));
    await expect(page.locator(".leaflet-marker-pane .poi--school").first()).toBeVisible();
  });

  test("info card links to to.html?n= and the detail page loads", async ({ page }) => {
    await waitApp(page);
    await page.selectOption("#tdp-select", { label: "Tổ dân phố số 3" });
    expect(await page.getAttribute("#info-detail", "href")).toBe("to.html?n=3");
    await page.goto("/to.html?n=3");
    await expect(page.locator("h1")).toContainText("Tổ dân phố số 3");
    await expect(page.locator("#mini-map .leaflet-overlay-pane path").first()).toBeVisible();
    await expect(page.locator(".stats")).toContainText("Diện tích");
    await expect(page.locator(".stats")).toContainText("Hộ dân");
    await expect(page.locator("#places .place").first()).toBeVisible();
    // Contact block: 2 columns — Liên hệ | UBND phường
    const contactCols = page.locator(".contact-grid > .card.rows");
    await expect(contactCols).toHaveCount(2);
    await expect(contactCols.nth(0).locator("h2")).toHaveText("Liên hệ");
    await expect(contactCols.nth(1).locator("h2")).toHaveText("UBND phường");
    await expect(contactCols.nth(0)).toContainText("Bí thư chi bộ");
    await expect(contactCols.nth(1)).toContainText("UBND");
    await page.goto("/to.html?n=2"); // tổ without POIs still shows the section
    await expect(page.locator("#places")).toContainText("Chưa ghi nhận");
    await page.goto("/to.html?n=3");
    await expect(page.locator(".brand-back")).toHaveAttribute("href", "index.html#tdp-3");
  });
});

test.describe("mobile 375px", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("no horizontal overflow; filters and map are laid out", async ({ page }) => {
    await waitApp(page);
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: innerWidth,
      map: document.getElementById("map").getBoundingClientRect().height,
    }));
    expect(m.sw).toBeLessThanOrEqual(m.iw);
    expect(m.map).toBeGreaterThan(400);
    await expect(page.locator("#tdp-select")).toBeVisible();
    await expect(page.locator("#layers-btn")).toBeVisible();
    await expect(page.locator("#coord-btn")).toBeHidden();
    await expect(page.locator(".legend")).toBeVisible();
    const [w, t] = await Promise.all([page.locator("#ward-select").boundingBox(), page.locator("#tdp-select").boundingBox()]);
    expect(Math.abs(w.y - t.y)).toBeLessThan(1); // same row
    expect(w.height).toBe(44);
    expect(t.height).toBe(44);
    expect(t.x).toBeGreaterThan(w.x + w.width);
    expect(t.x + t.width).toBeLessThanOrEqual(375);
  });

  test("selecting a tổ shows a bottom card inside the viewport; close clears", async ({ page }) => {
    await waitApp(page);
    await page.selectOption("#tdp-select", { label: "Tổ dân phố số 12" });
    const card = page.locator("#info");
    await expect(card).toBeVisible();
    await expect(page.locator("#info-title")).toHaveText("Tổ dân phố số 12");
    const box = await card.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y + box.height).toBeLessThanOrEqual(812);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const target = await page.locator("#info-close").boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    await page.click("#info-close");
    await expect(card).toBeHidden();
    await expect(page.locator("#tdp-select")).toHaveValue("");
  });
});
