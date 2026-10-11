/**
 * Universal clipboard copy helper
 * Supports HTTPS, HTTP (non-secure context), localhost, and mobile/desktop browsers
 */
export async function copyToClipboard(text) {
  if (!text) return false;

  // 1. Try modern Clipboard API (Works on HTTPS and localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback below
    }
  }

  // 2. Fallback using temporary textarea (Works on HTTP / non-secure contexts)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {}

  // 3. Fallback prompt
  try {
    window.prompt('请手动复制链接：', text);
    return true;
  } catch (e) {
    return false;
  }
}
