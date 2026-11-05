/** Tiny argument parser and output helpers shared by every command. */

export type Args = { positional: string[]; flags: Record<string, string | boolean | string[]> };

/** Parse `--flag`, `--key value`, `--key=value`; `--only a b c` collects until the next flag. */
export function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Args["flags"] = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split("=", 2);
    if (inline !== undefined) {
      flags[key] = inline;
      continue;
    }
    const values: string[] = [];
    while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) values.push(argv[++i]);
    flags[key] = values.length === 0 ? true : key === "only" ? values : values[0];
    if (key !== "only" && values.length > 1) positional.push(...values.slice(1));
  }
  return { positional, flags };
}

export const flagStr = (a: Args, k: string): string | undefined => (typeof a.flags[k] === "string" ? (a.flags[k] as string) : undefined);
export const flagNum = (a: Args, k: string): number | undefined => {
  const s = flagStr(a, k);
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`--${k} needs a number, got "${s}"`);
  return n;
};
export const flagList = (a: Args, k: string): string[] => {
  const v = a.flags[k];
  return Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
};

/** Progress goes to stderr so stdout stays clean for --json. */
export const log = (msg: string) => process.stderr.write(`${msg}\n`);
