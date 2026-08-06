// Sdílený indikátor načítání: ztmavená překryvná vrstva přes celou obrazovku
// s kolečkem a textem uprostřed. Jednotný styl pro loading.tsx všech modulů
// i klientské přechody (např. přepínání období v Reportu).
export function Nacitani() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-6 py-4 text-text-muted shadow-lg">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-link" />
        Načítám…
      </div>
    </div>
  );
}
