export const categories = [
  { key: 'history', emoji: '🏛️' },
  { key: 'science', emoji: '🔬' },
  { key: 'geography', emoji: '🌍' },
  { key: 'arts', emoji: '🎨' },
  { key: 'philosophy', emoji: '💭' },
  { key: 'nature', emoji: '🌿' },
  { key: 'mythology', emoji: '⚡' },
  { key: 'technology', emoji: '💻' },
  { key: 'religions', emoji: '🕊️' },
  { key: 'freelearn', emoji: '🎯' },
];

export const subcategoryKeys = {
  history: ['antiquity', 'middleAges', 'revolutions', 'worldWars', 'modernHistory', 'civilizations', 'greatFigures'],
  science: ['physics', 'chemistry', 'biology', 'astronomy', 'mathematics', 'medicine', 'discoveries'],
  geography: ['capitals', 'riversMountains', 'countriesBorders', 'worldCultures', 'oceansSeas', 'famousCities'],
  arts: ['painting', 'classicalMusic', 'cinema', 'literature', 'architecture', 'sculpture', 'modernMusic'],
  philosophy: ['greekPhilosophy', 'modernPhilosophy', 'ethics', 'metaphysics', 'easternPhilosophy', 'greatThinkers'],
  nature: ['wildAnimals', 'oceansMarineLife', 'plantsTrees', 'ecosystems', 'naturalPhenomena', 'environment', 'insects'],
  mythology: ['greekMythology', 'romanMythology', 'norseMythology', 'egyptianMythology', 'celticMythology', 'heroesLegends'],
  technology: ['historicalInventions', 'computing', 'artificialIntelligence', 'internetWeb', 'spaceAerospace', 'energy'],
  religions: ['islam', 'christianity', 'judaism'],
};

export const SPECIAL_CATEGORIES = { religions: true };

// Freelearn has its own dialog flow (no subcategories)
export const FREELEARN_CATEGORY = 'freelearn';

export const religionEmojis = {
  islam: '☪️',
  christianity: '✝️',
  judaism: '✡️',
};
