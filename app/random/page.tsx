import Cryptogram from "@/components/Cryptogram";

// /random is intentionally a thin client-rendered route. The random pick
// (and any in-progress save) lives entirely in localStorage, so the server
// has nothing meaningful to render — Cryptogram's own mount effect handles
// the "pick if absent, resume if present" branch.
export default function RandomPage() {
  return (
    <main className="min-h-screen w-full px-4 py-8 sm:py-12">
      <Cryptogram randomMode />
    </main>
  );
}
