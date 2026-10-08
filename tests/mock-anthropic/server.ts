/**
 * Local mock of the Anthropic Messages API, for exercising the live agent paths without a key or internet.
 *
 *   npx tsx tests/mock-anthropic/server.ts        # listens on 127.0.0.1:4600 (MOCK_ANTHROPIC_PORT to change)
 *
 * Point the app at it with ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4600.
 *
 * It validates requests the way the real API does for the features MarketingRx uses and answers with
 * correctly shaped messages (see BetaMessage / BetaRawMessageStreamEvent in the SDK types):
 * - output_config.format json_schema  -> a plausible instance generated from the schema
 * - web_search tool                   -> server_tool_use + web_search_tool_result + cited text (pauses once per prompt)
 * - stream: true                      -> SSE events for a short markdown answer
 * Test hooks: a user prompt containing [[mock:max_tokens]] or [[mock:refusal]] gets that stop_reason.
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT || 4600);
const FALLBACK_BETA_DEFAULT = "server-side-fallback-2026-07-01";
const FALLBACK_BETA_ARRAY = "server-side-fallback-2026-06-01";
// MOCK_ARRAY_ITEMS=0 makes every generated array empty (the model may legitimately return []).
const ARRAY_ITEMS = process.env.MOCK_ARRAY_ITEMS ? Number(process.env.MOCK_ARRAY_ITEMS) : null;
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

// Top-level request fields the API accepts (anything else is "Extra inputs are not permitted").
const KNOWN_FIELDS = new Set([
  "model", "max_tokens", "messages", "system", "metadata", "stop_sequences", "stream", "temperature", "top_p", "top_k",
  "tools", "tool_choice", "thinking", "output_config", "output_format", "fallbacks", "container", "context_management",
  "mcp_servers", "service_tier", "speed", "inference_geo", "cache_control", "diagnostics",
]);

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

class Invalid extends Error {}
function check(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Invalid(message);
}

// ---------- Validation ----------

function validateCacheControl(cc: Json, where: string) {
  check(cc && typeof cc === "object" && cc.type === "ephemeral", `${where}.cache_control.type: Input should be 'ephemeral'`);
  for (const k of Object.keys(cc)) check(k === "type" || k === "ttl", `${where}.cache_control.${k}: Extra inputs are not permitted`);
  if (cc.ttl !== undefined) check(cc.ttl === "5m" || cc.ttl === "1h", `${where}.cache_control.ttl: Input should be '5m' or '1h'`);
}

const CACHEABLE_BLOCKS = new Set(["text", "image", "document", "tool_use", "tool_result", "server_tool_use", "web_search_tool_result", "search_result"]);

function validateBlock(b: Json, where: string, role: string, counter: { n: number }) {
  check(b && typeof b === "object" && typeof b.type === "string", `${where}: content block must be an object with a type`);
  if (b.cache_control != null) {
    check(CACHEABLE_BLOCKS.has(b.type), `${where}.cache_control: cache_control cannot be set on ${b.type} blocks`);
    validateCacheControl(b.cache_control, where);
    counter.n++;
  }
  switch (b.type) {
    case "text":
      check(typeof b.text === "string", `${where}.text: Field required`);
      check(b.text.length > 0, `${where}: text content blocks must be non-empty`);
      break;
    case "thinking":
      check(role === "assistant", `${where}: thinking blocks are only allowed in assistant messages`);
      check(typeof b.thinking === "string", `${where}.thinking: Field required`);
      check(typeof b.signature === "string" && b.signature.length > 0, `${where}.signature: Field required`);
      break;
    case "redacted_thinking":
      check(role === "assistant", `${where}: redacted_thinking blocks are only allowed in assistant messages`);
      break;
    case "server_tool_use":
      check(role === "assistant", `${where}: server_tool_use blocks are only allowed in assistant messages`);
      check(/^srvtoolu_/.test(String(b.id)), `${where}.id: String should match pattern '^srvtoolu_[a-zA-Z0-9_]+$'`);
      break;
    case "web_search_tool_result":
      check(role === "assistant", `${where}: web_search_tool_result blocks are only allowed in assistant messages`);
      check(/^srvtoolu_/.test(String(b.tool_use_id)), `${where}.tool_use_id: String should match pattern '^srvtoolu_'`);
      check(Array.isArray(b.content) || (b.content && typeof b.content === "object"), `${where}.content: Field required`);
      if (Array.isArray(b.content))
        for (const [i, r] of b.content.entries()) {
          check(r?.type === "web_search_result", `${where}.content.${i}.type: Input should be 'web_search_result'`);
          check(typeof r.url === "string" && typeof r.title === "string" && typeof r.encrypted_content === "string", `${where}.content.${i}: url, title and encrypted_content are required`);
        }
      break;
    case "fallback":
      break;
    case "tool_use":
    case "tool_result":
    case "image":
    case "document":
      break;
    default:
      throw new Invalid(`${where}.type: Input tag '${b.type}' found using 'type' does not match any of the expected tags`);
  }
}

function validateJsonSchema(s: Json, path: string, root: Json) {
  check(s && typeof s === "object", `${path}: schema must be an object`);
  if (s.$ref) {
    check(typeof s.$ref === "string" && resolveRef(root, s.$ref) != null, `${path}.$ref: could not resolve ${s.$ref}`);
    return;
  }
  for (const v of s.anyOf ?? []) validateJsonSchema(v, `${path}.anyOf`, root);
  for (const v of s.allOf ?? []) validateJsonSchema(v, `${path}.allOf`, root);
  if (s.type === "object") {
    check(s.additionalProperties === false, `${path}: For 'object' type, 'additionalProperties' must be explicitly set to false`);
    for (const [k, v] of Object.entries(s.properties ?? {})) validateJsonSchema(v, `${path}.properties.${k}`, root);
  }
  if (s.type === "array" && s.items) validateJsonSchema(s.items, `${path}.items`, root);
  if (s.type === "array" && s.minItems !== undefined) check(s.minItems === 0 || s.minItems === 1, `${path}: minItems values other than 0 or 1 are not supported`);
  for (const [k, v] of Object.entries(s.$defs ?? {})) validateJsonSchema(v, `$defs.${k}`, root);
}

function validate(body: Json, headers: http.IncomingHttpHeaders) {
  check(headers["x-api-key"] || headers["authorization"], "authentication_error: x-api-key header is required");
  check(headers["anthropic-version"], "anthropic-version: header is required");
  const betas = String(headers["anthropic-beta"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  check(body && typeof body === "object" && !Array.isArray(body), "Request body must be a JSON object");
  for (const k of Object.keys(body)) check(KNOWN_FIELDS.has(k), `${k}: Extra inputs are not permitted`);
  check(typeof body.model === "string" && body.model.length > 0, "model: Field required");
  check(Number.isInteger(body.max_tokens), "max_tokens: Field required");
  check(body.max_tokens >= 1 && body.max_tokens <= 128000, `max_tokens: ${body.max_tokens} is out of range for model ${body.model} (1-128000)`);

  check(body.temperature === undefined, "temperature: `temperature` is deprecated for this model.");
  check(body.top_p === undefined, "top_p: `top_p` is deprecated for this model.");
  check(body.top_k === undefined, "top_k: `top_k` is deprecated for this model.");

  if (body.thinking !== undefined) {
    check(body.thinking && typeof body.thinking === "object", "thinking: must be an object");
    check(body.thinking.type !== "disabled", "thinking.type: 'disabled' is not supported for this model. Use output_config.effort to control thinking.");
    check(body.thinking.type !== "enabled" && body.thinking.budget_tokens === undefined, "thinking.type.enabled: budget_tokens is not supported for this model. Use thinking.type 'adaptive' and output_config.effort instead.");
    check(body.thinking.type === "adaptive", `thinking.type: Input tag '${body.thinking.type}' does not match any of the expected tags`);
  }

  if (body.tool_choice !== undefined) {
    check(body.tool_choice.type !== "any" && body.tool_choice.type !== "tool", 'tool_choice: type "tool" and "any" are not supported for this model.');
  }

  if (body.fallbacks !== undefined) {
    if (body.fallbacks === "default") check(betas.includes(FALLBACK_BETA_DEFAULT), `fallbacks: "default" requires the anthropic-beta header ${FALLBACK_BETA_DEFAULT}`);
    else {
      check(Array.isArray(body.fallbacks), 'fallbacks: Input should be "default" or a list');
      check(betas.includes(FALLBACK_BETA_ARRAY), `fallbacks: the array form requires the anthropic-beta header ${FALLBACK_BETA_ARRAY}`);
    }
  }

  if (body.output_format !== undefined) throw new Invalid("output_format: deprecated, use output_config.format");
  if (body.output_config !== undefined) {
    const oc = body.output_config;
    check(oc && typeof oc === "object", "output_config: must be an object");
    for (const k of Object.keys(oc)) check(["effort", "format", "task_budget"].includes(k), `output_config.${k}: Extra inputs are not permitted`);
    if (oc.effort !== undefined) check(EFFORTS.includes(oc.effort), `output_config.effort: Input should be ${EFFORTS.map((e) => `'${e}'`).join(", ")}`);
    if (oc.format !== undefined && oc.format !== null) {
      check(oc.format.type === "json_schema", "output_config.format.type: Input should be 'json_schema'");
      check(oc.format.schema && typeof oc.format.schema === "object", "output_config.format.schema: Field required");
      for (const k of Object.keys(oc.format)) check(k === "type" || k === "schema", `output_config.format.${k}: Extra inputs are not permitted`);
      validateJsonSchema(oc.format.schema, "output_config.format.schema", oc.format.schema);
    }
  }

  const counter = { n: 0 };
  if (body.system !== undefined) {
    if (typeof body.system !== "string") {
      check(Array.isArray(body.system), "system: Input should be a valid string or list");
      body.system.forEach((b: Json, i: number) => {
        check(b?.type === "text", `system.${i}.type: Input should be 'text'`);
        check(typeof b.text === "string" && b.text.length > 0, `system.${i}: text content blocks must be non-empty`);
        if (b.cache_control != null) {
          validateCacheControl(b.cache_control, `system.${i}`);
          counter.n++;
        }
      });
    }
  }

  if (body.tools !== undefined) {
    check(Array.isArray(body.tools), "tools: Input should be a valid list");
    body.tools.forEach((t: Json, i: number) => {
      if (String(t.type).startsWith("web_search_")) {
        check(["web_search_20250305", "web_search_20260209"].includes(t.type), `tools.${i}.type: unknown web search version ${t.type}`);
        check(t.name === "web_search", `tools.${i}.name: Input should be 'web_search'`);
        if (t.max_uses !== undefined) check(Number.isInteger(t.max_uses) && t.max_uses > 0, `tools.${i}.max_uses: Input should be greater than 0`);
        if (t.user_location !== undefined) {
          check(t.user_location.type === "approximate", `tools.${i}.user_location.type: Input should be 'approximate'`);
          if (t.user_location.country !== undefined) check(/^[A-Z]{2}$/.test(t.user_location.country), `tools.${i}.user_location.country: must be a 2-letter ISO country code`);
        }
        check(!(t.allowed_domains && t.blocked_domains), `tools.${i}: allowed_domains and blocked_domains cannot both be set`);
      }
      if (t.cache_control != null) {
        validateCacheControl(t.cache_control, `tools.${i}`);
        counter.n++;
      }
    });
  }

  check(Array.isArray(body.messages) && body.messages.length > 0, "messages: at least one message is required");
  check(body.messages[0]?.role === "user", "messages: first message must use the \"user\" role");
  body.messages.forEach((m: Json, i: number) => {
    check(m && (m.role === "user" || m.role === "assistant"), `messages.${i}.role: Input should be 'user' or 'assistant'`);
    if (typeof m.content === "string") check(m.content.length > 0, `messages.${i}: all messages must have non-empty content except for the optional final assistant message`);
    else {
      check(Array.isArray(m.content) && m.content.length > 0, `messages.${i}: all messages must have non-empty content except for the optional final assistant message`);
      m.content.forEach((b: Json, j: number) => validateBlock(b, `messages.${i}.content.${j}`, m.role, counter));
    }
  });
  const last = body.messages[body.messages.length - 1];
  if (last.role === "assistant") {
    // Resuming after pause_turn is the one case where the conversation may end on the assistant turn.
    const resumable = Array.isArray(last.content) && last.content.some((b: Json) => b.type === "server_tool_use");
    check(resumable, "This model does not support assistant message prefill. The conversation must end with a user message.");
  }
  check(counter.n <= 4, `A maximum of 4 blocks with cache_control may be provided. Found ${counter.n}.`);
  return betas;
}

// ---------- Schema-driven instance generation ----------

function resolveRef(root: Json, ref: string): Json {
  const m = ref.match(/^#\/(\$defs|definitions)\/(.+)$/);
  if (!m) return ref === "#" ? root : null;
  return root?.[m[1]]?.[decodeURIComponent(m[2])] ?? null;
}

function hash(s: string): number {
  return crypto.createHash("md5").update(s).digest().readUInt32LE(0);
}

function words(name: string): string {
  return name.replace(/_/g, " ").trim() || "item";
}

function sampleString(name: string, desc: string, idx: number): string {
  const one = desc.match(/Exactly one of:\s*([^.]+?)(?:\.|$)/i) ?? desc.match(/Exactly one of the [^:]*:\s*([^.]+)/i);
  if (one) return one[1].split(",")[0].trim();
  const w = words(name);
  if (/url path|slug/i.test(desc) || name === "slug") return `/sample-${w.replace(/\s+/g, "-")}-${idx + 1}`;
  if (/hashtag/i.test(name)) return `#samplesg${idx + 1}`;
  if (name === "businesses") return ["Glow Aesthetics", "The Skin Lab SG", "Radiance Medical"][idx % 3];
  if (name === "domain") return `example${idx + 1}.com`;
  if (name === "day") return `Week 1 ${["Mon", "Wed", "Fri"][idx % 3]}`;
  if (/^(title|name|idea_title|h1|page|question|quote|rule|hook)$/.test(name)) return `Sample ${w} ${idx + 1}`;
  if (/^(steps|outline|script_or_outline)$/.test(name)) return `Step ${idx + 1}: open the settings page and update the ${w}.`;
  return `Sample ${w} for the owner: a short, realistic sentence about the ${w}.`;
}

function generate(schema: Json, root: Json, name: string, idx: number, depth: number): Json {
  if (depth > 20) return null;
  if (schema?.$ref) return generate(resolveRef(root, schema.$ref), root, name, idx, depth + 1);
  if (Array.isArray(schema?.anyOf)) return generate(schema.anyOf[0], root, name, idx, depth + 1);
  if (Array.isArray(schema?.allOf)) return generate(schema.allOf[0], root, name, idx, depth + 1);
  const type = Array.isArray(schema?.type) ? schema.type.find((t: string) => t !== "null") : schema?.type;
  const desc = String(schema?.description ?? "");
  if (Array.isArray(schema?.enum)) return schema.enum[0];
  if (schema?.const !== undefined) return schema.const;
  switch (type) {
    case "object": {
      const out: Record<string, Json> = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = generate(v, root, k, idx, depth + 1);
      return out;
    }
    case "array": {
      const n = ARRAY_ITEMS ?? 2 + (hash(name) % 2);
      return Array.from({ length: n }, (_, i) => generate(schema.items ?? { type: "string" }, root, name, i, depth + 1));
    }
    case "string":
      return sampleString(name, desc, idx);
    case "number":
    case "integer":
      return 7;
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return null;
  }
}

// ---------- Responses ----------

function msgId() {
  return "msg_mock" + crypto.randomBytes(10).toString("hex");
}

function thinkingBlock() {
  // Opus 5.5 always thinks; display defaults to "omitted", so the text is empty but the signature is set.
  return { type: "thinking", thinking: "", signature: "mocksig_" + crypto.randomBytes(12).toString("base64url") };
}

function envelope(body: Json, content: Json[], stop_reason: string, extra: Json = {}) {
  const outText = JSON.stringify(content).length;
  return {
    id: msgId(),
    type: "message",
    role: "assistant",
    model: body.model,
    content,
    stop_reason,
    stop_sequence: null,
    stop_details: null,
    container: null,
    context_management: null,
    diagnostics: null,
    usage: {
      input_tokens: Math.ceil(JSON.stringify(body.messages).length / 4),
      output_tokens: Math.ceil(outText / 4),
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: null,
      fallback_credit: null,
      inference_geo: null,
      iterations: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: "standard",
      speed: null,
    },
    ...extra,
  };
}

function userText(body: Json): string {
  const first = body.messages.find((m: Json) => m.role === "user");
  if (!first) return "";
  if (typeof first.content === "string") return first.content;
  return first.content.filter((b: Json) => b.type === "text").map((b: Json) => b.text).join("\n");
}

function lastUserText(body: Json): string {
  const users = body.messages.filter((m: Json) => m.role === "user");
  const m = users[users.length - 1];
  if (!m) return "";
  return typeof m.content === "string" ? m.content : m.content.filter((b: Json) => b.type === "text").map((b: Json) => b.text).join("\n");
}

function systemText(body: Json): string {
  if (typeof body.system === "string") return body.system;
  return (body.system ?? []).map((b: Json) => b.text).join("\n");
}

/** A brand the prompt is about: "Business name: X" from the profile, or a Title Case name in the quoted question. */
function brandFrom(prompt: string): string | null {
  const profile = prompt.match(/Business name:\s*(.+)/);
  if (profile) return profile[1].trim();
  const quoted = prompt.match(/"([^"]+)"/)?.[1] ?? "";
  const tc = quoted
    .replace(/^(Is|Are|Does|Do|Can|Should|Would|Will|What|Where|Which|Who|How|Why|When)\s+/, "")
    .match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
  return tc ? tc[1] : null;
}

const paused = new Set<string>();

function searchResults(brand: string | null, query: string) {
  const brandHost = brand ? `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "")}.sg` : null;
  return [
    {
      type: "web_search_result",
      url: brandHost ? `https://www.${brandHost}/services` : "https://thesmartlocal.com/read/best-clinics-singapore/",
      title: brand ? `${brand} | Services` : "10 Best Clinics In Singapore - TheSmartLocal",
      encrypted_content: "Enc_" + crypto.randomBytes(24).toString("base64url"),
      page_age: "2 weeks ago",
    },
    {
      type: "web_search_result",
      url: "https://www.reddit.com/r/singapore/comments/abc123/recommendations/",
      title: `Recommendations for ${query.slice(0, 40)} : r/singapore`,
      encrypted_content: "Enc_" + crypto.randomBytes(24).toString("base64url"),
      page_age: null,
    },
  ];
}

function searchAnswerBlocks(brand: string | null, results: Json[]) {
  const names = ["Glow Aesthetics", "The Skin Lab SG", "Radiance Medical"].filter((n) => n !== brand);
  const list = brand ? [names[0], brand, names[1]] : names;
  const cite = (r: Json, text: string) => ({ type: "web_search_result_location", url: r.url, title: r.title, encrypted_index: "Eo" + crypto.randomBytes(8).toString("base64url"), cited_text: text });
  // Real answers with search arrive as several text blocks, split where citations start and end.
  return [
    { type: "text", text: `Based on my search, here are three options people often mention:\n\n1. **${list[0]}**: `, citations: null },
    { type: "text", text: "frequently recommended in local threads for clear pricing", citations: [cite(results[1], "clear pricing and friendly staff")] },
    { type: "text", text: `.\n2. **${list[1]}**: has a detailed services page and recent Google reviews.\n3. **${list[2]}**: `, citations: null },
    { type: "text", text: "listed in a popular local guide", citations: [cite(results[0], "one of the clinics in our guide")] },
    { type: "text", text: ".\n\nTips: compare recent reviews, check that prices are listed, and book a consultation first.", citations: null },
  ];
}

function webSearchResponse(body: Json) {
  const prompt = userText(body);
  const key = crypto.createHash("sha1").update(systemText(body) + "\n" + prompt).digest("hex");
  const brand = brandFrom(prompt);
  const query = (prompt.match(/"([^"]+)"/)?.[1] ?? prompt.split("\n").find((l) => l.trim()) ?? "search").slice(0, 80);
  const last = body.messages[body.messages.length - 1];
  const resuming = last.role === "assistant";
  const results = searchResults(brand, query);
  const toolId = "srvtoolu_" + crypto.randomBytes(10).toString("hex");
  const searchBlocks = [
    { type: "server_tool_use", id: toolId, name: "web_search", input: { query } },
    { type: "web_search_tool_result", tool_use_id: toolId, content: results },
  ];
  if (!resuming && !paused.has(key)) {
    paused.add(key);
    // Server-side tool loop hit its cap: the client must re-send to continue.
    return envelope(body, [thinkingBlock(), ...searchBlocks], "pause_turn");
  }
  const content = resuming ? [thinkingBlock(), ...searchAnswerBlocks(brand, results)] : [thinkingBlock(), ...searchBlocks, thinkingBlock(), ...searchAnswerBlocks(brand, results)];
  const resp = envelope(body, content, "end_turn");
  resp.usage.server_tool_use = { web_search_requests: 1, web_fetch_requests: 0 } as Json;
  return resp;
}

function structuredResponse(body: Json) {
  const schema = body.output_config.format.schema;
  const instance = generate(schema, schema, "root", 0, 0);
  const text = JSON.stringify(instance);
  const prompt = lastUserText(body);
  if (prompt.includes("[[mock:max_tokens]]")) return envelope(body, [thinkingBlock(), { type: "text", text: text.slice(0, Math.floor(text.length / 2)), citations: null }], "max_tokens");
  return envelope(body, [thinkingBlock(), { type: "text", text, citations: null }], "end_turn");
}

function chatResponse(body: Json) {
  const q = lastUserText(body).slice(0, 80);
  const text = `**Short answer:** start with your urgent prescriptions.\n\n- Fix the top item on your board first (you asked: "${q}").\n- Then re-run Site Doctor to see your score move.\n\nWant exact steps for the first fix?`;
  return envelope(body, [thinkingBlock(), { type: "text", text, citations: null }], "end_turn");
}

function respond(body: Json) {
  const prompt = lastUserText(body);
  if (prompt.includes("[[mock:refusal]]")) {
    return envelope(body, [], "refusal", { stop_details: { type: "refusal", category: null, explanation: null } });
  }
  if (body.output_config?.format) return structuredResponse(body);
  if ((body.tools ?? []).some((t: Json) => String(t.type).startsWith("web_search_"))) return webSearchResponse(body);
  return chatResponse(body);
}

// ---------- SSE ----------

function sse(res: http.ServerResponse, event: string, data: Json) {
  res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
}

async function streamMessage(res: http.ServerResponse, message: Json) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "request-id": "req_mock" });
  const { content, stop_reason, stop_sequence, stop_details, usage } = message;
  sse(res, "message_start", { message: { ...message, content: [], stop_reason: null, stop_sequence: null, stop_details: null, usage: { ...usage, output_tokens: 1 } } });
  sse(res, "ping", {});
  for (const [index, block] of content.entries()) {
    if (block.type === "text") {
      sse(res, "content_block_start", { index, content_block: { type: "text", text: "", citations: null } });
      const chunks = block.text.match(/[\s\S]{1,12}/g) ?? [];
      for (const text of chunks) {
        sse(res, "content_block_delta", { index, delta: { type: "text_delta", text } });
        await new Promise((r) => setTimeout(r, 2));
      }
    } else if (block.type === "thinking") {
      sse(res, "content_block_start", { index, content_block: { type: "thinking", thinking: "", signature: "" } });
      sse(res, "content_block_delta", { index, delta: { type: "signature_delta", signature: block.signature } });
    } else {
      sse(res, "content_block_start", { index, content_block: block });
    }
    sse(res, "content_block_stop", { index });
  }
  sse(res, "message_delta", {
    delta: { stop_reason, stop_sequence, stop_details: stop_details ?? null, container: null },
    usage: { output_tokens: usage.output_tokens, input_tokens: usage.input_tokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: usage.server_tool_use },
    context_management: null,
  });
  sse(res, "message_stop", {});
  res.end();
}

// ---------- Server ----------

function summary(body: Json, betas: string[]) {
  const kind = body.output_config?.format ? "structured" : body.tools?.length ? "web_search" : body.stream ? "stream" : "text";
  const last = body.messages?.[body.messages.length - 1];
  return `${kind} model=${body.model} max_tokens=${body.max_tokens} effort=${body.output_config?.effort ?? "-"} messages=${body.messages?.length} last=${last?.role} betas=[${betas.join(",")}] fallbacks=${JSON.stringify(body.fallbacks ?? null)}${body.stream ? " stream" : ""}`;
}

function sendError(res: http.ServerResponse, status: number, type: string, message: string) {
  res.writeHead(status, { "content-type": "application/json", "request-id": "req_mock" });
  res.end(JSON.stringify({ type: "error", error: { type, message }, request_id: "req_mock" }));
}

const recent: Json[] = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    res.end("ok");
    return;
  }
  // Test introspection: the last 50 accepted request bodies, newest last.
  if (req.method === "GET" && url.pathname === "/__requests") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(recent));
    return;
  }
  if (req.method !== "POST" || url.pathname !== "/v1/messages") {
    sendError(res, 404, "not_found_error", `Not found: ${req.method} ${url.pathname}`);
    return;
  }
  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    let body: Json;
    try {
      body = JSON.parse(raw);
    } catch {
      console.log(`[mock] 400 invalid JSON body`);
      sendError(res, 400, "invalid_request_error", "Request body is not valid JSON");
      return;
    }
    let betas: string[] = [];
    try {
      betas = validate(body, req.headers);
    } catch (e) {
      if (e instanceof Invalid) {
        const auth = e.message.startsWith("authentication_error");
        console.log(`[mock] ${auth ? 401 : 400} ${e.message}`);
        sendError(res, auth ? 401 : 400, auth ? "authentication_error" : "invalid_request_error", e.message);
        return;
      }
      throw e;
    }
    recent.push(body);
    if (recent.length > 50) recent.shift();
    const message = respond(body);
    console.log(`[mock] 200 ${summary(body, betas)} -> ${message.stop_reason} [${message.content.map((b: Json) => b.type).join(",")}]`);
    if (body.stream) await streamMessage(res, message);
    else {
      res.writeHead(200, { "content-type": "application/json", "request-id": "req_mock" });
      res.end(JSON.stringify(message));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`[mock] Anthropic mock listening on http://127.0.0.1:${PORT}`));
