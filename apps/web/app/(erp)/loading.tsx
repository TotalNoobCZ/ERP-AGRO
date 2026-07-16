// Zobrazí se automaticky při přechodu / otevírání stránky, dokud se nenačtou
// data cíle. Fixní proužek u horního okraje = okamžitě viditelné načítání.
export default function Loading() {
  return (
    <div>
      <div className="fixed inset-x-0 top-0 z-[100] h-1 animate-pulse bg-link" />
      <div className="flex min-h-[30vh] items-center justify-center gap-3 text-text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-link" />
        Načítám…
      </div>
    </div>
  );
}
