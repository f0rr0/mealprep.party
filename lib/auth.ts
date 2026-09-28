export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) {
    return false;
  }
  try {
    const source = new URL(origin);
    // Next may normalize req.url to localhost; Host retains the browser-facing host.
    return (
      ["http:", "https:"].includes(source.protocol) &&
      source.host === (req.headers.get("host") ?? new URL(req.url).host)
    );
  } catch {
    return false;
  }
}
