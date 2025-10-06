const TESTS = {
  length: {
    id: 'length',
    name: 'Length',
    options: ['shorter prompt', 'longer prompt'],
  },
  vibes: {
    id: 'vibes',
    name: 'Vibes',
    options: ['mostly vibes / feelings', 'mostly concrete details'],
  },
  tone: {
    id: 'tone',
    name: 'Tone',
    options: ['serious', 'playful'],
  },
  humor: {
    id: 'humor',
    name: 'Humor',
    options: ['funny', 'serious/not funny'],
  },
  creepy: {
    id: 'creepy',
    name: 'Creep Factor',
    options: ['creepy', 'not creepy'],
  },
  realism: {
    id: 'realism',
    name: 'Realism',
    options: ['realistic/documentary', 'stylized/surreal'],
  },
  camera_stability: {
    id: 'camera_stability',
    name: 'Camera',
    options: ['handheld', 'tripod-locked'],
  },
  camera_motion: {
    id: 'camera_motion',
    name: 'Camera Motion',
    options: ['static frame', 'subtle push/pan'],
  },
  framing: {
    id: 'framing',
    name: 'Framing',
    options: ['wide composition', 'tight close-ups'],
  },
  lighting: {
    id: 'lighting',
    name: 'Lighting',
    options: ['flat 5600K daylight', 'dramatic/colored gels'],
  },
  color_palette: {
    id: 'color_palette',
    name: 'Color Palette',
    options: ['natural/muted', 'neon/high-saturation'],
  },
  audio_focus: {
    id: 'audio_focus',
    name: 'Audio Focus',
    options: ['music-forward', 'ambience/sfx-forward'],
  },
  dialogue: {
    id: 'dialogue',
    name: 'Dialogue',
    options: ['spoken lines', 'silent'],
  },
  overlays: {
    id: 'overlays',
    name: 'Overlays',
    options: ['with text overlays', 'no text overlays'],
  },
  looping: {
    id: 'looping',
    name: 'Looping',
    options: ['seamless loop', 'no looping needed'],
  },
  beats: {
    id: 'beats',
    name: 'Beat Structure',
    options: ['2-beat', '3-beat'],
  },
  effect_density: {
    id: 'effect_density',
    name: 'Effect Density',
    options: ['one signature effect', 'many micro-effects'],
  },
  prop_strategy: {
    id: 'prop_strategy',
    name: 'Prop Strategy',
    options: ['single prop', 'multiple props'],
  },
  setting_scope: {
    id: 'setting_scope',
    name: 'Setting Scope',
    options: ['neutral studio', 'real location'],
  },
  transition_style: {
    id: 'transition_style',
    name: 'Transitions',
    options: ['hard cuts only', 'in-camera/FX transitions'],
  },
  tempo: {
    id: 'tempo',
    name: 'Tempo',
    options: ['fast tempo (>120 BPM)', 'chill tempo (<100 BPM)'],
  },
  cta_timing: {
    id: 'cta_timing',
    name: 'CTA Timing',
    options: ['early CTA (<5s)', 'late CTA (8-10s)'],
  },
  hook_type: {
    id: 'hook_type',
    name: 'Hook Type',
    options: ['visual action hook', 'title card hook'],
  },
  subject_count: {
    id: 'subject_count',
    name: 'Subject Count',
    options: ['single subject', 'couple/group subjects'],
  },
  focus: {
    id: 'focus',
    name: 'Creative Focus',
    options: ['product-centered', 'lifestyle-centered'],
  },
};

const SYSTEM_PROMPT = `You are an expert Sora 2 prompt architect. Every output must be a single self contained prompt that:
- Targets a 10-second video with the opening line "10-second video. Camera and exposure locked unless specified."
- Uses 1-3 beats max with timestamps or counts, calling out location, framing, motion, lighting, and one signature effect.
- Includes micro choreography (counts 1-8 or 0.0s-10.0s) with clear actions and one twist.
- Specifies audio: BPM or groove, 2-3 sound effects, and optional dialogue under 10 words.
- Notes loop logic when helpful so last frame can reconnect to the first.
- Obeys rights and safety: use cameo tags for living people (@username) or swap to fictional/historical/cartoon stand-ins. Avoid trademarks unless generic.
- Keeps each prompt under 1800 characters.
Return responses as JSON only when asked.`;

const TEXT_FORMAT = {
  format: {
    type: 'json_schema',
    name: 'prompt_grid',
    strict: true,
    schema: {
      type: 'object',
      required: ['grid'],
      additionalProperties: false,
      properties: {
        grid: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              type: 'object',
              required: ['title', 'prompt'],
              additionalProperties: false,
              properties: {
                title: { type: 'string', minLength: 1 },
                prompt: { type: 'string', minLength: 80 },
              },
            },
          },
        },
      },
    },
  },
};

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 60000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return respond(500, { error: 'Missing OpenAI API key.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const idea = typeof payload.idea === 'string' ? payload.idea.trim() : '';
  const axisA = normaliseAxis(payload.axisA);
  const axisB = normaliseAxis(payload.axisB);

  if (!idea) {
    return respond(400, { error: 'Idea is required.' });
  }

  if (!axisA || !axisB) {
    return respond(400, { error: 'Both axes are required.' });
  }

  const userPrompt = buildUserPrompt(idea, axisA, axisB);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: userPrompt }],
          },
        ],
        text: TEXT_FORMAT,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorDetail = await safeReadJson(response);
      const message =
        (errorDetail && (errorDetail.error?.message || errorDetail.error || errorDetail.message)) ||
        `OpenAI request failed (${response.status}).`;
      return respond(response.status, { error: message });
    }

    const data = await response.json();
    console.error('OpenAI raw response', JSON.stringify(data));
    const responsePayload = extractResponsePayload(data);
    if (!responsePayload) {
      throw new Error('OpenAI returned no content.');
    }

    let parsed;
    try {
      parsed = typeof responsePayload === 'string' ? JSON.parse(responsePayload) : responsePayload;
    } catch (error) {
      throw new Error('Failed to parse OpenAI response JSON.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI returned malformed content.');
    }

    if (!parsed.grid) {
      console.error('Missing grid in OpenAI payload', parsed);
      throw new Error('OpenAI response did not include a grid field.');
    }

    const grid = validateGrid(parsed.grid, axisA, axisB);

    return respond(200, {
      axisA,
      axisB,
      grid,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return respond(504, { error: 'Generation timed out. Try again in a moment.' });
    }
    console.error('Generation failed', error);
    return respond(500, { error: error.message || 'Failed to generate prompts. Please try again.' });
  }
};

function buildUserPrompt(idea, axisA, axisB) {
  return [
    'Create four Sora 2 ready prompts arranged in a 2x2 grid.',
    `User idea: ${idea}`,
    `Axis A (${axisA.name}) defines the columns: column 0 = ${axisA.options[0]}, column 1 = ${axisA.options[1]}.`,
    `Axis B (${axisB.name}) defines the rows: row 0 = ${axisB.options[0]}, row 1 = ${axisB.options[1]}.`,
    'Return JSON with this shape: { "grid": [[{ "title": string, "prompt": string }, ...], [...]] }. grid[0][0] must align with column 0 + row 0 (Axis A option 0 + Axis B option 0); grid[0][1] aligns with column 1 + row 0; grid[1][0] aligns with column 0 + row 1; grid[1][1] aligns with column 1 + row 1.',
    'Each title should be 3-6 words combining the axis choices and hinting at the twist.',
    'Each prompt must obey the system instructions, stay under 1800 characters, and be ready to paste directly into Sora 2. Do not add commentary or markdown.',
  ].join('\n\n');
}

function normaliseAxis(axisPayload) {
  if (!axisPayload || !axisPayload.id) return null;
  const reference = TESTS[axisPayload.id];
  if (!reference) return null;
  return {
    id: reference.id,
    name: reference.name,
    options: [...reference.options],
  };
}

function validateGrid(grid, axisA, axisB) {
  if (!Array.isArray(grid) || grid.length !== 2) {
    throw new Error('Grid must contain two rows.');
  }

  return grid.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== 2) {
      throw new Error(`Row ${rowIndex} must contain two prompts.`);
    }

    return row.map((cell, colIndex) => {
      if (!cell || typeof cell.prompt !== 'string') {
        throw new Error('Each cell must include a prompt.');
      }

      return {
        title: formatTitle(cell.title, axisA.options[colIndex], axisB.options[rowIndex]),
        prompt: cell.prompt.trim(),
      };
    });
  });
}

function formatTitle(title, axisAOption, axisBOption) {
  const base = typeof title === 'string' && title.trim().length > 0 ? title.trim() : `${axisAOption} x ${axisBOption}`;
  return base.length > 80 ? `${base.slice(0, 77)}...` : base;
}

function respond(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function extractResponsePayload(data) {
  if (!data) {
    return null;
  }

  const textChunks = [];

  if (Array.isArray(data.output)) {
    for (const message of data.output) {
      const parts = message?.content;
      if (!Array.isArray(parts)) continue;

      for (const part of parts) {
        if (!part) continue;

        if (part.type === 'output_json' && part.json) {
          return part.json;
        }

        if ((part.type === 'output_text' || part.type === 'summary_text') && typeof part.text === 'string') {
          textChunks.push(part.text);
        }
      }
    }
  }

  if (textChunks.length > 0) {
    const text = textChunks.join(' ').trim();
    return text.length ? text : null;
  }

  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  if (Array.isArray(data.output_text)) {
    const combined = data.output_text.join(' ').trim();
    return combined.length ? combined : null;
  }

  return null;
}















