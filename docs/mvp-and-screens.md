# Requirements and screen map

Updated 10 November 2026. The user's written MVP/stack instructions take priority over the reference PDF. Homes, Buy & Sell and Stores are included as requested.

| React Native screen | Function |
| --- | --- |
| `Login` | Real Firebase phone verification; no fixed OTP |
| `Membership` | Society/flat selection, membership request/status, approved society selection |
| `Home` | Visitor approvals, entry updates, quick actions, home and community links |
| `Visitors` | Paginated history, search and status/type/date filters |
| `Visitor (ID)` | Authorized detail, approval/denial and visit timeline |
| `VisitorForm (resident)` | Pre-approved visitor for an approved home |
| `Pass (visitor ID)` | Generate, copy, share text/PNG, replace and revoke QR pass |
| `Homes` | Rent/buy properties, search, bookmarks, own listings/drafts |
| `Marketplace` | Categories, listings, saved items and enquiries |
| `Stores` | Real administrator-published services and dated requests |
| `Item (ID)` | Shared detail/actions by item kind |
| `Editor (kind)` | Shared property, listing and post editor |
| `Activity` | Requests, enquiries, replies and permitted cancellation |
| `Community` | Society statistics, directory, notices and posts |
| `Notices` | Announcements |
| `Notifications` | Inbox and read state |
| `Profile` | Actual account/memberships, notification permission, logout |

The five resident tabs follow the supplied beige/yellow reference. Missing listing photos use a neutral labelled placeholder. Live mode shows server records. The clearly labelled presentation mode includes sample notices/products and local interactive flows without credentials; see [demo instructions](demo.md).

The guard app has a fixed role and its own Android ID. It supports dashboard, history, `VisitorForm (guard)`, entry/exit, updates, profile and community directory. `Verify` scans or accepts a code, displays the visitor and requires explicit Record entry. Guards must be assigned by an administrator; they cannot self-approve access.

The web admin provides society creation, blocks/floors/units, membership review, visitor logs/detail/CSV, audit history, notices/services/moderation, service-request status and staff assignment. Only platform administrators appoint other administrators.

This build does not process maintenance bills, rent, marketplace payments or third-party checkout. Service bookings are requests confirmed by society management. Listings/directories are scoped to the selected society. Unsupported payment/advertising buttons are not presented as working features. Reference screenshots are design inputs, not application pages.
