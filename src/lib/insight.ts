export type InsightRow = {
  label: string;
  lifetimeKg: number;
};

function fractionPhrase(low: number, high: number): string | null {
  if (high <= 0) return null;
  const share = low / high;
  if (share >= 0.88) return null;
  if (share >= 0.7) return "about three-quarters";
  if (share >= 0.58) return "about two-thirds";
  if (share >= 0.45) return "about half";
  if (share >= 0.36) return "about 40%";
  if (share >= 0.28) return "about a third";
  if (share >= 0.2) return "about a quarter";
  if (share >= 0.14) return "about a sixth";
  if (share >= 0.08) return "about a tenth";
  return `about ${Math.max(1, Math.round(share * 100))}%`;
}

export function compareInsight(
  rows: InsightRow[],
  provinceName: string,
): string | null {
  const ranked = rows
    .filter((row) => Number.isFinite(row.lifetimeKg) && row.lifetimeKg > 0)
    .slice()
    .sort((a, b) => a.lifetimeKg - b.lifetimeKg);
  if (ranked.length < 2) return null;

  const lowest = ranked[0];
  const highest = ranked[ranked.length - 1];
  if (!lowest || !highest) return null;

  const fraction = fractionPhrase(lowest.lifetimeKg, highest.lifetimeKg);
  if (!fraction) {
    if (ranked.length === 2) {
      return `In ${provinceName}, the ${lowest.label} and the ${highest.label} have similar lifetime emissions.`;
    }
    return `In ${provinceName}, these cars have similar lifetime emissions.`;
  }

  const pair = `lifetime emissions for the ${lowest.label} are ${fraction} of those for the ${highest.label}`;
  if (ranked.length === 2) {
    return `In ${provinceName}, ${pair}.`;
  }
  return `In ${provinceName}, ${pair}, the highest of these cars.`;
}
