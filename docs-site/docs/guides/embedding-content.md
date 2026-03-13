---
sidebar_position: 1
title: "How to Add Embeds"
---

# How to Add Embeds

This documentation site supports embedded content like videos, slides, and interactive diagrams using the `Embed` component.

## Usage

Import the `Embed` component at the top of any `.mdx` file and use it inline:

```mdx
import { Embed } from '@site/src/components/Embed'

## Demo Video

<Embed src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Demo video" height={480} />
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `src` | `string` | Yes | — | The embed URL (iframe src) |
| `title` | `string` | Yes | — | Accessible title for the iframe |
| `height` | `number` | No | `400` | Height in pixels |

## Supported Embed Sources

The `Embed` component works with any URL that supports iframe embedding:

| Source | URL Format |
|--------|-----------|
| YouTube | `https://www.youtube-nocookie.com/embed/VIDEO_ID` |
| Vimeo | `https://player.vimeo.com/video/VIDEO_ID` |
| Loom | `https://www.loom.com/embed/VIDEO_ID` |
| Figma | Use the embed URL from Figma's share dialog |
| Google Slides | Use the "Publish to web" embed URL |
| Miro | Use the embed URL from Miro's share dialog |

## Example

```mdx
import { Embed } from '@site/src/components/Embed'

# Sprint Planning Workshop

Watch the recorded workshop session:

<Embed
  src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  title="Sprint Planning Workshop Recording"
  height={480}
/>
```

## Security

The `Embed` component uses a sandboxed iframe with restricted permissions (`allow-scripts allow-same-origin allow-presentation`). This prevents embedded content from accessing cookies, storage, or navigating the parent page.
