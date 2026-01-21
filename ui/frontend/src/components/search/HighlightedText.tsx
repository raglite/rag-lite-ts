import React from 'react';

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
}

export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }

  // Split query into words to highlight each word
  const words = query.trim().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Create a regex to match any of the words (case insensitive)
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) => (
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-primary-foreground rounded-sm px-0.5 font-medium border-b-2 border-primary/40">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      ))}
    </span>
  );
}
