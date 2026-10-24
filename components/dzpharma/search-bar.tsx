"use client";

/**
 * SearchBar — prominent, debounced search input (mobile-first).
 * Matches against both `dci` and `nom_commercial` (handled server-side).
 */
import { useEffect, useRef } from "react";
import { Loader2, Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  /** Accessible description of what is searched. */
  ariaLabel?: string;
}

export function SearchBar({ value, onChange, loading, ariaLabel }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus with "/" (desktop convenience) — safe, keyboard-only shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="group relative flex h-14 items-center rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-colors focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100"
    >
      <label htmlFor="medication-search" className="sr-only">
        {ariaLabel ?? "Rechercher un médicament par DCI ou nom commercial"}
      </label>
      <Search
        className="ml-4 h-5 w-5 shrink-0 text-slate-400 transition-colors group-focus-within:text-sky-500"
        aria-hidden
      />
      <input
        ref={inputRef}
        id="medication-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="DCI ou nom commercial… ex. paracétamol"
        autoComplete="off"
        enterKeyHint="search"
        className="h-full w-full bg-transparent px-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {loading && (
        <Loader2
          className="mr-2 h-5 w-5 shrink-0 animate-spin text-sky-500"
          aria-hidden
        />
      )}
      {value && !loading && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Effacer la recherche"
          className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      )}
    </form>
  );
}
