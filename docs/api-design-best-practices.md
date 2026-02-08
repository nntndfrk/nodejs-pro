# RESTful Web API Design Best Practices

> Reference: [Microsoft Azure Architecture - Web API Design Best Practices](https://learn.microsoft.com/en-ca/azure/architecture/best-practices/api-design)

## Core Principles

- **Platform independence** - clients call API regardless of internal implementation
- **Loose coupling** - client and service evolve independently
- **Stateless requests** - each request is atomic, no transient state between requests

---

## Resource URI Design

### Naming Conventions

| Do | Don't |
|----|-------|
| `/orders` | `/create-order` |
| `/customers/5` | `/getCustomer?id=5` |
| `/customers/5/orders` | `/customers/1/orders/99/products` (too deep) |

### Best Practices

- Use **nouns** for resource names (HTTP verbs imply actions)
- Use **plural nouns** for collections (`/customers`, not `/customer`)
- Keep URIs simple: max depth `collection/item/collection`
- Avoid exposing database structure directly
- Don't create chatty APIs with many small resources

---

## HTTP Methods

| Resource | POST | GET | PUT | DELETE |
|----------|------|-----|-----|--------|
| `/customers` | Create new | Get all | Bulk update | Remove all |
| `/customers/1` | Error | Get one | Update one | Remove one |
| `/customers/1/orders` | Create order | Get orders | Bulk update | Remove all |

### Method Characteristics

| Method | Idempotent | Use Case |
|--------|------------|----------|
| GET | Yes | Retrieve resource |
| POST | No | Create resource, submit data |
| PUT | Yes | Full update (replace entire resource) |
| PATCH | No | Partial update (modify specific fields) |
| DELETE | Yes | Remove resource |

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created (POST success) |
| 204 | No Content (DELETE success) |
| 400 | Bad Request |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 409 | Conflict |
| 415 | Unsupported Media Type |

---

## Pagination & Filtering

```
GET /orders?limit=25&offset=50
GET /orders?minCost=100&status=shipped
GET /orders?sort=price&fields=id,name
```

- Set sensible defaults (`limit=25`, `offset=0`)
- Impose upper limits to prevent DoS attacks
- Support sorting and field selection
- Validate requested fields for security

---

## Async Operations

For long-running operations, return `202 Accepted` with status endpoint:

```
HTTP/1.1 202 Accepted
Location: /api/status/12345
```

When complete, return `303 See Other` with resource location:

```
HTTP/1.1 303 See Other
Location: /api/orders/12345
```

---

## HATEOAS

Include hypermedia links in responses for navigation:

```json
{
  "orderId": 3,
  "links": [
    {"rel": "customer", "href": "/customers/3", "action": "GET"},
    {"rel": "self", "href": "/orders/3", "action": "GET"}
  ]
}
```

---

## Versioning Strategies

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| URI | `/v2/customers/3` | Simple, clear | URI changes, complicates HATEOAS |
| Query String | `/customers/3?version=2` | Same URI | Caching issues |
| Header | `Custom-Header: api-version=2` | Clean URIs | Requires header logic |
| Media Type | `Accept: application/vnd.contoso.v1+json` | RESTful, HATEOAS-friendly | Complex |

---

## Multitenancy

### Approaches

| Method | Example |
|--------|---------|
| Subdomain | `tenant.api.contoso.com/orders` |
| Header | `X-Tenant-ID: tenant` |
| Path | `/tenants/tenant/orders` |
| JWT Claim | `tenant-id` in token |

---

## Distributed Tracing

Include correlation headers for observability:

```
GET /orders/3
Correlation-ID: aaaa0000-bb11-2222-33cc-444444dddddd
```

---

## Richardson Maturity Model

| Level | Description |
|-------|-------------|
| 0 | Single URI, all POST (SOAP-style) |
| 1 | Separate URIs per resource |
| 2 | Proper HTTP methods (most APIs) |
| 3 | HATEOAS (truly RESTful) |

---

## Quick Checklist

- [ ] Use nouns, not verbs in URIs
- [ ] Use plural nouns for collections
- [ ] Return appropriate HTTP status codes
- [ ] Implement pagination for collections
- [ ] Support filtering and sorting
- [ ] Version your API
- [ ] Use async patterns for long operations
- [ ] Include correlation IDs for tracing
- [ ] Document with OpenAPI/Swagger
