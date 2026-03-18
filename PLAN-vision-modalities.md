# Plan: Dodanie modalities do generatora konfiguracji

## Problem

opencode wymaga pola `modalities` w konfiguracji modelu żeby wiedzieć czy model obsługuje obrazy. Bez `modalities.input` zawierającego `"image"`, opencode stripuje cały content obrazowy przed wysłaniem do API — nawet jeśli API to obsługuje.

Aktualnie generator (`processModels()` w `index.mjs`) nie dodaje `modalities` do konfiguracji modeli.

## Co trzeba zrobić

### 1. Dodać `modalities` do `models.config.mjs`

Każdy model w `SUPPORTED_MODELS` powinien mieć pole `modalities`:

```js
"Kimi K2.5": {
  modalities: { input: ["text", "image"], output: ["text"] },
  limit: { context: 256000, output: 64000 },
  cost: { input: 0.6, output: 3.0, cache_read: 0.1 },
},
```

Modele z potwierdzonym vision (testowane curlem i opencode):
- Kimi K2.5 — `input: ["text", "image"]`
- Claude Opus 4.5, 4.6 — `input: ["text", "image"]`
- Claude Sonnet 4.5, 4.6 — `input: ["text", "image"]`
- Gemini 2.5 Pro, 2.5 Flash — `input: ["text", "image"]`
- GPT 5, 5.2, 5.3 Instant — `input: ["text", "image"]`
- GPT 5.3 Codex — `input: ["text", "image"]`

Wszystkie modele mają `output: ["text"]`.

### Skąd brać informację o vision dla nowych modeli

1. **Dokumentacja providera** — sprawdzić oficjalną dokumentację modelu (Anthropic, OpenAI, Google, Moonshot) czy model obsługuje image input.

2. **Test curlem przez nexos.ai API** — wysłać obraz base64 i sprawdzić czy model odpowiada sensownie:
   ```bash
   # Zakoduj mały obraz testowy
   BASE64=$(base64 -w0 /path/to/test-image.jpg)
   
   curl -s https://api.nexos.ai/v1/chat/completions \
     -H "Authorization: Bearer $NEXOS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "NAZWA MODELU",
       "messages": [{
         "role": "user",
         "content": [
           {"type": "text", "text": "What is in this image?"},
           {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,'$BASE64'"}}
         ]
       }],
       "max_tokens": 200
     }'
   ```
   Jeśli model odpowiada opisem obrazu → vision działa → `input: ["text", "image"]`.
   Jeśli zwraca błąd lub pusty content → `input: ["text"]`.

3. **Obrazy testowe** — w repo `opencoder-nexos` są `test-cat.jpg` i `test-horse.jpg` do testów.

4. **Zasada ogólna** — większość nowoczesnych modeli (2025+) obsługuje vision. W razie wątpliwości lepiej dodać `"image"` i przetestować niż nie dodać — brak `"image"` w modalities powoduje że opencode w ogóle nie wysyła obrazów do modelu.

### 2. Dodać `getModelModalities()` do `models.config.mjs`

```js
export function getModelModalities(displayName) {
  const config = getModelConfig(displayName);
  if (config?.modalities) {
    return clone(config.modalities);
  }
  // Fallback: text only
  return { input: ["text"], output: ["text"] };
}
```

### 3. Użyć w `processModels()` w `index.mjs`

Import `getModelModalities` i dodać do obiektu modelu:

```js
const modalities = getModelModalities(displayName);

models[displayName] = {
  name: displayName,
  modalities,
  limit,
  ...(options ? { options } : {}),
  ...(variants ? { variants } : {}),
  ...(cost ? { cost } : {}),
};
```

### 4. Testy

Dodać testy sprawdzające:
- `getModelModalities()` zwraca prawidłowe modalities dla znanych modeli
- `getModelModalities()` zwraca fallback `["text"]` dla nieznanych modeli
- `processModels()` zawiera `modalities` w wygenerowanej konfiguracji

### 5. Weryfikacja

Po zmianach uruchomić generator i sprawdzić że `opencode.json` zawiera `modalities` dla każdego modelu:

```bash
node index.mjs
cat ~/.config/opencode/opencode.json | node -e "
  const c = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  for (const [id,m] of Object.entries(c.provider['nexos-ai'].models)) {
    console.log(m.modalities?.input?.includes('image') ? '✅' : '❌', id, JSON.stringify(m.modalities));
  }
"
```
