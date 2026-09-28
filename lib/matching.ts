// ponytail: conservative keyword suggestions; manual confirmation until pack sizes and consumption are tracked.
const groups: Record<string, string[]> = {
  atta: ["atta", "wheat flour", "आटा"],
  bread: ["bread", "toast"],
  chicken: ["chicken", "drumstick", "चिकन"],
  chickpeas: ["chickpea", "chana", "chole"],
  dal: ["dal", "lentil", "दाल"],
  eggs: ["egg", "अंड"],
  fruit: ["guava", "apple", "mango", "banana", "orange", "fruit"],
  milk: ["milk", "दूध"],
  paneer: ["paneer", "पनीर"],
  rajma: ["rajma", "kidney bean"],
  rice: ["rice", "basmati", "चावल"],
  soy: ["soya", "soy chunk"],
  yogurt: ["yogurt", "yoghurt", "curd", "dahi", "दही"],
};
function ingredientType(name: string) {
  const lower = name.toLowerCase();
  return (
    Object.entries(groups).find(([, words]) =>
      words.some((w) =>
        new RegExp(`(^|[^a-z])${w}([^a-z]|s\\b|$)`, "iu").test(lower)
      )
    )?.[0] ?? null
  );
}
export function possibleMatch(ingredient: string, purchase: string) {
  const a = ingredientType(ingredient);
  const b = ingredientType(purchase);
  return a !== null && a === b;
}
