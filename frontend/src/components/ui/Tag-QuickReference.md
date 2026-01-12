# Tag Component Quick Reference

## Import

```tsx
import { Tag } from "@/components/ui/Tag";
```

## Basic Usage

```tsx
<Tag>Default Tag</Tag>
```

## Variants Cheat Sheet

| Variant    | Use Case              | Example                                  |
| ---------- | --------------------- | ---------------------------------------- |
| `default`  | General tags, filters | `<Tag>Organic</Tag>`                     |
| `category` | Categories            | `<Tag variant="category">Dairy</Tag>`    |
| `new`      | NEW product label     | `<Tag variant="new">NEW</Tag>`           |
| `status`   | Neutral status        | `<Tag variant="status">Completed</Tag>`  |
| `discount` | Discounts/sales       | `<Tag variant="discount">30% OFF</Tag>`  |
| `info`     | Information/upcoming  | `<Tag variant="info">Upcoming</Tag>`     |
| `success`  | Success/ongoing       | `<Tag variant="success">Ongoing</Tag>`   |
| `warning`  | Warnings/alerts       | `<Tag variant="warning">Low Stock</Tag>` |
| `outline`  | Secondary emphasis    | `<Tag variant="outline">More</Tag>`      |

## Size Options

| Size      | Use Case             | Example                    |
| --------- | -------------------- | -------------------------- |
| `sm`      | Compact spaces       | `<Tag size="sm">Tag</Tag>` |
| `default` | Most cases (default) | `<Tag>Tag</Tag>`           |
| `lg`      | Prominent labels     | `<Tag size="lg">Tag</Tag>` |

## Common Patterns

### Product NEW Badge

```tsx
{
  product.isNew && (
    <Tag variant="new" className="absolute top-3 right-3">
      NEW
    </Tag>
  );
}
```

### Discount Badge

```tsx
<Tag variant="discount" size="sm">
  {discount}% OFF
</Tag>
```

### Event Status

```tsx
<Tag
  variant={
    status === "upcoming" ? "info" : status === "ongoing" ? "success" : "status"
  }
>
  {status}
</Tag>
```

### Category Label

```tsx
<Tag variant="category">{category}</Tag>
```

### Product Tags List

```tsx
{
  tags?.map((tag) => <Tag key={tag}>{tag}</Tag>);
}
```

## Replace Old Badge Usage

### Old Way ❌

```tsx
<Badge className="bg-accent text-accent-foreground font-bold">
  NEW
</Badge>
<Badge variant="destructive" className="text-xs font-semibold">
  30% OFF
</Badge>
```

### New Way ✅

```tsx
<Tag variant="new">NEW</Tag>
<Tag variant="discount" size="sm">30% OFF</Tag>
```

## Pro Tips

1. **Positioning**: Use className for absolute/relative positioning

   ```tsx
   <Tag className="absolute top-4 right-4">Tag</Tag>
   ```

2. **Spacing**: Add margins with className

   ```tsx
   <Tag className="mb-4">Tag</Tag>
   ```

3. **Width**: Control width when needed

   ```tsx
   <Tag className="w-fit">Tag</Tag>
   ```

4. **Combining**: Variant + Size + ClassName
   ```tsx
   <Tag variant="info" size="lg" className="mb-2">
     Tag
   </Tag>
   ```
