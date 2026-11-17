// Example landmarks for the "name" field placeholders, so a trip to Tokyo
// suggests "Senso-ji Temple" rather than a palace in Vienna. Covers major
// destinations; anywhere else falls back to a generic example that still
// names the city.
const LANDMARKS: Record<string, string> = {
  vienna: 'Schönbrunn Palace',
  salzburg: 'Hohensalzburg Fortress',
  prague: 'Charles Bridge',
  budapest: 'Fisherman’s Bastion',
  krakow: 'Wawel Castle',
  warsaw: 'Royal Castle',
  berlin: 'Brandenburg Gate',
  munich: 'Marienplatz',
  hamburg: 'Elbphilharmonie',
  paris: 'Louvre Museum',
  lyon: 'Basilica of Notre-Dame de Fourvière',
  nice: 'Promenade des Anglais',
  marseille: 'Notre-Dame de la Garde',
  london: 'Tower of London',
  edinburgh: 'Edinburgh Castle',
  dublin: 'Guinness Storehouse',
  amsterdam: 'Rijksmuseum',
  brussels: 'Grand-Place',
  copenhagen: 'Tivoli Gardens',
  stockholm: 'Vasa Museum',
  oslo: 'Viking Ship Museum',
  helsinki: 'Suomenlinna Fortress',
  reykjavik: 'Hallgrímskirkja',
  zurich: 'Old Town walking tour',
  geneva: 'Jet d’Eau',
  rome: 'Colosseum',
  florence: 'Uffizi Gallery',
  venice: 'St. Mark’s Basilica',
  milan: 'Duomo di Milano',
  naples: 'Pompeii day trip',
  barcelona: 'Sagrada Família',
  madrid: 'Prado Museum',
  seville: 'Real Alcázar',
  granada: 'Alhambra',
  lisbon: 'Belém Tower',
  porto: 'Livraria Lello',
  athens: 'Acropolis',
  santorini: 'Oia sunset',
  istanbul: 'Hagia Sophia',
  dubrovnik: 'City Walls',
  split: 'Diocletian’s Palace',
  valletta: 'St. John’s Co-Cathedral',
  'new york': 'Statue of Liberty',
  'new york city': 'Statue of Liberty',
  boston: 'Freedom Trail',
  philadelphia: 'Liberty Bell',
  washington: 'Lincoln Memorial',
  chicago: 'Millennium Park',
  miami: 'South Beach',
  orlando: 'Epcot',
  'new orleans': 'French Quarter walk',
  nashville: 'Ryman Auditorium',
  austin: 'Barton Springs Pool',
  'las vegas': 'Bellagio Fountains',
  'los angeles': 'Griffith Observatory',
  'san diego': 'Balboa Park',
  'san francisco': 'Golden Gate Bridge',
  seattle: 'Pike Place Market',
  honolulu: 'Diamond Head hike',
  toronto: 'CN Tower',
  montreal: 'Notre-Dame Basilica',
  vancouver: 'Stanley Park',
  'mexico city': 'Zócalo',
  cancun: 'Chichén Itzá day trip',
  'rio de janeiro': 'Christ the Redeemer',
  'buenos aires': 'La Boca neighborhood',
  lima: 'Miraflores boardwalk',
  cusco: 'Machu Picchu day trip',
  tokyo: 'Senso-ji Temple',
  kyoto: 'Fushimi Inari Shrine',
  osaka: 'Osaka Castle',
  seoul: 'Gyeongbokgung Palace',
  beijing: 'Forbidden City',
  shanghai: 'The Bund',
  'hong kong': 'Victoria Peak',
  singapore: 'Gardens by the Bay',
  bangkok: 'Grand Palace',
  'chiang mai': 'Doi Suthep',
  hanoi: 'Old Quarter',
  'ho chi minh city': 'War Remnants Museum',
  ubud: 'Sacred Monkey Forest',
  delhi: 'Red Fort',
  'new delhi': 'India Gate',
  mumbai: 'Gateway of India',
  agra: 'Taj Mahal',
  dubai: 'Burj Khalifa',
  'abu dhabi': 'Sheikh Zayed Grand Mosque',
  cairo: 'Pyramids of Giza',
  marrakech: 'Jemaa el-Fnaa',
  'cape town': 'Table Mountain',
  nairobi: 'Giraffe Centre',
  sydney: 'Sydney Opera House',
  melbourne: 'Federation Square',
  auckland: 'Sky Tower',
  queenstown: 'Skyline Gondola',
};

function normalize(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// "e.g. Colosseum" for Rome; "e.g. A museum or landmark in Ghent" for a city
// with no curated example.
export function attractionPlaceholder(city: string): string {
  const example = LANDMARKS[normalize(city)];
  if (example) return `e.g. ${example}`;
  return city.trim() ? `e.g. A museum or landmark in ${city.trim()}` : 'e.g. A museum or landmark';
}

export function hotelPlaceholder(city: string): string {
  return city.trim() ? `e.g. A hotel in ${city.trim()}` : 'e.g. Hotel name';
}
