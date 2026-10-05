// One-time legacy migration retired. Never create a privileged client here.
Deno.serve((_req: Request) => new Response(
  JSON.stringify({ error: "Legacy import endpoint retired" }),
  { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
));
