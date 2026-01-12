# Tag Component Documentation

## Overview

The `Tag` component is a reusable, consistent labeling component used across the entire application for categories, statuses, product labels, and informational badges.

## Location

`src/components/ui/Tag.tsx`

## Features

- **Multiple Variants**: 9 pre-defined visual styles for different use cases
- **Three Size Options**: Small, default, and large sizes
- **Type-Safe**: Full TypeScript support with proper typing
- **Accessible**: Built with semantic HTML and proper ARIA support
- **Theme-Aware**: Fully compatible with dark/light mode
- **Customizable**: Easy to override with className prop

## Variants

### 1. `default` (Default)

**Purpose**: General purpose tags for product tags, filters, or generic labels  
**Style**: Secondary background with backdrop blur  
**Usage**:

```tsx
<Tag>Organic</Tag>
<Tag>Handmade</Tag>
```

### 2. `category`

**Purpose**: Category labels for products, events, and blog posts  
**Style**: Primary color with border, subtle background  
**Usage**:

```tsx
<Tag variant="category">Dairy Products</Tag>
<Tag variant="category">Katha</Tag>
```

### 3. `new`

**Purpose**: "NEW" product indicator  
**Style**: Accent background with bold font  
**Usage**:

```tsx
<Tag variant="new">NEW</Tag>
```

### 4. `status`

**Purpose**: Event/order status indicators (neutral states)  
**Style**: Muted background with border  
**Usage**:

```tsx
<Tag variant="status">Completed</Tag>
<Tag variant="status">Pending</Tag>
```

### 5. `discount`

**Purpose**: Price discount labels  
**Style**: Destructive (red) background with bold font  
**Usage**:

```tsx
<Tag variant="discount">30% OFF</Tag>
<Tag variant="discount" size="sm">20% OFF</Tag>
```

### 6. `info`

**Purpose**: Informational tags (upcoming events, notices)  
**Style**: Blue background with border  
**Usage**:

```tsx
<Tag variant="info">Upcoming</Tag>
<Tag variant="info" size="sm">2024</Tag>
```

### 7. `success`

**Purpose**: Success states, ongoing events  
**Style**: Green background with border  
**Usage**:

```tsx
<Tag variant="success">Ongoing</Tag>
<Tag variant="success">Confirmed</Tag>
```

### 8. `warning`

**Purpose**: Warning states, limited availability  
**Style**: Yellow background with border  
**Usage**:

```tsx
<Tag variant="warning">Low Stock</Tag>
<Tag variant="warning">Limited Seats</Tag>
```

### 9. `outline`

**Purpose**: Secondary emphasis, outlined style  
**Style**: Border with transparent background  
**Usage**:

```tsx
<Tag variant="outline">View More</Tag>
```

## Sizes

### `sm` (Small)

- Font size: 10px
- Padding: 1.5px horizontal, 0.5px vertical
- **Use for**: Compact spaces, inline with text

### `default` (Default)

- Font size: 12px
- Padding: 2px horizontal, 0.5px vertical
- **Use for**: Most common cases

### `lg` (Large)

- Font size: 14px
- Padding: 3px horizontal, 1px vertical
- **Use for**: Prominent labels, headers

## Props Interface

```typescript
interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "category"
    | "new"
    | "status"
    | "discount"
    | "info"
    | "outline"
    | "success"
    | "warning";
  size?: "default" | "sm" | "lg";
  className?: string;
  children: React.ReactNode;
}
```

## Usage Examples

### Product Cards

```tsx
// NEW badge
{
  product.isNew && (
    <Tag variant="new" className="absolute top-3 right-3">
      NEW
    </Tag>
  );
}

// Product tags
{
  product.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>);
}

// Discount badge
{
  product.mrp > product.price && (
    <Tag variant="discount" size="sm">
      {calculateDiscount(product.mrp, product.price)}% OFF
    </Tag>
  );
}
```

### Event Cards

```tsx
// Event status
<Tag variant={
  status === "upcoming" ? "info" :
  status === "ongoing" ? "success" :
  "status"
}>
  {status}
</Tag>

// Event category
<Tag variant="category" size="sm">
  {category}
</Tag>
```

### Blog Posts

```tsx
// Blog category
<Tag variant="category" size="lg">
  {getCategoryName(post.category)}
</Tag>;

// Blog tags
{
  post.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>);
}
```

### Timeline/History

```tsx
// Year badge
<Tag variant="info" size="sm">
  {item.year}
</Tag>
```

## Current Implementation Locations

### Components Using Tag:

1. **ProductCard.tsx**

   - NEW badge (variant="new")
   - Product tags (variant="default")
   - Discount badge (variant="discount", size="sm")

2. **ProductDetailView.tsx**

   - NEW badge (variant="new", size="lg")
   - Product tags (variant="default")
   - Discount badge (variant="discount", size="sm")

3. **ProductQuickView.tsx**

   - NEW badge (variant="new")
   - Discount badge (variant="discount", size="sm")
   - Product tags (variant="default")

4. **EventCard.tsx**

   - Event status (variant="info"/"success"/"status")

5. **EventDetail.tsx**

   - Event status (variant="info"/"success"/"status")
   - Event category (variant="category", size="sm")

6. **BlogPost.tsx**

   - Blog category (variant="category", size="lg")
   - Blog tags (variant="default")

7. **About.tsx**
   - Timeline years (variant="info", size="sm")

## Migration from Badge Component

### Before (Badge):

```tsx
<Badge className="bg-accent text-accent-foreground font-bold">
  NEW
</Badge>
<Badge variant="destructive">30% OFF</Badge>
```

### After (Tag):

```tsx
<Tag variant="new">NEW</Tag>
<Tag variant="discount" size="sm">30% OFF</Tag>
```

## Best Practices

### ✅ DO:

- Use semantic variants that match the context
- Use consistent sizes across similar contexts
- Leverage the built-in variants before adding custom styles
- Use size prop for scaling instead of custom fontSize

### ❌ DON'T:

- Don't override background colors with className for variants
- Don't use multiple variants on the same tag
- Don't use for interactive elements (use Button instead)
- Don't use for lengthy text (keep labels concise)

## Styling Customization

While variants provide consistent styling, you can extend with className:

```tsx
// Add positioning
<Tag variant="new" className="absolute top-4 right-4">NEW</Tag>

// Add margins
<Tag variant="category" className="mb-4">Category</Tag>

// Add width constraints
<Tag variant="info" className="w-fit">2024</Tag>
```

## Accessibility

The Tag component uses semantic `<span>` elements and inherits accessible text contrast ratios from shadcn/ui's design system. All variants maintain WCAG AA contrast standards in both light and dark modes.

## Theme Support

All variants automatically adapt to light/dark mode using Tailwind's dark mode classes:

- `bg-blue-100 dark:bg-blue-900/30` (info variant)
- `bg-green-100 dark:bg-green-900/30` (success variant)
- `bg-yellow-100 dark:bg-yellow-900/30` (warning variant)

## Future Enhancements

Potential additions for future development:

- Removable tags (with close button)
- Interactive tags (clickable for filtering)
- Icon support (leading/trailing icons)
- Animation variants (pulse, bounce for notifications)
- Custom color variants via CSS variables
