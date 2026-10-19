/** Skill ability art: src/assets/skills/{hero}/{s1|s2|ult}.jpg. Missing files fall back to procedural emblems. */
const files = import.meta.glob("../assets/skills/*/*.jpg", { eager: true, import: "default" }) as Record<string, string>;

export const SKILL_ART: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/skills\/([^/]+)\/(s1|s2|ult)\.jpg$/);
  if (m) SKILL_ART[`${m[1]}-${m[2]}`] = url;
}
export const skillArtKey = (skillId: string) => `skill-${skillId}`;
