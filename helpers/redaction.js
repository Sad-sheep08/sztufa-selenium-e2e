const SECRET_KEY = /password|passwd|token|authorization|cookie|secret|credential|database_url|direct_url|access.?key/i;

function redactText(value) {
  let text = String(value ?? '');
  // 环境中的已知凭据也可能以无字段名的形式出现在 SDK 错误中。
  for (const [key, secret] of Object.entries(process.env)) {
    if (SECRET_KEY.test(key) && secret && secret.length >= 4) {
      text = text.split(secret).join('[REDACTED]');
    }
  }
  return text
    .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s<>"']+/gi, '[REDACTED_CONNECTION]')
    .replace(/\bBearer\s+[^\s,"'<>]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/(["']?(?:password|passwd|token|access_token|refresh_token|authorization|cookie|secret|accessKeyId|secretAccessKey)["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;&}]+)/gi, '$1[REDACTED]')
    .replace(/\b(\d{2})\d{4,16}(\d{2})\b/g, '$1****$2');
}

module.exports = { redactText };
