---
name: Rosreestr verification service
description: Architecture of the Rosreestr adapter, gate conditions, and test attestat numbers for the MockRosreestrProvider
---

# Rosreestr Verification Service

## Architecture
- Interface `RosreestrProvider` + `MockRosreestrProvider` in `artifacts/api-server/src/services/rosreestr.ts`
- Singleton `rosreestrProvider` exported and injected into routes (no DI framework)
- To swap to a real API: replace `MockRosreestrProvider` with a concrete HTTP adapter, no business logic changes needed

## 3 gate conditions (all must pass)
1. Record found in registry (not null)
2. `record.status === "active"` (not "suspended" or "revoked")
3. `record.sroStatus === "active"` (active SRO membership)

## Test attestat numbers (MockProvider)
- `77-13-2023001` — PASS (active, active SRO, 143 works)
- `78-05-2022015` — PASS (active, active SRO, 87 works)
- `50-11-2021044` — PASS (active, active SRO, 212 works)
- `23-08-2020099` — FAIL: status=suspended
- `66-02-2019007` — FAIL: sroStatus=inactive
- `54-09-2022031` — FAIL: status=revoked

## Rating formula
`5.0 - (rejectionsCount/worksCount)*10 - suspensionsCount*0.1 + work_bonus`
- work_bonus: +0.2 for ≥100 works, +0.1 for ≥50 works
- Clamped to [2.5, 5.0], rounded to 1 decimal

**Why:** Rejection rate directly signals quality; suspension history is a secondary penalty; volume bonus rewards track record.

## DB tables
- `engineers` table: 8 new nullable columns (`attestatNumber`, `rosreestrStatus`, `sroName`, `rosreestrCheckedAt`, `rosreestrWorksCount`, `rosreestrRejectionsCount`, `rosreestrSuspensionsCount`, `rosreestrRejectionRate`)
- `verification_logs` table: every check recorded with engineerId, attestatNumber, result (pass/fail), failureReason, rawSnapshot (JSON string of provider response)

## Admin
- `GET /api/admin/verification-logs` — paginated, enriched with engineerName/engineerEmail via join
- `POST /api/admin/engineers/:id/reverify` — re-runs provider, updates engineer record, writes new log entry
