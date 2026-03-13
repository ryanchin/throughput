import React from 'react';

interface EmbedProps {
  src: string;
  title: string;
  height?: number;
}

export function Embed({ src, title, height = 400 }: EmbedProps): React.JSX.Element {
  return (
    <iframe
      src={src}
      title={title}
      width="100%"
      height={height}
      style={{ border: 'none', borderRadius: '8px' }}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      loading="lazy"
    />
  );
}
