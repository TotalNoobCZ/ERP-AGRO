// Sdílený indikátor načítání obsahu (spinner + text).
export function Nacitani() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-text-muted">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-link" />
      Načítám…
    </div>
  );
}
