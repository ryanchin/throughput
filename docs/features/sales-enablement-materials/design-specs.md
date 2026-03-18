# Sales Enablement Materials -- Design Specification

**Status:** Draft
**Zone:** sales
**Last Updated:** 2026-03-18

---

## 1. Sales Landing Page (`/sales`)

The existing `/sales` page currently renders a hero heading and a grid of `CourseCard` components. The new design adds a **Materials** section alongside courses using shadcn `Tabs`.

### Layout

```
[Hero: "Sales Enablement" gradient heading + subtitle]
[Tabs: Courses | Materials]
[Tab content area]
```

**Component:** shadcn `Tabs` with `TabsList`, `TabsTrigger`, `TabsContent`.

```tsx
<Tabs defaultValue="courses" className="mt-8">
  <TabsList className="bg-muted border border-border">
    <TabsTrigger value="courses">Courses</TabsTrigger>
    <TabsTrigger value="materials">Materials</TabsTrigger>
  </TabsList>
  <TabsContent value="courses">
    {/* Existing CourseCard grid -- unchanged */}
  </TabsContent>
  <TabsContent value="materials">
    {/* MaterialsLibrary component */}
  </TabsContent>
</Tabs>
```

The hero section (`h1` + subtitle) remains above the tabs unchanged. Tab triggers use the existing muted/border tokens. Active tab trigger gets `text-accent` styling via shadcn defaults.

URL state: persist the active tab in a query param (`?tab=materials`) using `useSearchParams` so direct links and back-navigation work. Default to `courses` when no param is present.

---

## 2. Materials Library (Materials tab content)

### Toolbar

A horizontal toolbar sits above the grid with three elements: search, type filter, and view toggle.

```
[Search input (w/ icon)]  [Type dropdown]  [Category dropdown]  [Grid|List toggle]
```

**Components:**
- **Search:** shadcn `Input` with a leading search icon inside an `InputGroup`. Debounce 300ms. Placeholder: "Search materials..."
- **Type filter:** shadcn `DropdownMenu` triggered by a `Button` variant="outline". Label: "Type". Menu items: All, Battle Card, One-Pager, Case Study, Slide Deck, Email Template, Proposal Template, ROI Tool, Video. Single-select; active item shows a check icon.
- **Category filter:** Same `DropdownMenu` pattern. Categories are admin-defined, fetched from the database. Label: "Category". Includes "All Categories" as the default.
- **View toggle:** Two icon `Button` components (grid icon, list icon) in a `bg-muted rounded-lg p-0.5` wrapper. Active button gets `bg-raised` to indicate selection.

```tsx
<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
  <Input placeholder="Search materials..." className="w-full sm:w-72 bg-muted border-border" />
  <div className="flex items-center gap-2">
    <TypeDropdown />
    <CategoryDropdown />
    <ViewToggle />
  </div>
</div>
```

On mobile (below `sm`), the search input takes full width on its own row. Filters and toggle wrap to a second row.

### Material Card (Grid View)

Cards follow the same visual language as `CourseCard` but without cover images or progress bars.

```
+------------------------------------------+
| [Type Badge]                    [Share]   |
|                                           |
| Material Title (line-clamp-1)             |
| Description snippet (line-clamp-2)        |
|                                           |
| [Category tag]         Updated Mar 2026   |
+------------------------------------------+
```

**Structure:**

```tsx
<div className="bg-surface border border-border rounded-xl shadow-card p-5
  transition-all hover:border-accent/30 hover:shadow-accent-glow cursor-pointer">
```

- **Type badge:** Top-left. Uses `Badge` with `variant="outline"` plus type-specific colors:
  - Battle Card: `text-destructive border-destructive/30`
  - Case Study: `text-success border-success/30`
  - Slide Deck: `text-accent border-accent/30`
  - Email Template: `text-secondary border-secondary/30`
  - Default/other: `text-foreground-muted border-border`
- **Share button:** Top-right. Ghost icon button (share/external-link icon). Opens share modal on click. `e.stopPropagation()` to prevent card navigation.
- **Title:** `text-lg font-semibold text-foreground line-clamp-1`
- **Description:** `text-sm text-foreground-muted line-clamp-2 mt-1`
- **Bottom row:** Flex between category tag and updated date.
  - Category: `text-xs text-foreground-muted bg-muted rounded-full px-2 py-0.5`
  - Date: `text-xs text-foreground-muted` using relative format ("2d ago", "Mar 2026")

**Grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` -- matches the existing course grid.

### Material Row (List View)

Single row per material. Better for scanning when the library grows large.

```
[Type Badge]  Title                  Category    Updated      [Share] [Open]
```

Rendered as a `div` with `flex items-center gap-4 p-4 bg-surface border border-border rounded-lg hover:border-accent/30`. Each row is a link to the detail page. The share and open buttons are right-aligned with `ml-auto`.

---

## 3. Material Detail Page (`/sales/materials/[slug]`)

### Layout

```
[Breadcrumb: Sales > Materials > Material Title]
[Header: Title + Type Badge + Share Button + Download Button]
[Content area OR File preview]
```

**Components:**
- **Breadcrumb:** shadcn `Breadcrumb` component. Already available in the UI library.
- **Header:** Full-width section with title as `text-3xl font-bold text-foreground`, type badge beside it, and action buttons right-aligned.
- **Action buttons:**
  - Share: `Button variant="outline"` with share icon. Opens share dialog.
  - Download (if file-based): `Button` primary style (`bg-accent text-background`). Direct download link.
- **Content area:** For rich-text materials, render with `EditorContent` in `editable: false` mode (same pattern as lesson content). Wrapped in `prose` styling container with `max-w-3xl mx-auto`.
- **File preview:** For PDFs, show an embedded viewer (`<iframe>` or `<object>`). For slide decks and other non-previewable files, show a file info card (filename, size, type icon) with a prominent download button.

```tsx
<div className="max-w-4xl mx-auto">
  <Breadcrumb className="mb-6" />
  <div className="flex items-start justify-between mb-8">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <Badge variant="outline">{type}</Badge>
      </div>
      <p className="text-foreground-muted mt-2">{description}</p>
    </div>
    <div className="flex items-center gap-2">
      <ShareButton />
      {fileUrl && <DownloadButton />}
    </div>
  </div>
  <div className="bg-surface border border-border rounded-xl p-8">
    {/* Rich text content or file preview */}
  </div>
</div>
```

---

## 4. Share Flow

Triggered from the share icon on cards or the share button on the detail page. Uses shadcn `Dialog`.

### Share Dialog

```
+------------------------------------------+
| Share Material                     [X]    |
|                                           |
| Public link                               |
| +--------------------------------------+  |
| | https://throughput.../s/abc123  [Copy]|  |
| +--------------------------------------+  |
|                                           |
| Or send via email                         |
| [Email input]              [Send]         |
|                                           |
| Note: Link expires in 30 days            |
+------------------------------------------+
```

- **Copy link:** `Input` (read-only) with a copy `Button` inside an `InputGroup`. On click, copy to clipboard and swap button text to "Copied" with a check icon for 2 seconds.
- **Email send:** `Input` for email address + `Button` labeled "Send". Dispatches an API call to send a branded email with the public link. Show a `toast` on success.
- **Footer note:** `text-xs text-foreground-muted` explaining link behavior.
- If public sharing is disabled by admin for this material, the dialog shows a disabled state: "Public sharing is not enabled for this material. Contact your admin."

---

## 5. Admin CMS (`/admin/materials`)

### Materials List

Standard admin table view matching existing admin patterns.

```
[Header: "Materials" + "New Material" button]
[Table: Title | Type | Category | Status | Updated | Actions]
```

**Components:** Use a simple `div`-based table (or shadcn `Table` if added) with rows styled as `bg-surface border-b border-border`. Action column: `DropdownMenu` with Edit, Duplicate, Toggle Public Link, Delete.

Status column shows `Badge` -- `DRAFT` in `text-warning bg-warning-muted` or `PUBLISHED` in `text-success bg-success-muted`.

### Material Editor (`/admin/materials/[id]/edit`)

Form layout in a single column, max-width container.

```
[Back link]
[Title input]
[Type select]          [Category select]
[Description textarea]
[Content: Block editor OR File upload area]
[-- Settings section --]
  [x] Enable public sharing
  [Status toggle: Draft / Published]
[Save button]
```

**Components:**
- **Title:** shadcn `Input`, full width.
- **Type / Category:** Two shadcn `Select` components side by side in a `grid grid-cols-2 gap-4`.
- **Description:** shadcn `Textarea`, 3 rows.
- **Content:** Conditional. A toggle or radio group ("Rich text" | "File upload") determines which editor appears.
  - Rich text: Existing Tiptap block editor component.
  - File upload: Drag-and-drop zone (`border-2 border-dashed border-border rounded-xl p-12 text-center`). Accepts PDF, PPTX, DOCX, XLSX. Shows file name + size after upload with a remove button.
- **Public sharing toggle:** shadcn `Switch` with label. When enabled, a read-only input shows the generated public URL.
- **Status:** Two-button toggle (Draft / Published) using `Button` variant toggling.
- **Save:** Primary `Button` at the bottom right. `bg-accent text-background`.

---

## 6. Empty States

### No materials exist (fresh state)
Centered in the materials tab content area. Matches the existing empty state pattern from `CourseCard` grid.

```tsx
<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-20">
  <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
    <FileIcon className="text-foreground-muted" />
  </div>
  <h2 className="text-xl font-semibold text-foreground mb-2">No materials yet</h2>
  <p className="text-sm text-foreground-muted">
    Sales materials will appear here once your admin adds them.
  </p>
</div>
```

### No search/filter results
Same container but with different copy: "No materials match your search." Include a "Clear filters" text button (`text-accent hover:underline`) to reset all filters.

### Admin empty state
Same pattern but with a CTA button: "Create your first material" as a primary `Button` linking to the editor.

---

## 7. Responsive Behavior

| Breakpoint | Grid | Toolbar | Detail Page |
|------------|------|---------|-------------|
| `< sm` (mobile) | 1 column | Search full-width, filters wrap below | Single column, buttons stack below title |
| `sm-md` (tablet) | 2 columns | All inline | Same as desktop |
| `lg+` (desktop) | 3 columns | All inline | Same as tablet |

- Tab triggers remain horizontally scrollable on mobile (shadcn default).
- List view rows remain single-row on tablet+ but stack title above metadata on mobile.
- Share dialog uses `Dialog` on desktop, `Sheet` (bottom drawer via `side="bottom"`) on mobile for better thumb reach. Detect with a `useMediaQuery` hook or render both with CSS visibility.
- Admin material editor is single-column at all breakpoints (max-width `max-w-2xl mx-auto`).

---

## Component Inventory (shadcn/ui)

Already available: `Button`, `Input`, `InputGroup`, `Dialog`, `DropdownMenu`, `Badge` (custom), `Breadcrumb`, `Sheet`, `Tabs` (needs install), `Tooltip`, `Label`, `Textarea`, `Separator`.

**Need to install:** `Tabs`, `Select`, `Switch`, `Table` (optional -- can use div-based rows).

```bash
npx shadcn@latest add tabs select switch
```
