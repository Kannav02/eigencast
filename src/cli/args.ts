/** Tiny argument parser and output helpers shared by every command. */
import { UserError } from "../project";

export type Args = { positional: string[]; flags: Record<string, string | boolean | string[]> };

/** Flags that never take a value, so `--force lineage` keeps `lineage` as a positional. */
const BOOLEAN_FLAGS = new Set(["json", "force", "listen", "no-install", "help"]);

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
    const eq = a.indexOf("=");
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (eq !== -1) {
      flags[key] = key === "only" ? a.slice(eq + 1).split(",").filter(Boolean) : a.slice(eq + 1);
      continue;
    }
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    const values: string[] = [];
    while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) values.push(argv[++i]);
    flags[key] = values.length === 0 ? true : key === "only" ? values : values[0];
    if (key !== "only" && values.length > 1) positional.push(...values.slice(1));
  }
  return { positional, flags };
}

/** A string flag's value; a flag given with no value is an error rather than silently ignored. */
export const flagStr = (a: Args, k: string): string | undefined => {
  const v = a.flags[k];
  if (v === undefined) return undefined;
  if (typeof v !== "string" || v === "") throw new UserError(`--${k} needs a value`);
  return v;
};
export const flagNum = (a: Args, k: string): number | undefined => {
  const s = flagStr(a, k);
  if (s === undefined) return undefined;
  const n = s.trim() === "" ? NaN : Number(s);
  if (!Number.isFinite(n)) throw new UserError(`--${k} needs a number, got "${s}"`);
  return n;
};
export const flagList = (a: Args, k: string): string[] => {
  const v = a.flags[k];
  return Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
};

/** Progress goes to stderr so stdout stays clean for --json. */
export const log = (msg: string) => process.stderr.write(`${msg}\n`);
