// Upozornění pro odpovědnou osobu: u jejích odložených poptávek nastal čas
// připomenutí (remind_at <= dnes). Zobrazí se nahoře v modulu Poptávky.
import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { queryDueReminders } from "@/lib/poptavky-query";

export async function ReminderBanner() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const due = await queryDueReminders(supabase, profile.id);
  if (due.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <p className="font-semibold">
        ⏰ Nastal čas kontaktovat {due.length === 1 ? "odloženou poptávku" : `odložené poptávky (${due.length})`}
      </p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {due.map((d) => (
          <li key={d.id}>
            <Link href={`/poptavky/${d.id}`} className="font-medium underline">
              #{d.number} – {d.subject}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
