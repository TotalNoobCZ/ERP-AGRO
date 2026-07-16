// Zobrazí se automaticky při přechodu mezi kartami/moduly, dokud se
// nenačtou data cílové stránky (Suspense boundary route groupy (erp)).
export default function Loading() {
  return (
    <div>
      {/* horní „běžící" proužek – okamžitá vizuální zpětná vazba */}
      <div className="mb-6 h-1 w-full overflow-hidden rounded bg-line">
        <div className="h-full w-1/3 animate-pulse rounded bg-link" />
      </div>
      <div className="flex min-h-[30vh] items-center justify-center gap-3 text-text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-link" />
        Načítám…
      </div>
    </div>
  );
}
