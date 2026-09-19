const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const OpenAI = require('openai');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const isProduction = process.env.NODE_ENV === 'production';
const ollamaEnabled = Boolean(process.env.OLLAMA_BASE_URL) && !(isProduction && /localhost|127\.0\.0\.1/.test(OLLAMA_BASE_URL));
const DEFAULT_PROMPT = `Ты — Sieger. Отвечай кратко, ясно и по делу.
- Пиши коротко, но полезно.
- Если пользователь пишет по-русски, отвечай по-русски.
- Не придумывай факты.
- Замечай ошибки и предлагай исправления.
- Давай практичные ответы без лишнего текста.`;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {})
    })
  : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function toSafeMessages(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && typeof item.content === 'string')
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content).trim()
    }))
    .filter((item) => item.content)
    .slice(-5);
}

function buildMessages(history, userMessage, systemPrompt) {
  const messages = [{ role: 'system', content: systemPrompt || DEFAULT_PROMPT }];
  for (const item of toSafeMessages(history)) {
    messages.push(item);
  }
  messages.push({ role: 'user', content: String(userMessage).trim() });
  return messages;
}

function buildOllamaMessages(history, userMessage, systemPrompt) {
  const messages = [];

  if (systemPrompt && String(systemPrompt).trim()) {
    messages.push({ role: 'system', content: String(systemPrompt).trim() });
  }

  for (const item of toSafeMessages(history)) {
    messages.push({ role: item.role, content: item.content });
  }

  messages.push({ role: 'user', content: String(userMessage).trim() });
  return messages;
}

function fallbackReply(message) {
  return `Временный офлайн-ответ: "${message}". Для полноценной генерации подключите рабочий OpenAI API key или запустите локальный Ollama.`;
}

async function askOpenAI(message, history, systemPrompt) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: buildMessages(history, message, systemPrompt),
    temperature: 0.3,
    max_tokens: 120
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error('OpenAI returned an empty response');
  }

  return reply;
}

async function askOllama(message, history, systemPrompt) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: buildOllamaMessages(history, message, systemPrompt),
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 120
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error ${response.status}: ${text || 'unknown error'}`);
  }

  const data = await response.json();
  const reply = data?.message?.content || data?.content;
  if (!reply || !String(reply).trim()) {
    throw new Error('Ollama returned an empty response');
  }

  return String(reply).trim();
}

async function askAI(message, history, systemPrompt) {
  let lastError = null;

  if (openai) {
    try {
      return await askOpenAI(message, history, systemPrompt);
    } catch (error) {
      lastError = error;
      console.error('OpenAI error:', error?.message || error);
    }
  }

  if (ollamaEnabled) {
    try {
      return await askOllama(message, history, systemPrompt);
    } catch (error) {
      lastError = error;
      console.error('Ollama error:', error?.message || error);
    }
  }

  throw lastError || new Error('No usable AI provider configured');
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    aiMode: openai ? 'openai' : 'ollama-or-fallback',
    keyConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: MODEL,
    ollamaEnabled,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    ollamaModel: OLLAMA_MODEL
  });
});

app.post('/api/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const history = req.body?.history || [];
  const systemPrompt = String(req.body?.systemPrompt || DEFAULT_PROMPT).trim() || DEFAULT_PROMPT;

  if (!message) {
    return res.status(400).json({ ok: false, error: 'Введите сообщение' });
  }

  try {
    const reply = await askAI(message, history, systemPrompt);
    return res.json({ ok: true, reply });
  } catch (error) {
    const messageText = error?.message || 'Неизвестная ошибка AI';
    console.error('AI request failed:', messageText);
    return res.status(502).json({
      ok: false,
      error: `AI недоступен: ${messageText}`,
      reply: fallbackReply(message)
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI chat server started on http://0.0.0.0:${PORT}`);
});
