# API Pagination: Offset vs Cursor-Based

> Reference: [A Developer's Guide to API Pagination](https://embeddedblog.wpengine.com/blog/api-pagination/)

## Overview

Pagination breaks large data sets into smaller chunks fetched incrementally. Even a 1-second delay in page load can reduce conversions by 7%.

---

## Offset-Based Pagination

### How It Works

```
GET /api/transactions?limit=20&offset=40
```

```sql
SELECT * FROM transactions
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;
```

### Pros

- Simple to implement (most ORMs support it)
- Intuitive math: `offset = (page_number - 1) * page_size`
- Users can jump to any page or bookmark specific pages
- Good for small/medium datasets (~10k records)

### Cons

- **Performance degrades at scale** - `OFFSET 10000` scans and discards 10k rows first
- **Shifting data problem** - new records cause duplicates or skipped items
- **Expensive total counts** - `COUNT(*)` on large tables is slow

### When to Use

- Admin dashboards with mostly static data
- Search results (users rarely go past first few pages)
- Small datasets under ~10,000 records
- When traditional page number navigation is required

---

## Cursor-Based Pagination

### How It Works

```
GET /api/transactions?limit=20&cursor=eyJpZCI6MTIzNDV9
```

```sql
SELECT * FROM transactions
WHERE (created_at, id) < ('2025-10-15 10:00:00', 12345)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

### Pros

- **Consistent O(1) performance** regardless of pagination depth
- **No shifting data problem** - cursor tracks specific records, not positions
- **No expensive `COUNT(*)`** queries needed
- Scales to millions of records

### Cons

- More complex implementation (encoding/decoding cursors)
- No random page access (can't jump to page 50)
- Cursors can become invalid if records are deleted
- Less intuitive for developers new to API design

### When to Use

- Large, fast-changing datasets
- Real-time feeds, activity streams, chat histories
- Mobile apps with infinite scroll
- When data consistency is critical (financial/payroll data)

---

## Comparison Table

| Aspect | Offset | Cursor |
|--------|--------|--------|
| Performance at scale | Degrades | Consistent |
| Random page access | Yes | No |
| Data consistency | Issues with shifting data | Stable |
| Implementation | Simple | Complex |
| Total count | Requires `COUNT(*)` | Not needed |
| Best for | Static, small datasets | Dynamic, large datasets |

---

## Best Practices

1. **Tune page size** - balance between request count and response time
2. **Plan for compatibility** - support both methods during migration
3. **Choose cursors wisely** - use indexed, immutable, unique fields (timestamp + ID or UUID)
4. **Handle errors gracefully** - return clear errors (`400`/`410`) for invalid cursors
5. **Document thoroughly** - explain cursor expiration and provide code examples

---

## Decision Guide

Ask yourself:

1. Can your pagination handle 10x growth without a rewrite?
2. Do you need strict data integrity (no missing/duplicate records)?
3. Is your dataset small and relatively static?

> **Rule of thumb:** Offset works fine for small, rarely changing datasets. When stakes and data volume are high, cursor is the better choice.
