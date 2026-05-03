import { notFound } from "next/navigation";
import Cryptogram from "@/components/Cryptogram";
import { quotes } from "@/lib/quotes";
import { isPuzzleReleased } from "@/lib/daily";

// Render per request so the date gate (today + one-day lookahead) reflects
// the server's actual "now" instead of the build time. Returns a real 404
// from `next start` for any number outside that window.
export const dynamic = "force-dynamic";

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const n = Number.parseInt(number, 10);
  if (!Number.isInteger(n) || n < 1 || n > quotes.length) notFound();
  if (!isPuzzleReleased(n, new Date(), 1)) notFound();
  return (
    <main className="min-h-screen w-full px-4 py-8 sm:py-12">
      <Cryptogram puzzleNumber={n} />
    </main>
  );
}
