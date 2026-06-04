---
name: Marketplace workflow patterns
description: Key decisions for the bid/order/chat lifecycle in КадастрПро.
---

## Bid acceptance flow (bids route)
When a bid is accepted via `PATCH /orders/:orderId/bids/:bidId`:
1. Set bid status → `accepted`
2. Set order status → `in_progress`
3. Reject all other pending bids on the same order (`ne(bidsTable.id, bidId)`)
4. Auto-create a `chat_rooms` row linked to `orderId` + `engineerId` if one doesn't already exist

**Why:** Auto-chat prevents the customer from needing a separate step to start communicating. The dedup check avoids duplicate rooms if the button is clicked twice.

## Unread message counts
- `messages.isRead` is `false` by default
- `GET /chats/:roomId/messages` marks all messages as read (except sender's own) on the way out
- `POST /chats/:roomId/read` is an explicit mark-read endpoint
- `GET /chats` counts `isRead=false AND senderId != currentUser` per room for `unreadCount`
- `chat_rooms.lastMessageAt` is updated on each new message for ordering

**Why:** Avoids a separate "reads" join table; simpler for a 1:1 chat. The GET-marks-read pattern means opening a room auto-clears the badge.

## Order lifecycle
Statuses: `draft` → `open` → `in_progress` → `completed` (or `cancelled` from draft/open)
- `POST /orders` accepts `asDraft: true` to create in draft status
- `PATCH /orders/:id { status: "open" }` publishes a draft
- `POST /orders/:id/complete` marks completed + optionally creates a review in one atomic step
- On review creation, engineer `rating` and `reviewCount` are recalculated from all their reviews

## OrderDetailPage route
`/orders/:orderId` — new page for full bid comparison + lifecycle actions.
Order owner sees: publish (draft), cancel (draft/open), complete (in_progress).
Accepted bid shows chat button. Review modal opens on complete.

## Frontend unread badge pattern
Both CustomerDashboard and EngineerDashboard poll chats and show a red badge on the Chats tab and on individual chat rows. ChatPage also polls every 5s.
