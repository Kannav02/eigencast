/**
 * Preloaded into `remotion studio` by `eigencast preview`.
 * Remotion Studio binds to every interface (0.0.0.0 or ::) and has no host option, so anyone on the
 * same network could open the studio and its file and render endpoints. This rewrites those
 * wildcard binds to loopback, so the studio is only reachable from this machine.
 */
const net = require("node:net");
const http = require("node:http");

const WILDCARD = new Set(["0.0.0.0", "::", "", undefined]);
const LOOPBACK = "127.0.0.1";

function patch(proto) {
  const listen = proto.listen;
  if (!listen || listen.__eigencastLoopback) return;
  const wrapped = function (...args) {
    const [first] = args;
    if (first && typeof first === "object" && !Array.isArray(first) && "port" in first && WILDCARD.has(first.host)) {
      args[0] = { ...first, host: LOOPBACK };
    } else if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
      // listen(port[, host][, backlog][, cb])
      if (typeof args[1] !== "string" || WILDCARD.has(args[1])) {
        args.splice(1, typeof args[1] === "string" ? 1 : 0, LOOPBACK);
      }
    }
    return listen.apply(this, args);
  };
  wrapped.__eigencastLoopback = true;
  proto.listen = wrapped;
}

patch(net.Server.prototype);
if (http.Server.prototype.listen !== net.Server.prototype.listen) patch(http.Server.prototype);
