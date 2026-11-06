/** Bridge to the Python voice package (python/ in this package), run through uv. */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { PKG_ROOT, PKG_VERSION } from "../project";

export const VOICE_PROJECT = join(PKG_ROOT, "python");

/**
 * Run `eigencast-voice <args>` and return its final JSON line.
 * 1. uv builds (once) a venv for the voice package, kept outside node_modules.
 * 2. Progress lines stream to stderr as they arrive, so long recordings show life.
 * 3. The last stdout line is parsed as the JSON result.
 */
export function runVoice(args: string[], onLine: (line: string) => void): Promise<unknown> {
  // Pass only what uv, Python and the model download need, not every token in the user's shell.
  const keep = (k: string) =>
    ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TMPDIR", "TERM", "NO_COLOR", "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"].includes(k) ||
    /^(LC_|UV_|HF_|HUGGINGFACE_|XDG_|HTTPS?_PROXY$|NO_PROXY$|https?_proxy$|no_proxy$)/.test(k);
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => keep(k)));
  const env = { ...base, UV_PROJECT_ENVIRONMENT: join(homedir(), ".cache", "eigencast", `voice-${PKG_VERSION}`) };
  const child = spawn("uv", ["run", "--frozen", "--quiet", "--project", VOICE_PROJECT, "eigencast-voice", ...args], { env });
  let pending = "";
  let result: string | null = null;
  let err = "";
  const take = (line: string) => {
    if (line.startsWith("{")) result = line;
    else if (line.trim()) onLine(line);
  };
  child.stdout.on("data", (b: Buffer) => {
    const lines = (pending + b).split("\n");
    pending = lines.pop()!;
    lines.forEach(take);
  });
  child.stderr.on("data", (b: Buffer) => (err += b));
  return new Promise((resolve, reject) => {
    child.on("error", (e) => reject(new Error(`Could not start uv (${e.message}). Install it: https://docs.astral.sh/uv/`)));
    // "close" fires after stdout/stderr have drained; "exit" can fire before the last JSON line is read.
    child.on("close", (code) => {
      take(pending);
      if (code === 0 && result) resolve(JSON.parse(result));
      else reject(new Error(`voice step failed (exit ${code}):\n${err.trim().split("\n").slice(-15).join("\n")}`));
    });
  });
}
