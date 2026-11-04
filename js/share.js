/**
 * Share a link, degrading gracefully inside embeds (e.g. Google Sites iframes),
 * where Web Share and the async Clipboard API are usually blocked.
 * @param {string} url
 * @param {string} title
 * @param {(msg: string) => void} notify
 */
export async function shareLink(url, title, notify) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // user closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    notify("Đã sao chép liên kết");
    return;
  } catch { /* blocked in this frame */ }
  const ta = document.createElement("textarea");
  ta.value = url;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { /* unsupported */ }
  ta.remove();
  notify(copied ? "Đã sao chép liên kết" : `Liên kết: ${url}`);
}
