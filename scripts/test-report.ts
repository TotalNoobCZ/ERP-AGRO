// Testy čistých výpočtů reportu (packages/core/src/report.ts).
// Spuštění: node --experimental-strip-types scripts/test-report.ts
import { strict as assert } from "node:assert";
import {
  mesicniOkno,
  radaMesicu,
  pracovniDny,
  pokrytePracovniDny,
  vytizeniOsoby,
  uspesnostPoptavek,
  vObdobi,
  dniMezi,
} from "../packages/core/src/report.ts";

let ok = 0;
function test(nazev: string, fn: () => void) {
  fn();
  ok++;
  console.log(`✓ ${nazev}`);
}

test("mesicniOkno: běžný měsíc", () => {
  assert.deepEqual(mesicniOkno("2026-08", "2026-08-06"), { od: "2026-08-01", do: "2026-08-31" });
});

test("mesicniOkno: únor přestupného roku", () => {
  assert.deepEqual(mesicniOkno("2028-02", "2026-08-06"), { od: "2028-02-01", do: "2028-02-29" });
});

test("mesicniOkno: neplatný ref → měsíc z dneška", () => {
  assert.deepEqual(mesicniOkno(undefined, "2026-08-06"), { od: "2026-08-01", do: "2026-08-31" });
  assert.deepEqual(mesicniOkno("blbost", "2026-02-10"), { od: "2026-02-01", do: "2026-02-28" });
});

test("radaMesicu: 6 měsíců přes přelom roku", () => {
  assert.deepEqual(radaMesicu("2026-02", 6), ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("pracovniDny: srpen 2026 má 21 pracovních dní", () => {
  assert.equal(pracovniDny("2026-08-01", "2026-08-31"), 21);
});

test("pracovniDny: víkend → 0, jeden pátek → 1, prázdný rozsah → 0", () => {
  assert.equal(pracovniDny("2026-08-01", "2026-08-02"), 0); // so+ne
  assert.equal(pracovniDny("2026-08-07", "2026-08-07"), 1); // pá
  assert.equal(pracovniDny("2026-08-10", "2026-08-09"), 0);
});

const srpen = { od: "2026-08-01", do: "2026-08-31" };

test("pokrytePracovniDny: překryv se počítá jednou", () => {
  // po 3.8.–pá 7.8. (5 dní) + st 5.8.–út 11.8. (5 dní, z toho 3 nové: 10., 11. + víkend ne)
  const dny = pokrytePracovniDny(
    [
      { od: "2026-08-03", do: "2026-08-07" },
      { od: "2026-08-05", do: "2026-08-11" },
    ],
    srpen,
  );
  assert.equal(dny, 7); // 3.–7. (5) + 10.–11. (2)
});

test("pokrytePracovniDny: rozsah přesahující období se ořízne", () => {
  const dny = pokrytePracovniDny([{ od: "2026-07-20", do: "2026-08-04" }], srpen);
  assert.equal(dny, 2); // 3.–4. 8.
});

test("pokrytePracovniDny: rozsah mimo období → 0", () => {
  assert.equal(pokrytePracovniDny([{ od: "2026-09-01", do: "2026-09-05" }], srpen), 0);
});

test("pokrytePracovniDny: duplicitní stejné rozsahy jednou", () => {
  const r = { od: "2026-08-03", do: "2026-08-07" };
  assert.equal(pokrytePracovniDny([r, { ...r }], srpen), 5);
});

test("vytizeniOsoby: polovina fondu", () => {
  // 3.–14. 8. = 10 pracovních dní z 21
  const v = vytizeniOsoby([{ od: "2026-08-03", do: "2026-08-14" }], srpen);
  assert.equal(v.fond, 21);
  assert.equal(v.pokryto, 10);
  assert.ok(Math.abs(v.podil - 10 / 21) < 1e-9);
});

test("vytizeniOsoby: bez přiřazení → 0", () => {
  const v = vytizeniOsoby([], srpen);
  assert.deepEqual({ pokryto: v.pokryto, podil: v.podil }, { pokryto: 0, podil: 0 });
});

test("uspesnostPoptavek", () => {
  assert.equal(uspesnostPoptavek(3, 1), 0.75);
  assert.equal(uspesnostPoptavek(0, 5), 0);
  assert.equal(uspesnostPoptavek(0, 0), null);
});

test("vObdobi: kraje včetně, timestamp se ořízne na den", () => {
  assert.equal(vObdobi("2026-08-01", srpen), true);
  assert.equal(vObdobi("2026-08-31T23:59:00Z", srpen), true);
  assert.equal(vObdobi("2026-07-31", srpen), false);
});

test("dniMezi", () => {
  assert.equal(dniMezi("2026-08-01", "2026-08-06"), 5);
  assert.equal(dniMezi("2026-08-06", "2026-08-01"), -5);
  assert.equal(dniMezi("2026-08-06T10:00:00Z", "2026-08-06"), 0);
});

console.log(`\n${ok} testů prošlo.`);
