// ============================================================
//  utils/sanitize.js
//  Input sanitization helpers used across all routes.
//  Strips dangerous content before it touches the DB or OpenAI.
// ============================================================

// ── 1. Strip all HTML tags ────────────────────────────────────
// Removes anything that looks like <tag> or </tag>
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, "");
}

// ── 2. Block script injection patterns ───────────────────────
// Catches: <script>, javascript:, on* event handlers,
// data URIs, template literals used for injection, etc.
const INJECTION_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,  // <script>...</script>
  /<script[^>]*>/gi,                         // opening <script>
  /javascript\s*:/gi,                        // javascript: URIs
  /on\w+\s*=\s*["'][^"']*["']/gi,           // onclick="...", onerror='...'
  /on\w+\s*=\s*[^"'\s>]+/gi,               // onclick=handler (no quotes)
  /data\s*:\s*text\/html/gi,                // data:text/html URIs
  /vbscript\s*:/gi,                          // vbscript: URIs
  /expression\s*\(/gi,                       // CSS expression()
  /__proto__/gi,                             // prototype pollution
  /constructor\s*\[/gi,                      // constructor access
  /\$\{.*\}/g,                               // template literal injection ${...}
];

function containsInjection(str) {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(str));
}

// ── 3. Sanitize a string fully ────────────────────────────────
// Strips HTML, normalizes whitespace, trims.
// Does NOT escape — we want clean plain text.
function sanitizeText(str) {
  if (typeof str !== "string") return "";
  let s = str;
  s = stripHtml(s);                          // remove all HTML tags
  s = s.replace(/[\x00-\x08\x0B\x0E-\x1F\x7F]/g, ""); // strip control chars
  s = s.replace(/\s+/g, " ");               // collapse multiple spaces
  s = s.trim();
  return s;
}

// ── 4. Validate framework is an allowed value ─────────────────
const ALLOWED_FRAMEWORKS = ["TCRTE", "CoT", "FewShot"];

function isValidFramework(framework) {
  return ALLOWED_FRAMEWORKS.includes(framework);
}

// ── 5. Character limits ───────────────────────────────────────
const LIMITS = {
  rawPrompt:    1000,  // user-facing prompt — enough for any real use case
  systemPrompt: 3000,  // framework system prompts are longer by design
  framework:    20,    // short identifier string
};

module.exports = {
  sanitizeText,
  containsInjection,
  isValidFramework,
  LIMITS,
};
