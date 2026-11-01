# Requirements and screen map

The user's explicit stack and MVP govern the implementation. The attached product PDF provides context; its suggestion to build an admin in Flutter is superseded by the requested Next.js admin. The supplied MyGate screenshots are visual references. The user subsequently explicitly requested working Homes, Buy & Sell, and Stores modules.

| Area | Implemented screens and flow |
| --- | --- |
| Resident | Phone login, society/flat selection, membership request/status, Social dashboard, visitor approval, pre-approval, history, inbox, profile |
| Guard | Login, gate dashboard, new visitor form/photo, waiting/approved queues, entry, exit and history |
| Community | Society summary, action grid, notices, neighbours, staff directory and community posts/comments |
| Homes | Rent/buy search, property cards/detail, owner-only post form, available date, bedrooms, draft/preview/publish, bookmarks and enquiries |
| Buy & Sell | Categories, search, listing cards/detail, price/free items, photos, drafts, saved items, enquiries/replies and closure |
| Stores | Service catalogue/categories, details, preferred-date request, request history and cancellation |
| Admin | Login, overview/trend, societies, blocks/floors/flats, resident approvals, visitor logs/CSV/timeline, audit history, catalogue moderation, notices/services, booking confirmation/completion and staff assignments |

The resident navigation follows **Social, Homes, Community, Buy & Sell, Stores**. Visitor search, notifications and profile remain in the top bar and desktop sidebar. The guard has a separate task-focused navigation. Both apps use a responsive phone layout and an expanded desktop preview.

```text
RESIDENT / SOCIAL            GUARD                     ADMIN
Society · search · inbox     Gate · on duty             Society selector
Community banner            New visitor                Units / visits / requests
Quick actions               Waiting approval           Resident approvals
Entry approval card         Approved → Record entry    Arrival trend / recent logs
Recent visits               Inside → Check out         Structure / content / staff
Community posts             Visitor history            CSV / audit trail

HOMES / BUY & SELL           STORES
Feature banner              Service banner
Search + category filters   Category filters
Two-column item cards       Service cards and detail
Detail / save / enquire     Choose date + requirements
New post / draft / preview  Requested → admin accepts → completes
Private enquiry replies    Resident request history / cancellation
```

Visitor state machine: `pending → approved → inside → exited` or `pending → denied`. The server rejects guard approval, resident entry/exit and cross-flat decisions. Every mutation is audited.

Payments, billing, third-party merchant checkout, emergency dispatch, amenity reservations, provider contracts and sponsored advertisements are outside the implemented scope. The UI does not report purchases, confirmed bookings or emergency responses that did not occur. Sample people, stock photos and listings are clearly development fixtures.
