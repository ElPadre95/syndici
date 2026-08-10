import { Hammer } from 'lucide-react';

interface PagePlaceholderProps {
  title: string;
  note: string;
  body: string;
}

/**
 * État vide provisoire pour les sections pas encore construites. La navigation
 * mène donc toujours à un écran réel (pas de lien mort) — l'écran affiche
 * honnêtement qu'il arrive dans un prochain incrément.
 */
export function PagePlaceholder({ title, note, body }: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-label">{title}</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-bg text-label-4">
          <Hammer className="size-6" aria-hidden />
        </span>
        <p className="text-base font-bold text-label">{note}</p>
        <p className="max-w-sm text-sm text-label-3">{body}</p>
      </div>
    </div>
  );
}
