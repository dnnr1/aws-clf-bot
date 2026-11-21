export function formatServiceMentions(
  text: string,
  services: string[],
): string {
  const terms = new Set<string>();

  for (const service of services) {
    terms.add(service);

    const baseName = service.replace(/\s*\([^)]*\)/g, "");
    if (baseName !== service) {
      terms.add(baseName);
    }

    for (const [, acronym] of service.matchAll(/\(([^)]+)\)/g)) {
      if (acronym) {
        terms.add(acronym);
      }
    }

    const words = baseName.split(/\s+/);
    const lastWord = words.at(-1);
    const hasProductPrefix =
      words.length === 2 && /^(Amazon|AWS)$/i.test(words[0] ?? "");
    if (lastWord && (hasProductPrefix || /^[A-Z0-9.-]{2,8}$/.test(lastWord))) {
      terms.add(lastWord);
    }
  }

  const alternatives = [...terms]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegularExpression)
    .join("|");

  if (!alternatives) {
    return text;
  }

  const servicePattern = new RegExp(
    `(?<![\\w\`])(?:${alternatives})(?![\\w\`])`,
    "gi",
  );
  return text.replace(servicePattern, (match) => `\`${match}\``);
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
