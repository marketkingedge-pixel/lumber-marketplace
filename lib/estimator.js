// Project Scanner estimator.
//
// Real mode: sends the uploaded photo + the dimensions/notes the user typed
// in to Claude (vision-capable model) and asks for a structured materials +
// cost estimate back as JSON.
//
// Fallback mode (no ANTHROPIC_API_KEY set): a simple rule-of-thumb
// calculator keyed off project type and square footage, so the feature is
// still clickable and demoable without an API key. Swap in real regional
// pricing before relying on this for real quotes.

const fs = require("fs");

const RULE_OF_THUMB = {
  deck: {
    label: "Deck",
    materialsPerSqFt: [
      { item: "5/4x6 pressure-treated decking board", perSqFt: 1.1, unit: "boards", unitPrice: 9.5 },
      { item: "2x8 pressure-treated joist", perSqFt: 0.12, unit: "boards", unitPrice: 18 },
      { item: "4x4 pressure-treated post", perSqFt: 0.02, unit: "posts", unitPrice: 22 },
      { item: "Joist hangers", perSqFt: 0.12, unit: "pieces", unitPrice: 1.75 },
      { item: "Deck screws (5 lb box)", perSqFt: 0.02, unit: "boxes", unitPrice: 32 },
    ],
    laborHoursPerSqFt: 0.5,
  },
  fence: {
    label: "Fence",
    materialsPerSqFt: [
      { item: "1x6 cedar picket", perSqFt: 2.2, unit: "pickets", unitPrice: 4.75 },
      { item: "4x4 pressure-treated post", perSqFt: 0.08, unit: "posts", unitPrice: 22 },
      { item: "2x4 pressure-treated rail", perSqFt: 0.2, unit: "boards", unitPrice: 7.25 },
      { item: "Bag of concrete (post-setting)", perSqFt: 0.08, unit: "bags", unitPrice: 6.5 },
    ],
    laborHoursPerSqFt: 0.35,
  },
  shed: {
    label: "Shed",
    materialsPerSqFt: [
      { item: "3/4\" CDX plywood sheathing", perSqFt: 0.04, unit: "sheets", unitPrice: 38 },
      { item: "2x4 stud", perSqFt: 0.35, unit: "boards", unitPrice: 5.25 },
      { item: "Roofing shingles (bundle)", perSqFt: 0.03, unit: "bundles", unitPrice: 34 },
      { item: "OSB roof decking", perSqFt: 0.04, unit: "sheets", unitPrice: 29 },
    ],
    laborHoursPerSqFt: 0.6,
  },
  "retaining-wall": {
    label: "Retaining Wall",
    materialsPerSqFt: [
      { item: "Retaining wall block", perSqFt: 1.5, unit: "blocks", unitPrice: 3.6 },
      { item: "Crushed gravel base (cu ft)", perSqFt: 0.3, unit: "cu ft", unitPrice: 2.1 },
      { item: "Landscape fabric (sq ft)", perSqFt: 1, unit: "sq ft", unitPrice: 0.4 },
    ],
    laborHoursPerSqFt: 0.45,
  },
  other: {
    label: "General Project",
    materialsPerSqFt: [
      { item: "Dimensional lumber (assorted)", perSqFt: 0.3, unit: "boards", unitPrice: 7 },
      { item: "Sheet goods (plywood/OSB)", perSqFt: 0.03, unit: "sheets", unitPrice: 34 },
      { item: "Fasteners & hardware (allowance)", perSqFt: 1, unit: "allowance ($)", unitPrice: 0.35 },
    ],
    laborHoursPerSqFt: 0.4,
  },
};

const LABOR_RATE_PER_HOUR = 55;

function fallbackEstimate({ projectType, length, width, notes }) {
  const type = RULE_OF_THUMB[projectType] || RULE_OF_THUMB.other;
  const L = Number(length) || 0;
  const W = Number(width) || 0;
  const sqFt = Math.max(L * W, 1);

  const materials = type.materialsPerSqFt.map((m) => {
    const quantity = Math.ceil(m.perSqFt * sqFt);
    const lineTotal = Math.round(quantity * m.unitPrice * 100) / 100;
    return {
      item: m.item,
      quantity,
      unit: m.unit,
      est_unit_price: m.unitPrice,
      est_line_total: lineTotal,
    };
  });

  const materialsCost = materials.reduce((sum, m) => sum + m.est_line_total, 0);
  const laborHours = Math.round(type.laborHoursPerSqFt * sqFt);
  const laborCost = laborHours * LABOR_RATE_PER_HOUR;
  const subtotal = materialsCost + laborCost;

  return {
    project_type: type.label,
    estimated_area_sq_ft: Math.round(sqFt),
    confidence_note:
      "Built with a rule-of-thumb calculator (no AI vision key configured), based on the project type and dimensions you entered rather than the photo itself. Treat this as a rough starting point.",
    materials,
    labor_estimate: {
      hours: laborHours,
      rate_per_hour: LABOR_RATE_PER_HOUR,
      notes: "Generic regional labor rate placeholder — adjust to your local market.",
    },
    cost_range: {
      low: Math.round(subtotal * 0.85),
      high: Math.round(subtotal * 1.2),
    },
    assumptions: [
      `Assumed ${Math.round(sqFt)} sq ft based on the ${L || "?"} x ${W || "?"} ft dimensions entered.`,
      "Assumes standard-grade materials and typical site conditions.",
      "Does not account for demolition, disposal, permits, or unusual site access.",
      notes ? `User notes considered: "${notes}"` : "No additional notes were provided.",
    ],
    recommended_next_step:
      "Post this to the Material Request Board so local companies can confirm exact quantities and give a firm quote.",
  };
}

async function aiEstimate({ imagePath, mimeType, projectType, length, width, notes }) {
  // Lazy-require so the SDK is only needed when a key is actually configured.
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Data = imageBuffer.toString("base64");

  const prompt = `You are estimating home-improvement materials and cost from a single photo of a project area, plus some details the property owner typed in.

Project type (owner-selected, may be approximate): ${projectType || "not specified"}
Approximate dimensions the owner entered: ${length || "?"} ft x ${width || "?"} ft
Owner's notes: ${notes || "none"}

Look at the photo and combine it with the details above to produce a realistic materials list and cost estimate for a residential lumber/building-materials project. Be conservative and note assumptions clearly — this is a rough estimate to help the owner start a conversation with a local lumber company, not a final quote.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{
  "project_type": string,
  "estimated_area_sq_ft": number,
  "confidence_note": string,
  "materials": [
    { "item": string, "quantity": number, "unit": string, "est_unit_price": number, "est_line_total": number }
  ],
  "labor_estimate": { "hours": number, "rate_per_hour": number, "notes": string },
  "cost_range": { "low": number, "high": number },
  "assumptions": [string],
  "recommended_next_step": string
}`;

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 1800,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64Data },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) throw new Error("No text response from model");

  // Strip stray markdown fences just in case the model adds them anyway.
  const cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  return JSON.parse(cleaned);
}

async function estimateProject(params) {
  const hasKey = !!process.env.ANTHROPIC_API_KEY && !!params.imagePath;
  if (hasKey) {
    try {
      const result = await aiEstimate(params);
      return { ...result, engine: "ai" };
    } catch (err) {
      console.error("AI scan failed, falling back to rule-of-thumb estimate:", err.message);
      const fallback = fallbackEstimate(params);
      fallback.confidence_note = `AI scan failed (${err.message}), showing a rule-of-thumb estimate instead. ${fallback.confidence_note}`;
      return { ...fallback, engine: "fallback" };
    }
  }
  return { ...fallbackEstimate(params), engine: "fallback" };
}

module.exports = { estimateProject };
