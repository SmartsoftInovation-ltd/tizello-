import { redirect } from "next/navigation";
import { PageTop } from "@/components/layout/page-top";
import { TrashPanel } from "@/components/trash/trash-panel";
import { TrashIcon } from "@/components/ui/icons";
import { getSession } from "@/lib/auth";
import { getTrash } from "@/lib/trash";

export const metadata = {
  title: "Trash",
  description: "Projects and tasks you have deleted — put them back, or destroy them for good.",
};

/**
 * `/trash` — the sidebar's Trash row.
 *
 * NO `?project=` PICKER and no workspace in the path: the trash spans every
 * workspace the caller belongs to, which is the point of it. Someone looking
 * for what they deleted does not remember which project it was in — that is
 * usually why they are here.
 */
export default async function TrashPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in?next=/trash");

  const trash = await getTrash();

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <header>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
            <TrashIcon className="size-5 shrink-0 text-text-muted" />
            Trash
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Deleted projects and tasks from every workspace you are in. Restoring puts a thing back exactly as it was.
          </p>
        </header>
      </PageTop>

      <TrashPanel trash={trash} />
    </main>
  );
}
