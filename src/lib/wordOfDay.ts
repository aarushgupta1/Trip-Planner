import { Trip, generateTripDates, getCityForDate } from './trip';

export type TripLanguage = 'German' | 'Czech' | 'French' | 'Spanish' | 'Italian' | 'Portuguese' | 'Japanese' | 'Dutch';

interface WordEntry {
  word: string;
  translation: string;
}

// A small curated phrasebook per language — practical, trip-useful phrases
// rather than random vocabulary, since the point is to actually use a word
// or two while you're there. Only languages listed here get a word of the
// day; a trip to anywhere else just doesn't show one.
const PHRASEBOOKS: Record<TripLanguage, WordEntry[]> = {
  German: [
    { word: 'Guten Tag', translation: 'good day / hello' },
    { word: 'Danke', translation: 'thank you' },
    { word: 'Bitte', translation: 'please / you’re welcome' },
    { word: 'Entschuldigung', translation: 'excuse me / sorry' },
    { word: 'Prost', translation: 'cheers' },
    { word: 'Guten Morgen', translation: 'good morning' },
    { word: 'Wie viel kostet das?', translation: 'how much does that cost?' },
    { word: 'Lecker', translation: 'delicious' },
    { word: 'Wo ist...?', translation: 'where is...?' },
    { word: 'Auf Wiedersehen', translation: 'goodbye' },
    { word: 'Ja', translation: 'yes' },
    { word: 'Nein', translation: 'no' },
    { word: 'Wasser', translation: 'water' },
    { word: 'Toilette', translation: 'bathroom' },
  ],
  Czech: [
    { word: 'Dobrý den', translation: 'good day / hello' },
    { word: 'Děkuji', translation: 'thank you' },
    { word: 'Prosím', translation: 'please / you’re welcome' },
    { word: 'Promiňte', translation: 'excuse me / sorry' },
    { word: 'Na zdraví', translation: 'cheers' },
    { word: 'Dobré ráno', translation: 'good morning' },
    { word: 'Kolik to stojí?', translation: 'how much does that cost?' },
    { word: 'Chutné', translation: 'delicious' },
    { word: 'Kde je...?', translation: 'where is...?' },
    { word: 'Na shledanou', translation: 'goodbye' },
    { word: 'Ano', translation: 'yes' },
    { word: 'Ne', translation: 'no' },
    { word: 'Voda', translation: 'water' },
    { word: 'Toaleta', translation: 'bathroom' },
  ],
  French: [
    { word: 'Bonjour', translation: 'hello / good day' },
    { word: 'Merci', translation: 'thank you' },
    { word: 'S’il vous plaît', translation: 'please' },
    { word: 'Excusez-moi', translation: 'excuse me / sorry' },
    { word: 'Santé', translation: 'cheers' },
    { word: 'Bonne journée', translation: 'have a good day' },
    { word: 'Combien ça coûte ?', translation: 'how much does that cost?' },
    { word: 'Délicieux', translation: 'delicious' },
    { word: 'Où est... ?', translation: 'where is...?' },
    { word: 'Au revoir', translation: 'goodbye' },
    { word: 'Oui', translation: 'yes' },
    { word: 'Non', translation: 'no' },
    { word: 'De l’eau', translation: 'water' },
    { word: 'Les toilettes', translation: 'bathroom' },
  ],
  Spanish: [
    { word: 'Hola', translation: 'hello' },
    { word: 'Gracias', translation: 'thank you' },
    { word: 'Por favor', translation: 'please' },
    { word: 'Perdón', translation: 'excuse me / sorry' },
    { word: 'Salud', translation: 'cheers' },
    { word: 'Buenos días', translation: 'good morning' },
    { word: '¿Cuánto cuesta?', translation: 'how much does that cost?' },
    { word: 'Delicioso', translation: 'delicious' },
    { word: '¿Dónde está...?', translation: 'where is...?' },
    { word: 'Adiós', translation: 'goodbye' },
    { word: 'Sí', translation: 'yes' },
    { word: 'No', translation: 'no' },
    { word: 'Agua', translation: 'water' },
    { word: 'El baño', translation: 'bathroom' },
  ],
  Italian: [
    { word: 'Buongiorno', translation: 'good morning / hello' },
    { word: 'Grazie', translation: 'thank you' },
    { word: 'Per favore', translation: 'please' },
    { word: 'Scusi', translation: 'excuse me / sorry' },
    { word: 'Salute', translation: 'cheers' },
    { word: 'Buonasera', translation: 'good evening' },
    { word: 'Quanto costa?', translation: 'how much does that cost?' },
    { word: 'Buonissimo', translation: 'delicious' },
    { word: 'Dov’è...?', translation: 'where is...?' },
    { word: 'Arrivederci', translation: 'goodbye' },
    { word: 'Sì', translation: 'yes' },
    { word: 'No', translation: 'no' },
    { word: 'Acqua', translation: 'water' },
    { word: 'Il bagno', translation: 'bathroom' },
  ],
  Portuguese: [
    { word: 'Olá', translation: 'hello' },
    { word: 'Obrigado / Obrigada', translation: 'thank you (m / f)' },
    { word: 'Por favor', translation: 'please' },
    { word: 'Com licença', translation: 'excuse me' },
    { word: 'Saúde', translation: 'cheers' },
    { word: 'Bom dia', translation: 'good morning' },
    { word: 'Quanto custa?', translation: 'how much does that cost?' },
    { word: 'Delicioso', translation: 'delicious' },
    { word: 'Onde fica...?', translation: 'where is...?' },
    { word: 'Tchau', translation: 'goodbye' },
    { word: 'Sim', translation: 'yes' },
    { word: 'Não', translation: 'no' },
    { word: 'Água', translation: 'water' },
    { word: 'O banheiro', translation: 'bathroom' },
  ],
  Japanese: [
    { word: 'Konnichiwa', translation: 'hello / good afternoon' },
    { word: 'Arigatō', translation: 'thank you' },
    { word: 'Onegaishimasu', translation: 'please' },
    { word: 'Sumimasen', translation: 'excuse me / sorry' },
    { word: 'Kanpai', translation: 'cheers' },
    { word: 'Ohayō gozaimasu', translation: 'good morning' },
    { word: 'Ikura desu ka?', translation: 'how much is it?' },
    { word: 'Oishii', translation: 'delicious' },
    { word: '...wa doko desu ka?', translation: 'where is...?' },
    { word: 'Sayōnara', translation: 'goodbye' },
    { word: 'Hai', translation: 'yes' },
    { word: 'Iie', translation: 'no' },
    { word: 'Mizu', translation: 'water' },
    { word: 'Toire', translation: 'bathroom' },
  ],
  Dutch: [
    { word: 'Hallo', translation: 'hello' },
    { word: 'Dank je', translation: 'thank you' },
    { word: 'Alsjeblieft', translation: 'please / here you go' },
    { word: 'Pardon', translation: 'excuse me / sorry' },
    { word: 'Proost', translation: 'cheers' },
    { word: 'Goedemorgen', translation: 'good morning' },
    { word: 'Hoeveel kost dit?', translation: 'how much does this cost?' },
    { word: 'Lekker', translation: 'delicious / tasty' },
    { word: 'Waar is...?', translation: 'where is...?' },
    { word: 'Tot ziens', translation: 'goodbye' },
    { word: 'Ja', translation: 'yes' },
    { word: 'Nee', translation: 'no' },
    { word: 'Water', translation: 'water' },
    { word: 'Toilet', translation: 'bathroom' },
  ],
};

const COUNTRY_LANGUAGE: Record<string, TripLanguage> = {
  AT: 'German', DE: 'German', CH: 'German', LI: 'German',
  CZ: 'Czech',
  FR: 'French', MC: 'French',
  ES: 'Spanish', MX: 'Spanish', AR: 'Spanish', CO: 'Spanish', CL: 'Spanish', PE: 'Spanish',
  UY: 'Spanish', EC: 'Spanish', CR: 'Spanish', PA: 'Spanish', DO: 'Spanish', GT: 'Spanish',
  IT: 'Italian', SM: 'Italian', VA: 'Italian',
  PT: 'Portuguese', BR: 'Portuguese',
  JP: 'Japanese',
  NL: 'Dutch',
};

export function languageForCountry(countryCode: string): TripLanguage | null {
  return COUNTRY_LANGUAGE[countryCode.toUpperCase()] ?? null;
}

// Picks a stable word for a given trip date — stable meaning the same date
// always yields the same word (no re-randomizing on every render/reload),
// and picked by that date's position among other days in the same language
// so the phrasebook is worked through in order rather than jumping around,
// and two cities sharing a language don't reset back to word #1 partway
// through just because the city changed. Returns null when there's no
// phrasebook for the country the day is spent in.
export function getWordOfDay(
  trip: Pick<Trip, 'cities' | 'start_date' | 'end_date'>,
  date: string
): { word: string; translation: string; language: TripLanguage } | null {
  const language = languageForCountry(getCityForDate(trip.cities, date).country_code);
  if (!language) return null;
  const words = PHRASEBOOKS[language];

  const sameLanguageDates = generateTripDates(trip).filter(
    (d) => languageForCountry(getCityForDate(trip.cities, d).country_code) === language
  );
  const rawIndex = sameLanguageDates.indexOf(date);
  const index = rawIndex === -1 ? 0 : rawIndex % words.length;

  return { ...words[index], language };
}
