"use client";

import { useState } from "react";
import { BADGE_BASE } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/**
 * Free-text tags, typed in place, with a row of one-click suggestions.
 *
 * STILL FREE TEXT, NOT A CATALOGUE. The old fixture offered six fixed labels
 * as the ONLY options, which meant the one tag a team actually needed was
 * never on the list. `SUGGESTIONS` is not that: it is a shortcut for common
 * ones, sitting below the input rather than replacing it — typing anything
 * else still works exactly as before. Enter or a comma commits a typed one,
 * Backspace on an empty input takes the last one back, and the API
 * de-duplicates case-insensitively, which this field mirrors so "Bug" and
 * "bug" never both appear on screen.
 *
 * Enter is `preventDefault`ed on purpose: this input sits inside the drawer's
 * `<form>`, and an unhandled Enter would SAVE the task on the keystroke meant
 * to add a tag.
 */
const MAX_TAGS = 20;
const TAG_MAX = 40;

/** Common labels, offered as a starting point — not the only ones on offer. */
const SUGGESTIONS = [
  "Bug",
  "Feature",
  "Enhancement",
  "Design",
  "Urgent",
  "Blocked",
  "Research",
  "Documentation",
] as const;

export function TaskTagsField({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState("");

  function add(tag: string) {
    if (!tag || tags.length >= MAX_TAGS) return;
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
  }

  function commit() {
    const tag = text.trim();
    setText("");
    add(tag);
  }

  const suggestions = SUGGESTIONS.filter(
    (suggestion) => !tags.some((existing) => existing.toLowerCase() === suggestion.toLowerCase()),
  );

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-sm px-2.5 py-1.5 transition-colors duration-100 ease-standard focus-within:bg-surface-hover hover:bg-surface-hover">
        {tags.map((tag) => (
          <span key={tag} className={cn(BADGE_BASE, "border border-border bg-surface-sunken text-text-muted")}>
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((entry) => entry !== tag))}
              className="text-text-subtle transition-colors duration-100 ease-standard hover:text-danger"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-2.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </span>
        ))}

        {tags.length < MAX_TAGS && (
          <input
            aria-label="Add a tag"
            value={text}
            maxLength={TAG_MAX}
            placeholder={tags.length === 0 ? "Add a tag — press Enter" : "Add another"}
            onChange={(event) => setText(event.target.value.replace(",", ""))}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commit();
              } else if (event.key === "Backspace" && !text && tags.length > 0) {
                onChange(tags.slice(0, -1));
              }
            }}
            className="min-w-24 flex-1 border-0 bg-transparent p-0 text-sm text-text placeholder:text-text-subtle focus-visible:outline-none"
          />
        )}
      </div>

      {/* One-click starting points — a suggestion already on the task drops
          off the row rather than showing a second, disabled copy of itself. */}
      {suggestions.length > 0 && tags.length < MAX_TAGS && (
        <div className="mt-1 flex flex-wrap gap-1 px-2.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-xs border border-dashed border-border px-1.5 py-0.5 text-2xs text-text-subtle transition-colors duration-100 ease-standard hover:border-solid hover:border-border-strong hover:bg-surface-hover hover:text-text"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
