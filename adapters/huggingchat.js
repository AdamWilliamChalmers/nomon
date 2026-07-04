/* HuggingChat (huggingface.co/chat) adapter — shared factory.
 * Verified against the open-source huggingface/chat-ui source (ChatMessage.svelte,
 * ChatInput.svelte, ChatWindow.svelte). Every turn carries data-message-id; user
 * bubbles are tagged data-message-type="user" while assistant bubbles use
 * data-message-role="assistant". The composer is a <textarea placeholder="Ask
 * anything"> and send is a button[type=submit][aria-label="Send message"].
 * matchesFn keeps Lumen scoped to the /chat path (off the rest of huggingface.co).
 * The fail-soft guard in content.js covers any future drift. */
globalThis.LumenAdapterHuggingChat = globalThis.LumenCreateAdapter({
  hostnames: ["huggingface.co"],
  platform: "huggingchat",
  matchesFn() {
    return (
      window.location.hostname.includes("huggingface.co") &&
      (window.location.pathname || "").startsWith("/chat")
    );
  },
  userSelector: '[data-message-type="user"]',
  assistantSelector: '[data-message-role="assistant"]',
  userWrappers: ['[data-message-type="user"]', "[data-message-id]"],
  inputs: [
    'textarea[placeholder*="Ask anything" i]',
    'textarea[inputmode="text"]',
    "textarea",
  ],
  sendButtons: [
    'button[aria-label="Send message"]',
    'button[type="submit"][aria-label*="send" i]',
    'button[type="submit"]',
  ],
});
