/* Doubao (doubao.com) adapter — shared factory. BEST-GUESS / UNVERIFIED.
 * Doubao is region-locked (blocked outside China), so these selectors are not
 * live-verified — they are synthesized from public userscripts that track
 * Doubao's DOM (OpenCLI #1189/#1190, urzeye/ophel #345, ScriptCat 豆包 helpers).
 * Role split uses the bubble classes (send = user, receive = assistant) with the
 * legacy data-testids as fallback; the composer is textarea[data-testid=
 * "chat_input_input"]. Doubao restructures its DOM often, so this may need tuning
 * once verified against a real page — the fail-soft guard in content.js keeps any
 * drift from breaking the site. Enter-key send is the reliable fallback. */
globalThis.LumenAdapterDoubao = globalThis.LumenCreateAdapter({
  hostnames: ["doubao.com"],
  platform: "doubao",
  userSelector: '[class*="bg-g-send-msg-bubble"], [data-testid="send_message"]',
  assistantSelector: '[class*="bg-g-receive-msg-bubble"], [data-testid="receive_message"]',
  userWrappers: [
    '[data-testid="message-block-container"]',
    '[class*="message-block-container"]',
    '[data-testid="send_message"]',
    '[class*="bg-g-send-msg-bubble"]',
  ],
  inputs: [
    'textarea[data-testid="chat_input_input"]',
    "textarea",
    '[contenteditable="true"]',
  ],
  sendButtons: [
    '[data-testid="chat_input_send_button"]',
    'button[data-testid*="send" i]',
    'button[aria-label*="\u53d1\u9001"]',
    'button[type="submit"]',
  ],
});
