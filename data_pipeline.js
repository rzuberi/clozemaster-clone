import { todayStr } from "./storage_manager.js";

const DATA_VERSION = "tatoeba.es.pipeline.v1";
const MAX_SENTENCE_COUNT = 500;

const NORMALIZER = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const removePunctuation = (text) => text.replace(/[.,;:!?¡¿"()\[\]¿¡«»]/g, "");

const splitWords = (text) => removePunctuation(text).split(/\s+/).filter(Boolean);

const VOCABULARY_KEYWORDS = {
  food: [
    "comer",
    "comida",
    "cocinar",
    "cena",
    "almuerzo",
    "desayuno",
    "restaurante",
    "bebida",
    "agua",
    "pan",
    "manzana",
    "pollo",
    "pescado",
    "verdura",
    "ensalada",
    "sopa",
    "café",
    "té",
    "hambre",
    "receta",
  ],
  travel: [
    "viajar",
    "viaje",
    "hotel",
    "avión",
    "tren",
    "autobús",
    "billete",
    "maleta",
    "aeropuerto",
    "mapa",
    "reservar",
    "turismo",
    "playa",
    "ciudad",
    "museo",
    "guía",
    "pasaporte",
    "taxi",
  ],
  family: [
    "familia",
    "madre",
    "padre",
    "hermano",
    "hermana",
    "hijo",
    "hija",
    "abuelo",
    "abuela",
    "primo",
    "prima",
    "tío",
    "tía",
    "sobrino",
    "sobrina",
    "esposo",
    "esposa",
  ],
  work: [
    "trabajo",
    "oficina",
    "empresa",
    "reunión",
    "proyecto",
    "jefe",
    "empleado",
    "salario",
    "entrevista",
    "horario",
    "correo",
    "equipo",
    "cliente",
  ],
  daily: [
    "levantar",
    "despertar",
    "duchar",
    "vestir",
    "caminar",
    "casa",
    "hogar",
    "escuela",
    "estudiar",
    "leer",
    "escribir",
    "limpiar",
    "cuidar",
    "llamar",
  ],
  shopping: [
    "comprar",
    "tienda",
    "mercado",
    "dinero",
    "precio",
    "descuento",
    "oferta",
    "pagar",
    "moneda",
    "cuesta",
    "cuenta",
    "cajero",
  ],
  leisure: [
    "jugar",
    "partido",
    "deporte",
    "música",
    "película",
    "cine",
    "bailar",
    "cantar",
    "leer",
    "pintar",
    "montar",
    "senderismo",
  ],
  health: [
    "salud",
    "doctor",
    "hospital",
    "medicina",
    "ejercicio",
    "correr",
    "dolor",
    "cuidar",
    "dieta",
    "enfermo",
    "vacuna",
    "farmacia",
  ],
  education: [
    "clase",
    "profesor",
    "estudiar",
    "examen",
    "universidad",
    "colegio",
    "tarea",
    "investigar",
    "biblioteca",
    "aprender",
    "notas",
  ],
  technology: [
    "computadora",
    "ordenador",
    "internet",
    "correo",
    "red",
    "programar",
    "aplicación",
    "móvil",
    "teléfono",
    "pantalla",
    "teclado",
    "conectar",
    "descargar",
  ],
};

const GRAMMAR_KEYWORDS = {
  "Present indicative": [
    "soy",
    "eres",
    "es",
    "somos",
    "son",
    "estoy",
    "estás",
    "está",
    "estamos",
    "están",
    "hablo",
    "hablas",
    "habla",
    "hablamos",
    "hablan",
    "tengo",
    "tienes",
    "tiene",
    "tenemos",
    "tienen",
    "vivo",
    "vives",
    "vive",
    "vivimos",
    "viven",
    "quiero",
    "quieres",
    "quiere",
    "queremos",
    "quieren",
  ],
  "Preterite": [
    "fui",
    "fuiste",
    "fue",
    "fuimos",
    "fueron",
    "hablé",
    "hablaste",
    "habló",
    "hablamos",
    "hablaron",
    "comí",
    "comiste",
    "comió",
    "comimos",
    "comieron",
    "viví",
    "viviste",
    "vivió",
    "vivimos",
    "vivieron",
  ],
  "Imperfect": [
    "era",
    "eras",
    "éramos",
    "eran",
    "iba",
    "ibas",
    "íbamos",
    "iban",
    "tenía",
    "tenías",
    "teníamos",
    "tenían",
    "veía",
    "veíamos",
  ],
  "Future": [
    "seré",
    "serás",
    "será",
    "seremos",
    "serán",
    "iré",
    "irás",
    "irá",
    "iremos",
    "irán",
    "haré",
    "harás",
    "hará",
    "haremos",
    "harán",
  ],
  "Conditional": [
    "sería",
    "serías",
    "seríamos",
    "serían",
    "haría",
    "harías",
    "haríamos",
    "harían",
    "podría",
    "podrías",
    "debería",
    "gustaría",
  ],
  "Subjunctive": [
    "quiera",
    "quieras",
    "quiera",
    "queramos",
    "quieran",
    "vaya",
    "vayas",
    "vayamos",
    "vayan",
    "haya",
    "hayas",
    "hayamos",
    "hayan",
    "sea",
    "seas",
    "seamos",
    "sean",
    "esté",
    "estés",
    "estemos",
    "estén",
    "tenga",
    "tengas",
    "tengamos",
    "tengan",
  ],
  "Imperative": [
    "haz",
    "ten",
    "ven",
    "pon",
    "sal",
    "sé",
    "di",
    "ve",
    "hable",
    "habla",
    "coman",
  ],
};

const PERFECT_AUXILIARIES = ["he", "has", "ha", "hemos", "han", "había", "habías", "habíamos", "habían"];
const PROGRESSIVE_AUXILIARIES = ["estoy", "estás", "está", "estamos", "están", "estaba", "estabas", "estábamos", "estaban"];
const GERUND_REGEX = /(ando|iendo)$/;
const PARTICIPLE_REGEX = /(ado|ido)$/;

const FALLBACK_SENTENCES = [];

function normaliseWord(word) {
  return NORMALIZER(word);
}

function detectVocabulary(tokens) {
  const normalized = tokens.map(normaliseWord);
  const matches = new Set();
  Object.entries(VOCABULARY_KEYWORDS).forEach(([category, list]) => {
    const hasWord = list.some((keyword) => normalized.includes(normaliseWord(keyword)));
    if (hasWord) matches.add(category);
  });
  return Array.from(matches);
}

function detectGrammar(tokens) {
  const normalized = tokens.map(normaliseWord);
  const matches = new Set();
  Object.entries(GRAMMAR_KEYWORDS).forEach(([category, list]) => {
    if (list.some((keyword) => normalized.includes(normaliseWord(keyword)))) {
      matches.add(category);
    }
  });
  const joined = normalized.join(" ");
  const hasPerfect = PERFECT_AUXILIARIES.some((aux) => joined.includes(normaliseWord(aux)) && joined.match(/\b(?:he|has|ha|hemos|han|había|habías|habíamos|habían)\s+[a-záéíóúñ]+ado\b|\b(?:he|has|ha|hemos|han|había|habías|habíamos|habían)\s+[a-záéíóúñ]+ido\b/));
  if (hasPerfect) matches.add("Perfect");
  const hasProgressive = PROGRESSIVE_AUXILIARIES.some((aux) => joined.includes(normaliseWord(aux))) && tokens.some((token) => GERUND_REGEX.test(normaliseWord(token)));
  if (hasProgressive) matches.add("Progressive");
  return Array.from(matches);
}

function determineDifficulty(grammars, tokens, metadata) {
  let level = "A1";
  const tokenCount = tokens.length;
  if (tokenCount > 8) level = "A2";
  if (tokenCount > 12) level = "B1";
  if (grammars.includes("Subjunctive") || grammars.includes("Conditional") || grammars.includes("Perfect")) {
    level = "B2";
  }
  if (tokenCount > 18 || grammars.includes("Subjunctive") && grammars.includes("Perfect")) {
    level = "C1";
  }
  if (metadata?.level) {
    level = metadata.level;
  } else if (Array.isArray(metadata?.tags)) {
    const levelTag = metadata.tags.find((tag) => /^(A1|A2|B1|B2|C1|C2)$/i.test(tag));
    if (levelTag) level = levelTag.toUpperCase();
  }
  if (level === "C2") level = "C1";
  return level;
}

function chooseTargetWord(tokens, vocabulary, grammars) {
  const vocabSet = new Set(vocabulary);
  const grammarSet = new Set(grammars);
  const normalizedTokens = tokens.map(normaliseWord);
  // Prefer vocabulary words
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const normalized = normalizedTokens[i];
    for (const category of vocabSet) {
      const keywords = VOCABULARY_KEYWORDS[category] || [];
      if (keywords.some((keyword) => normaliseWord(keyword) === normalized)) {
        return token;
      }
    }
  }
  // Prefer verbs (basic heuristic: words ending with ar/er/ir or included in grammar cues)
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const normalized = normalizedTokens[i];
    if (/([aá]r|[eé]r|[ií]r)$/.test(normalized) || normalized.endsWith("ndo")) {
      return token;
    }
    if (Array.from(grammarSet).some((grammar) => {
      const list = GRAMMAR_KEYWORDS[grammar] || [];
      return list.some((keyword) => normaliseWord(keyword) === normalized);
    })) {
      return token;
    }
  }
  // Fallback to the longest token longer than 3 characters
  let fallback = tokens[0];
  let maxLength = 0;
  tokens.forEach((token) => {
    const clean = token.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, "");
    if (clean.length > maxLength && clean.length > 3) {
      fallback = token;
      maxLength = clean.length;
    }
  });
  return fallback;
}

function createCloze(sentence, targetWord) {
  if (!targetWord) return null;
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (!regex.test(sentence)) return null;
  const clozeText = sentence.replace(regex, "___");
  return { clozeText, answer: targetWord };
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(/[;,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildFallbackDataset() {
  if (FALLBACK_SENTENCES.length > 0) return FALLBACK_SENTENCES;
  const base = [
    {
      id: "fb_0001",
      text: "Yo preparo la cena todas las noches.",
      answer: "preparo",
      translation: "I prepare dinner every night.",
      grammar: ["Present indicative"],
      vocabulary: ["food", "daily"],
      difficulty: "A2",
    },
    {
      id: "fb_0002",
      text: "Ellos comieron paella en Valencia.",
      answer: "comieron",
      translation: "They ate paella in Valencia.",
      grammar: ["Preterite"],
      vocabulary: ["food", "travel"],
      difficulty: "B1",
    },
    {
      id: "fb_0003",
      text: "Mañana compraremos frutas frescas en el mercado.",
      answer: "compraremos",
      translation: "Tomorrow we will buy fresh fruit at the market.",
      grammar: ["Future"],
      vocabulary: ["shopping", "food"],
      difficulty: "B1",
    },
    {
      id: "fb_0004",
      text: "Mi hermana estudiaba medicina en la universidad.",
      answer: "estudiaba",
      translation: "My sister was studying medicine at the university.",
      grammar: ["Imperfect"],
      vocabulary: ["education", "family"],
      difficulty: "B1",
    },
    {
      id: "fb_0005",
      text: "Si tuviera más tiempo, viajaría por Sudamérica.",
      answer: "viajaría",
      translation: "If I had more time, I would travel through South America.",
      grammar: ["Conditional", "Subjunctive"],
      vocabulary: ["travel"],
      difficulty: "B2",
    },
    {
      id: "fb_0006",
      text: "Es importante que practiques español todos los días.",
      answer: "practiques",
      translation: "It's important that you practice Spanish every day.",
      grammar: ["Subjunctive"],
      vocabulary: ["education", "daily"],
      difficulty: "B2",
    },
    {
      id: "fb_0007",
      text: "Estoy leyendo un libro sobre historia latinoamericana.",
      answer: "leyendo",
      translation: "I am reading a book about Latin American history.",
      grammar: ["Progressive", "Present indicative"],
      vocabulary: ["education", "leisure"],
      difficulty: "B1",
    },
    {
      id: "fb_0008",
      text: "Hemos visitado muchos museos este año.",
      answer: "visitado",
      translation: "We have visited many museums this year.",
      grammar: ["Perfect"],
      vocabulary: ["travel", "leisure"],
      difficulty: "B2",
    },
    {
      id: "fb_0009",
      text: "Por favor, envía el informe antes de las cinco.",
      answer: "envía",
      translation: "Please send the report before five.",
      grammar: ["Imperative"],
      vocabulary: ["work"],
      difficulty: "B1",
    },
    {
      id: "fb_0010",
      text: "Los niños juegan en el parque después de la escuela.",
      answer: "juegan",
      translation: "The children play in the park after school.",
      grammar: ["Present indicative"],
      vocabulary: ["leisure", "family"],
      difficulty: "A2",
    },
    {
      id: "fb_0011",
      text: "Cuando era pequeño, vivía con mis abuelos.",
      answer: "vivía",
      translation: "When I was little, I lived with my grandparents.",
      grammar: ["Imperfect"],
      vocabulary: ["family"],
      difficulty: "A2",
    },
    {
      id: "fb_0012",
      text: "Compra los boletos en línea para obtener un descuento.",
      answer: "Compra",
      translation: "Buy the tickets online to get a discount.",
      grammar: ["Imperative"],
      vocabulary: ["travel", "shopping"],
      difficulty: "B1",
    },
    {
      id: "fb_0013",
      text: "Nos veremos con el jefe mañana a las nueve.",
      answer: "veremos",
      translation: "We will meet with the boss tomorrow at nine.",
      grammar: ["Future"],
      vocabulary: ["work"],
      difficulty: "B1",
    },
    {
      id: "fb_0014",
      text: "Quiero que vengas a cenar el sábado.",
      answer: "vengas",
      translation: "I want you to come to dinner on Saturday.",
      grammar: ["Subjunctive"],
      vocabulary: ["food", "family"],
      difficulty: "B2",
    },
    {
      id: "fb_0015",
      text: "Mi hermano menor está aprendiendo a conducir.",
      answer: "aprendiendo",
      translation: "My younger brother is learning to drive.",
      grammar: ["Progressive"],
      vocabulary: ["family", "daily"],
      difficulty: "B1",
    },
    {
      id: "fb_0016",
      text: "Habíamos planeado ir a la playa, pero llovió.",
      answer: "planeado",
      translation: "We had planned to go to the beach, but it rained.",
      grammar: ["Perfect", "Preterite"],
      vocabulary: ["travel", "leisure"],
      difficulty: "B2",
    },
    {
      id: "fb_0017",
      text: "Necesito pagar la factura de la luz hoy mismo.",
      answer: "pagar",
      translation: "I need to pay the electricity bill today.",
      grammar: ["Infinitive"],
      vocabulary: ["shopping", "daily"],
      difficulty: "A2",
    },
    {
      id: "fb_0018",
      text: "¿Has visto mi cartera en la mesa?",
      answer: "visto",
      translation: "Have you seen my wallet on the table?",
      grammar: ["Perfect"],
      vocabulary: ["daily"],
      difficulty: "B1",
    },
    {
      id: "fb_0019",
      text: "Es probable que ellos lleguen tarde por el tráfico.",
      answer: "lleguen",
      translation: "It's likely that they will arrive late because of traffic.",
      grammar: ["Subjunctive"],
      vocabulary: ["travel", "daily"],
      difficulty: "B2",
    },
    {
      id: "fb_0020",
      text: "Ojalá pudiéramos quedarnos una semana más.",
      answer: "pudiéramos",
      translation: "I wish we could stay one more week.",
      grammar: ["Subjunctive", "Conditional"],
      vocabulary: ["travel"],
      difficulty: "C1",
    },
    {
      id: "fb_0021",
      text: "Lávate las manos antes de preparar la comida.",
      answer: "Lávate",
      translation: "Wash your hands before preparing the food.",
      grammar: ["Imperative"],
      vocabulary: ["daily", "food", "health"],
      difficulty: "A2",
    },
    {
      id: "fb_0022",
      text: "Ayer corrí cinco kilómetros en el parque.",
      answer: "corrí",
      translation: "Yesterday I ran five kilometers in the park.",
      grammar: ["Preterite"],
      vocabulary: ["health", "leisure"],
      difficulty: "A2",
    },
    {
      id: "fb_0023",
      text: "El médico recomienda que descanses dos días.",
      answer: "descanses",
      translation: "The doctor recommends that you rest for two days.",
      grammar: ["Subjunctive"],
      vocabulary: ["health"],
      difficulty: "B2",
    },
    {
      id: "fb_0024",
      text: "Para llegar al museo, toma el metro hasta la tercera parada.",
      answer: "toma",
      translation: "To get to the museum, take the subway to the third stop.",
      grammar: ["Imperative"],
      vocabulary: ["travel"],
      difficulty: "B1",
    },
    {
      id: "fb_0025",
      text: "Mis padres se conocieron cuando estudiaban en Madrid.",
      answer: "estudiaban",
      translation: "My parents met when they were studying in Madrid.",
      grammar: ["Imperfect"],
      vocabulary: ["family", "education"],
      difficulty: "B1",
    },
    {
      id: "fb_0026",
      text: "¿Cuánto cuesta este abrigo de lana?",
      answer: "cuesta",
      translation: "How much does this wool coat cost?",
      grammar: ["Present indicative"],
      vocabulary: ["shopping"],
      difficulty: "A1",
    },
    {
      id: "fb_0027",
      text: "Siempre guardo mis documentos importantes en la nube.",
      answer: "guardo",
      translation: "I always store my important documents in the cloud.",
      grammar: ["Present indicative"],
      vocabulary: ["technology", "work"],
      difficulty: "B1",
    },
    {
      id: "fb_0028",
      text: "Estoy configurando la aplicación nueva en mi teléfono.",
      answer: "configurando",
      translation: "I am setting up the new app on my phone.",
      grammar: ["Progressive"],
      vocabulary: ["technology"],
      difficulty: "B1",
    },
    {
      id: "fb_0029",
      text: "Me alegra que participes en el proyecto.",
      answer: "participes",
      translation: "I'm glad that you participate in the project.",
      grammar: ["Subjunctive"],
      vocabulary: ["work"],
      difficulty: "B2",
    },
    {
      id: "fb_0030",
      text: "Deberíamos reservar el hotel con anticipación.",
      answer: "reservar",
      translation: "We should book the hotel in advance.",
      grammar: ["Infinitive", "Conditional"],
      vocabulary: ["travel"],
      difficulty: "B1",
    },
  ];
  // Additional generated variations to increase coverage
  const extras = [];
  base.forEach((item) => {
    const trimmed = item.text.replace(/[.!?¡¿]+$/, "");
    const translationTrimmed = item.translation.replace(/[.!?]+$/, "");
    extras.push({
      ...item,
      id: `${item.id}_a`,
      text: `${trimmed} hoy.`,
      translation: `${translationTrimmed} today.`,
    });
    extras.push({
      ...item,
      id: `${item.id}_b`,
      text: `${trimmed} con mis amigos.`,
      translation: `${translationTrimmed} with my friends.`,
    });
  });
  FALLBACK_SENTENCES.push(...base, ...extras);
  return FALLBACK_SENTENCES;
}

function formatFallbackEntry(item) {
  const tokens = splitWords(item.text);
  return {
    id: item.id,
    sourceId: item.id,
    source: "fallback",
    text: item.text,
    clozeText: item.text.replace(item.answer, "___"),
    answer: item.answer,
    tokens,
    grammar: item.grammar || [],
    vocabulary: item.vocabulary || [],
    difficulty: item.difficulty || "A2",
    tags: [],
    translations: item.translation
      ? [{ id: `${item.id}_en`, lang: "eng", text: item.translation }]
      : [],
    hint: item.translation || "",
  };
}

function gatherTranslations(id, linksMap, sentenceMap, detailedMap, extraTranslations) {
  const results = [];
  const linkIds = linksMap.get(id) || [];
  linkIds.forEach((linkedId) => {
    const sentence = sentenceMap.get(linkedId) || extraTranslations.get(linkedId);
    if (sentence) {
      results.push({
        id: linkedId,
        lang: sentence.lang || "unknown",
        text: sentence.text || null,
      });
    } else if (detailedMap.has(linkedId)) {
      const detail = detailedMap.get(linkedId);
      results.push({ id: linkedId, lang: detail.lang || "unknown", text: detail.text || null });
    }
  });
  return results.slice(0, 3);
}

class DataPipeline {
  constructor(storageManager) {
    this.storage = storageManager;
    this.sentences = [];
    this.byId = new Map();
    this.answerBank = { vocabulary: {}, grammar: {} };
    this.summary = { grammar: {}, vocabulary: {}, difficulty: {} };
    this.datasetVersion = DATA_VERSION;
  }

  async init() {
    const cached = this.storage.getCache("dataset");
    if (cached && cached.version === DATA_VERSION && Array.isArray(cached.sentences) && cached.sentences.length) {
      this.sentences = cached.sentences;
      this.datasetVersion = cached.version;
      this.indexSentences();
      this.summary = cached.summary || this.summary;
      return this.sentences;
    }
    try {
      const processed = await this.loadFromFiles();
      if (processed.sentences.length) {
        this.sentences = processed.sentences;
        this.summary = processed.summary;
        this.datasetVersion = DATA_VERSION;
        this.indexSentences();
        this.storage.setCache("dataset", {
          version: DATA_VERSION,
          sentences: this.sentences,
          summary: this.summary,
          cachedAt: todayStr(),
        });
        return this.sentences;
      }
    } catch (err) {
      console.warn("Failed to build dataset from files", err);
    }
    const fallback = buildFallbackDataset();
    this.sentences = fallback.map((item) => formatFallbackEntry(item));
    this.indexSentences();
    this.summary = this.computeSummary();
    return this.sentences;
  }

  async loadFromFiles() {
    const [sentencesText, detailedText, linksText, extraJson] = await Promise.all([
      this.fetchMaybe("./spa_sentences.tsv"),
      this.fetchMaybe("./spa_sentences_detailed.tsv"),
      this.fetchMaybe("./links.csv"),
      this.fetchMaybe("./sentences.json"),
    ]);
    const baseSentences = this.parseSentences(sentencesText);
    const detailed = this.parseDetailed(detailedText);
    const links = this.parseLinks(linksText);
    const extraTranslations = this.parseExtraTranslations(extraJson);
    const sentences = this.buildDataset(baseSentences, detailed, links, extraTranslations);
    const summary = this.computeSummary(sentences);
    return { sentences, summary };
  }

  async fetchMaybe(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to fetch ${path}`);
      const text = await response.text();
      if (text.startsWith("version https://git-lfs.github.com/spec/v1")) {
        return "";
      }
      return text;
    } catch (err) {
      console.warn(`Unable to fetch ${path}`, err);
      return "";
    }
  }

  parseSentences(text) {
    const map = new Map();
    if (!text) return map;
    const lines = text.split(/\r?\n/);
    lines.forEach((line) => {
      if (!line || line.startsWith("#")) return;
      const parts = line.split("\t");
      if (parts.length < 3) return;
      const id = Number.parseInt(parts[0], 10);
      if (Number.isNaN(id)) return;
      const lang = parts[1];
      const sentenceText = parts.slice(2).join("\t");
      map.set(id, { id, lang, text: sentenceText.trim() });
    });
    return map;
  }

  parseDetailed(text) {
    const map = new Map();
    if (!text) return map;
    const lines = text.split(/\r?\n/);
    lines.forEach((line) => {
      if (!line || line.startsWith("#")) return;
      const parts = line.split("\t");
      if (parts.length < 3) return;
      const id = Number.parseInt(parts[0], 10);
      if (Number.isNaN(id)) return;
      const lang = parts[1];
      const sentenceText = parts[2];
      const tagsRaw = parts[parts.length - 1];
      const tags = parseTags(tagsRaw);
      const meta = { id, lang, text: sentenceText, tags };
      // Attempt to parse difficulty if present in columns
      const difficultyIndex = parts.findIndex((part) => /^(A1|A2|B1|B2|C1|C2)$/i.test(part));
      if (difficultyIndex >= 0) {
        meta.level = parts[difficultyIndex].toUpperCase();
      }
      map.set(id, meta);
    });
    return map;
  }

  parseLinks(text) {
    const map = new Map();
    if (!text) return map;
    const lines = text.split(/\r?\n/);
    lines.forEach((line) => {
      if (!line || line.startsWith("#")) return;
      const parts = line.split(",");
      if (parts.length < 2) return;
      const a = Number.parseInt(parts[0], 10);
      const b = Number.parseInt(parts[1], 10);
      if (Number.isNaN(a) || Number.isNaN(b)) return;
      if (!map.has(a)) map.set(a, new Set());
      if (!map.has(b)) map.set(b, new Set());
      map.get(a).add(b);
      map.get(b).add(a);
    });
    return map;
  }

  parseExtraTranslations(text) {
    const map = new Map();
    if (!text) return map;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (!item || typeof item !== "object") return;
          if (!item.id) return;
          map.set(Number.parseInt(item.id, 10) || item.id, item);
        });
      } else if (parsed && typeof parsed === "object") {
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(Number.parseInt(key, 10) || key, value);
        });
      }
    } catch (err) {
      console.warn("Unable to parse extra translations JSON", err);
    }
    return map;
  }

  buildDataset(sentencesMap, detailedMap, linksMap, extraTranslations) {
    const entries = [];
    const allIds = Array.from(sentencesMap.keys());
    for (const id of allIds) {
      const base = sentencesMap.get(id);
      if (!base || base.lang !== "spa") continue;
      const metadata = detailedMap.get(id);
      const text = metadata?.text || base.text;
      if (!text || text.length < 4) continue;
      const tokens = splitWords(text);
      if (tokens.length < 3 || tokens.length > 28) continue;
      const vocabulary = detectVocabulary(tokens);
      const grammar = detectGrammar(tokens);
      const difficulty = determineDifficulty(grammar, tokens, metadata);
      const { clozeText, answer } = createCloze(text, chooseTargetWord(tokens, vocabulary, grammar)) || {};
      if (!clozeText || !answer) continue;
      const translations = gatherTranslations(id, linksMap, sentencesMap, detailedMap, extraTranslations);
      const tags = Array.from(new Set([...(metadata?.tags || [])]));
      entries.push({
        id: `spa_${id}`,
        sourceId: id,
        source: "tatoeba",
        text,
        clozeText,
        answer,
        tokens,
        grammar,
        vocabulary,
        difficulty,
        tags,
        translations,
        hint: translations.find((t) => t.lang && t.lang.startsWith("en"))?.text || "",
      });
      if (entries.length >= MAX_SENTENCE_COUNT) break;
    }
    if (entries.length === 0) return buildFallbackDataset().map((item) => formatFallbackEntry(item));
    return entries;
  }

  indexSentences() {
    this.byId = new Map();
    this.answerBank = { vocabulary: {}, grammar: {} };
    this.sentences.forEach((item) => {
      this.byId.set(item.id, item);
      (item.vocabulary || []).forEach((category) => {
        if (!this.answerBank.vocabulary[category]) this.answerBank.vocabulary[category] = new Set();
        this.answerBank.vocabulary[category].add(item.answer);
      });
      (item.grammar || []).forEach((category) => {
        if (!this.answerBank.grammar[category]) this.answerBank.grammar[category] = new Set();
        this.answerBank.grammar[category].add(item.answer);
      });
    });
    Object.keys(this.answerBank.vocabulary).forEach((key) => {
      this.answerBank.vocabulary[key] = Array.from(this.answerBank.vocabulary[key]);
    });
    Object.keys(this.answerBank.grammar).forEach((key) => {
      this.answerBank.grammar[key] = Array.from(this.answerBank.grammar[key]);
    });
  }

  computeSummary(source = this.sentences) {
    const summary = { grammar: {}, vocabulary: {}, difficulty: {} };
    source.forEach((item) => {
      (item.grammar || []).forEach((category) => {
        summary.grammar[category] = (summary.grammar[category] || 0) + 1;
      });
      (item.vocabulary || []).forEach((category) => {
        summary.vocabulary[category] = (summary.vocabulary[category] || 0) + 1;
      });
      if (item.difficulty) {
        summary.difficulty[item.difficulty] = (summary.difficulty[item.difficulty] || 0) + 1;
      }
    });
    return summary;
  }

  getSentenceById(id) {
    return this.byId.get(id) || null;
  }

  getAssessmentSeed(target = 80) {
    if (!this.sentences.length) return [];
    const limit = Math.min(Math.max(50, target), Math.min(100, this.sentences.length));
    const byDifficulty = new Map();
    this.sentences.forEach((item) => {
      if (!byDifficulty.has(item.difficulty)) byDifficulty.set(item.difficulty, []);
      byDifficulty.get(item.difficulty).push(item);
    });
    const order = ["A1", "A2", "B1", "B2", "C1"];
    const result = [];
    order.forEach((level) => {
      const bucket = byDifficulty.get(level) || [];
      bucket.slice(0, Math.ceil(limit / order.length)).forEach((item) => result.push(item));
    });
    if (result.length < limit) {
      const remaining = this.sentences.filter((item) => !result.includes(item));
      shuffleInPlace(remaining);
      remaining.slice(0, limit - result.length).forEach((item) => result.push(item));
    }
    shuffleInPlace(result);
    return result.slice(0, limit);
  }

  getPracticePool(options = {}) {
    const {
      grammar = [],
      vocabulary = [],
      difficulty = [],
      categories = [],
      limit = 40,
      excludeIds = [],
    } = options;
    const excludeSet = new Set(excludeIds);
    const result = this.sentences.filter((item) => {
      if (excludeSet.has(item.id)) return false;
      if (grammar.length && !item.grammar.some((g) => grammar.includes(g))) return false;
      if (vocabulary.length && !item.vocabulary.some((v) => vocabulary.includes(v))) return false;
      if (difficulty.length && !difficulty.includes(item.difficulty)) return false;
      if (categories.length) {
        const union = new Set([...(item.grammar || []), ...(item.vocabulary || [])]);
        const hasCat = categories.some((cat) => union.has(cat));
        if (!hasCat) return false;
      }
      return true;
    });
    shuffleInPlace(result);
    return result.slice(0, limit);
  }

  getDistractors(answer, categories = {}) {
    const opts = new Set();
    const { vocabulary = [], grammar = [] } = categories;
    vocabulary.forEach((cat) => {
      (this.answerBank.vocabulary[cat] || []).forEach((word) => {
        if (word !== answer) opts.add(word);
      });
    });
    grammar.forEach((cat) => {
      (this.answerBank.grammar[cat] || []).forEach((word) => {
        if (word !== answer) opts.add(word);
      });
    });
    if (opts.size < 3) {
      this.sentences.forEach((item) => {
        if (item.answer !== answer) opts.add(item.answer);
      });
    }
    const arr = Array.from(opts);
    shuffleInPlace(arr);
    return arr.slice(0, 3);
  }

  categories() {
    const grammar = Object.keys(this.summary.grammar || {});
    const vocabulary = Object.keys(this.summary.vocabulary || {});
    const difficulty = Object.keys(this.summary.difficulty || {});
    return { grammar, vocabulary, difficulty };
  }
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export { DataPipeline, VOCABULARY_KEYWORDS, GRAMMAR_KEYWORDS, DATA_VERSION };
