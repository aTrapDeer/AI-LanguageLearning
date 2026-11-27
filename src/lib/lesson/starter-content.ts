import { getUnitsForLevel } from "@/lib/curriculum";
import type { SupportedLanguageCode } from "@/lib/language-config";
import type { GeneratedLessonContent } from "./content";

/**
 * Hand-written lessons for the very first unit (greetings) in every language, so a brand-new learner
 * always gets a complete, correct lesson even when generation is unavailable.
 *
 * No item has a picture: greetings and courtesy phrases can't be drawn without either text or a
 * scene that could mean several of them, and a misleading picture is worse than none.
 */

export const STARTER_UNIT_ID = getUnitsForLevel(1)[0].id;

type Vocab = GeneratedLessonContent["vocabulary"][number];
type Sentence = GeneratedLessonContent["sentences"][number];

function v(
  word: string,
  translation: string,
  partOfSpeech: string,
  example: [string, string, string?],
  extra: { romanization?: string; alternatives?: string[]; picture?: string } = {}
): Vocab {
  return {
    word,
    translation,
    romanization: extra.romanization ?? null,
    partOfSpeech,
    alternatives: extra.alternatives ?? [],
    example: example[0],
    exampleTranslation: example[1],
    exampleRomanization: example[2] ?? null,
    picture: extra.picture ?? null,
  };
}

function s(text: string, translation: string, focusWord: string | null, extra: { romanization?: string; words?: string[] } = {}): Sentence {
  return { text, translation, romanization: extra.romanization ?? null, words: extra.words ?? [], focusWord, alternatives: [] };
}

const STARTER_CONTENT: Record<SupportedLanguageCode, GeneratedLessonContent> = {
  de: {
    title: "Hello & Goodbye",
    vocabulary: [
      v("Hallo", "hello", "interjection", ["Hallo, Anna!", "Hi, Anna!"]),
      v("Guten Morgen", "good morning", "phrase", ["Guten Morgen, Frau Schmidt!", "Good morning, Mrs. Schmidt!"]),
      v("Tschüss", "bye (casual)", "interjection", ["Danke und tschüss!", "Thanks and bye!"], { alternatives: ["Tschüs"] }),
      v("Auf Wiedersehen", "goodbye (formal)", "phrase", ["Auf Wiedersehen, Herr Weber!", "Goodbye, Mr. Weber!"]),
      v("Danke", "thank you", "interjection", ["Danke, das ist nett!", "Thanks, that's kind!"]),
      v("Bitte", "please", "adverb", ["Einen Kaffee, bitte.", "A coffee, please."]),
      v("Entschuldigung", "excuse me", "interjection", ["Entschuldigung, Herr Weber!", "Excuse me, Mr. Weber!"]),
    ],
    sentences: [
      s("Hallo, Anna!", "Hi, Anna!", "Hallo"),
      s("Guten Morgen, Frau Schmidt!", "Good morning, Mrs. Schmidt!", "Guten Morgen"),
      s("Danke und tschüss!", "Thanks and bye!", "Tschüss"),
      s("Einen Kaffee, bitte.", "A coffee, please.", "Bitte"),
      s("Entschuldigung, Herr Weber!", "Excuse me, Mr. Weber!", "Entschuldigung"),
      s("Auf Wiedersehen und danke!", "Goodbye and thank you!", "Auf Wiedersehen"),
    ],
    tip: {
      title: "Formal or casual?",
      body: "Use Hallo and Tschüss with friends. With strangers, in shops or at work, say Guten Morgen or Guten Tag and Auf Wiedersehen, and address people as Herr or Frau plus their last name.",
    },
    culture:
      "Germans usually greet shop staff with “Guten Tag” when they walk in and say “Tschüss” or “Auf Wiedersehen” on the way out — leaving without a word can come across as rude.",
  },
  "pt-BR": {
    title: "Hello & Goodbye",
    vocabulary: [
      v("Oi", "hi", "interjection", ["Oi, Ana! Tudo bem?", "Hi, Ana! How are you?"]),
      v("Bom dia", "good morning", "phrase", ["Bom dia, dona Maria!", "Good morning, Mrs. Maria!"]),
      v("Boa noite", "good evening", "phrase", ["Boa noite, pessoal!", "Good evening, everyone!"]),
      v("Tchau", "bye (casual)", "interjection", ["Obrigado e tchau!", "Thanks and bye!"]),
      v("Obrigado", "thank you", "interjection", ["Muito obrigado!", "Thank you very much!"], { alternatives: ["Obrigada"] }),
      v("Por favor", "please", "phrase", ["Um café, por favor.", "A coffee, please."]),
      v("Desculpa", "sorry", "interjection", ["Desculpa, Pedro!", "Sorry, Pedro!"]),
    ],
    sentences: [
      s("Oi, Ana! Tudo bem?", "Hi, Ana! How are you?", "Oi"),
      s("Bom dia, dona Maria!", "Good morning, Mrs. Maria!", "Bom dia"),
      s("Boa noite, pessoal!", "Good evening, everyone!", "Boa noite"),
      s("Obrigado e tchau!", "Thanks and bye!", "Tchau"),
      s("Um café, por favor.", "A coffee, please.", "Por favor"),
      s("Desculpa, Pedro!", "Sorry, Pedro!", "Desculpa"),
    ],
    tip: {
      title: "Obrigado or obrigada?",
      body: "“Thank you” agrees with the speaker: men say obrigado, women say obrigada. Oi and tchau are casual; bom dia, boa tarde and boa noite work with anyone.",
    },
    culture:
      "Brazilians often greet friends with a hug or a kiss on the cheek, and “Tudo bem?” (all good?) is used almost like hello — the usual answer is simply “Tudo!”",
  },
  zh: {
    title: "Hello & Goodbye",
    vocabulary: [
      v("你好", "hello", "phrase", ["你好，请喝茶。", "Hi, please have some tea.", "Nǐ hǎo, qǐng hē chá."], { romanization: "nǐ hǎo" }),
      v("您好", "hello (polite)", "phrase", ["老师，您好！", "Hello, teacher!", "Lǎoshī, nín hǎo!"], { romanization: "nín hǎo" }),
      v("早上好", "good morning", "phrase", ["王老师，早上好！", "Good morning, Teacher Wang!", "Wáng lǎoshī, zǎoshang hǎo!"], {
        romanization: "zǎoshang hǎo",
      }),
      v("再见", "goodbye", "phrase", ["再见，明天见！", "Goodbye, see you tomorrow!", "Zàijiàn, míngtiān jiàn!"], { romanization: "zàijiàn" }),
      v("谢谢", "thank you", "verb", ["谢谢你！", "Thank you!", "Xièxie nǐ!"], { romanization: "xièxie" }),
      v("不客气", "you're welcome", "phrase", ["谢谢！不客气。", "Thank you! — You're welcome.", "Xièxie! Bú kèqi."], { romanization: "bú kèqi" }),
      v("对不起", "sorry", "phrase", ["对不起！没关系。", "Sorry! — That's okay.", "Duìbuqǐ! Méi guānxi."], { romanization: "duìbuqǐ" }),
      v("请", "please", "verb", ["请坐。", "Please sit down.", "Qǐng zuò."], { romanization: "qǐng" }),
    ],
    sentences: [
      s("老师，您好！", "Hello, teacher!", "您好", { romanization: "Lǎoshī, nín hǎo!", words: ["老师", "您好"] }),
      s("王老师，早上好！", "Good morning, Teacher Wang!", "早上好", { romanization: "Wáng lǎoshī, zǎoshang hǎo!", words: ["王", "老师", "早上好"] }),
      s("谢谢！不客气。", "Thank you! — You're welcome.", "不客气", { romanization: "Xièxie! Bú kèqi.", words: ["谢谢", "不客气"] }),
      s("对不起！没关系。", "Sorry! — That's okay.", "对不起", { romanization: "Duìbuqǐ! Méi guānxi.", words: ["对不起", "没关系"] }),
      s("再见，明天见！", "Goodbye, see you tomorrow!", "再见", { romanization: "Zàijiàn, míngtiān jiàn!", words: ["再见", "明天", "见"] }),
      s("你好，请喝茶。", "Hi, please have some tea.", "请", { romanization: "Nǐ hǎo, qǐng hē chá.", words: ["你好", "请", "喝", "茶"] }),
      s("谢谢你，再见！", "Thank you, goodbye!", "谢谢", { romanization: "Xièxie nǐ, zàijiàn!", words: ["谢谢", "你", "再见"] }),
    ],
    tip: {
      title: "Be polite with 您",
      body: "Use 您 (nín) instead of 你 (nǐ) to show respect to elders, teachers and strangers: 您好 is the respectful hello. Titles come after the surname: 王老师 is “Teacher Wang”.",
    },
    culture:
      "Chinese speakers often greet people by their title — 老师 (teacher), 医生 (doctor) — and a traditional friendly greeting is 你吃了吗？ “Have you eaten?”",
  },
  no: {
    title: "Hello & Goodbye",
    vocabulary: [
      v("Hei", "hi", "interjection", ["Hei, Kari!", "Hi, Kari!"]),
      v("God morgen", "good morning", "phrase", ["God morgen, Ola!", "Good morning, Ola!"]),
      v("God kveld", "good evening", "phrase", ["God kveld, alle sammen!", "Good evening, everyone!"]),
      v("Ha det", "bye", "phrase", ["Ha det, vi ses!", "Bye, see you!"], { alternatives: ["Ha det bra"] }),
      v("Takk", "thanks", "interjection", ["Takk for maten!", "Thanks for the food!"]),
      v("Tusen takk", "thank you very much", "phrase", ["Tusen takk, Lise!", "Thank you so much, Lise!"]),
      v("Unnskyld", "excuse me", "interjection", ["Unnskyld, snakker du engelsk?", "Excuse me, do you speak English?"]),
    ],
    sentences: [
      s("Hei, Kari!", "Hi, Kari!", "Hei"),
      s("God morgen, Ola!", "Good morning, Ola!", "God morgen"),
      s("Takk for maten!", "Thanks for the food!", "Takk"),
      s("Unnskyld, snakker du engelsk?", "Excuse me, do you speak English?", "Unnskyld"),
      s("Ha det, vi ses!", "Bye, see you!", "Ha det"),
      s("Tusen takk, Lise!", "Thank you so much, Lise!", "Tusen takk"),
      s("En kaffe, takk.", "A coffee, please.", "Takk"),
    ],
    tip: {
      title: "Takk does the job of “please”",
      body: "Norwegian has no everyday word for “please”. When you order, just add takk: “En kaffe, takk.” Norwegians use first names and the informal du with almost everyone.",
    },
    culture:
      "After a meal Norwegians thank the host with “Takk for maten” (thanks for the food) — children say it to their parents at home, too.",
  },
  ko: {
    title: "Hello & Goodbye",
    vocabulary: [
      v("안녕하세요", "hello (polite)", "phrase", ["선생님, 안녕하세요!", "Hello, teacher!", "Seonsaengnim, annyeonghaseyo!"], {
        romanization: "annyeonghaseyo",
      }),
      v("안녕", "hi (casual)", "interjection", ["민수야, 안녕!", "Hi, Minsu!", "Minsuya, annyeong!"], { romanization: "annyeong" }),
      v("감사합니다", "thank you (polite)", "phrase", ["정말 감사합니다!", "Thank you so much!", "Jeongmal gamsahamnida!"], {
        romanization: "gamsahamnida",
      }),
      v("고마워", "thanks (casual)", "phrase", ["민수야, 고마워!", "Thanks, Minsu!", "Minsuya, gomawo!"], { romanization: "gomawo" }),
      v("죄송합니다", "I'm sorry (polite)", "phrase", ["늦어서 죄송합니다.", "I'm sorry I'm late.", "Neujeoseo joesonghamnida."], {
        romanization: "joesonghamnida",
      }),
      v("안녕히 가세요", "goodbye (to someone leaving)", "phrase", ["선생님, 안녕히 가세요!", "Goodbye, teacher! (as the teacher leaves)", "Seonsaengnim, annyeonghi gaseyo!"], {
        romanization: "annyeonghi gaseyo",
      }),
      v("안녕히 계세요", "goodbye (when you leave)", "phrase", ["안녕히 계세요!", "Goodbye! (as you leave)", "Annyeonghi gyeseyo!"], {
        romanization: "annyeonghi gyeseyo",
      }),
      v("주세요", "please give me", "verb", ["커피 주세요.", "Coffee, please.", "Keopi juseyo."], { romanization: "juseyo" }),
    ],
    sentences: [
      s("선생님, 안녕하세요!", "Hello, teacher!", "안녕하세요", { romanization: "Seonsaengnim, annyeonghaseyo!" }),
      s("민수야, 안녕!", "Hi, Minsu!", "안녕", { romanization: "Minsuya, annyeong!" }),
      s("정말 감사합니다!", "Thank you so much!", "감사합니다", { romanization: "Jeongmal gamsahamnida!" }),
      s("늦어서 죄송합니다.", "I'm sorry I'm late.", "죄송합니다", { romanization: "Neujeoseo joesonghamnida." }),
      s("커피 주세요.", "Coffee, please.", "주세요", { romanization: "Keopi juseyo." }),
      s("민수야, 고마워!", "Thanks, Minsu!", "고마워", { romanization: "Minsuya, gomawo!" }),
      s("선생님, 안녕히 가세요!", "Goodbye, teacher! (as the teacher leaves)", "안녕히 가세요", {
        romanization: "Seonsaengnim, annyeonghi gaseyo!",
      }),
    ],
    tip: {
      title: "Polite endings",
      body: "Korean shows politeness in the word ending. 안녕하세요, 감사합니다 and 죄송합니다 are polite — use them with anyone you don't know well. Casual 안녕 and 고마워 are for close friends and people younger than you.",
    },
    culture:
      "Koreans say goodbye based on who is leaving: 안녕히 가세요 (“go in peace”) to the person who leaves, 안녕히 계세요 (“stay in peace”) to the person who stays. A small bow usually goes with a greeting.",
  },
  ar: {
    title: "Hello & Goodbye",
    vocabulary: [
      v("مرحبًا", "hello", "interjection", ["مرحبًا يا أحمد!", "Hello, Ahmad!", "marhaban ya Ahmad!"], { romanization: "marhaban" }),
      v("السلام عليكم", "peace be upon you", "phrase", ["السلام عليكم! وعليكم السلام.", "Peace be upon you! — And upon you be peace.", "as-salamu alaykum! wa alaykum as-salam."], {
        romanization: "as-salamu alaykum",
      }),
      v("صباح الخير", "good morning", "phrase", ["صباح الخير يا سارة!", "Good morning, Sara!", "sabah al-khayr ya Sara!"], {
        romanization: "sabah al-khayr",
      }),
      v("مع السلامة", "goodbye", "phrase", ["مع السلامة يا صديقي!", "Goodbye, my friend!", "ma'a as-salama ya sadiqi!"], {
        romanization: "ma'a as-salama",
      }),
      v("شكرًا", "thank you", "interjection", ["شكرًا يا سارة!", "Thank you, Sara!", "shukran ya Sara!"], { romanization: "shukran" }),
      v("عفوًا", "you're welcome", "interjection", ["شكرًا! عفوًا.", "Thank you! — You're welcome.", "shukran! afwan."], { romanization: "afwan" }),
      v("من فضلك", "please", "phrase", ["قهوة، من فضلك.", "Coffee, please.", "qahwa, min fadlak."], { romanization: "min fadlak" }),
    ],
    sentences: [
      s("مرحبًا يا أحمد!", "Hello, Ahmad!", "مرحبًا", { romanization: "marhaban ya Ahmad!" }),
      s("صباح الخير يا سارة!", "Good morning, Sara!", "صباح الخير", { romanization: "sabah al-khayr ya Sara!" }),
      s("السلام عليكم! وعليكم السلام.", "Peace be upon you! — And upon you be peace.", "السلام عليكم", {
        romanization: "as-salamu alaykum! wa alaykum as-salam.",
      }),
      s("شكرًا! عفوًا.", "Thank you! — You're welcome.", "عفوًا", { romanization: "shukran! afwan." }),
      s("قهوة، من فضلك.", "Coffee, please.", "من فضلك", { romanization: "qahwa, min fadlak." }),
      s("مع السلامة يا صديقي!", "Goodbye, my friend!", "مع السلامة", { romanization: "ma'a as-salama ya sadiqi!" }),
      s("شكرًا يا سارة!", "Thank you, Sara!", "شكرًا", { romanization: "shukran ya Sara!" }),
    ],
    tip: {
      title: "Answer peace with peace",
      body: "When someone says السلام عليكم (as-salamu alaykum), reply وعليكم السلام (wa alaykum as-salam) — “and upon you be peace”. مرحبًا (marhaban) is a friendly hello you can use with anyone.",
    },
    culture:
      "In much of the Arab world greetings take time: people ask about your health and family before getting down to business, and a handshake is given with the right hand.",
  },
};

/** Starter content for (language, unit), or null when there is none for that unit. */
export function getStarterContent(language: string, unitId: string): GeneratedLessonContent | null {
  if (unitId !== STARTER_UNIT_ID) {
    return null;
  }
  return (STARTER_CONTENT as Record<string, GeneratedLessonContent>)[language] ?? null;
}
