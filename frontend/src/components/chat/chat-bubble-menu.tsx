"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu-item";

/*
 * The ⋮ beside a message: Edit and Delete, one click away instead of two links
 * living under every bubble.
 *
 * WHY IT MOVED OUT OF THE BUBBLE. Inline "Edit Delete" text sat in the
 * metadata row next to the clock, which made three unrelated things compete on
 * one line and put two irreversible-looking words under every sentence
 * somebody wrote. A menu is the same two actions, addressed the way the rest
 * of this app addresses row actions (`⋯` on a task, on a project, on a
 * member), and Delete can carry the `danger` tone there rather than being a
 * word in a row of words.
 *
 * VISIBLE ON HOVER AND ON FOCUS-WITHIN, never on touch-only hover: the parent
 * row owns that, because the trigger has to appear before the pointer reaches
 * it. Opening keeps it visible — a menu whose trigger fades out from under the
 * cursor is a menu that closes when you move toward it — which is what
 * `data-open` is doing on the wrapper.
 */

export function ChatBubbleMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu className="self-center opacity-0 transition-opacity duration-100 ease-standard group-hover:opacity-100 group-focus-within:opacity-100">
      <DropdownMenuTrigger
        aria-label="Message actions"
        className="flex size-7 items-center justify-center rounded-full text-text-subtle transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text"
      >
        {/* Three dots as text, not an icon component: at 14px the glyph is
            crisper than a 3-circle SVG and needs no viewBox tuning. */}
        <span aria-hidden="true" className="text-base leading-none">
          ⋮
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="danger" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
