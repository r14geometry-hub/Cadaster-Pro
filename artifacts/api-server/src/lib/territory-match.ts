export interface ServiceArea {
  region: string;
  districts: string[];
  localities: string[];
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Returns true if the order's location falls within at least one of the
 * engineer's configured service areas.
 *
 * Priority (per PRD):
 *   1. Locality match
 *   2. District match
 *   3. Region match
 *
 * If an order only specifies a region, it is shown to any engineer who has
 * ANY territory entry for that region (conservative: avoids hiding orders).
 */
export function orderMatchesTerritories(
  order: { region: string; district?: string | null; locality?: string | null },
  areas: ServiceArea[]
): boolean {
  if (areas.length === 0) return true;

  for (const area of areas) {
    if (norm(area.region) !== norm(order.region)) continue;

    const hasDistrictRestrictions = area.districts.length > 0;
    const hasLocalityRestrictions = area.localities.length > 0;

    // Engineer covers whole region — always match
    if (!hasDistrictRestrictions && !hasLocalityRestrictions) return true;

    if (order.locality) {
      // 1. Locality match (highest priority)
      if (hasLocalityRestrictions && area.localities.some(l => norm(l) === norm(order.locality!))) return true;
      // 2. Engineer has district coverage (no locality filter) + order district matches
      if (order.district && hasDistrictRestrictions && !hasLocalityRestrictions &&
          area.districts.some(d => norm(d) === norm(order.district!))) return true;
      // 3. Engineer covers the district and has no locality restriction
      if (order.district && hasDistrictRestrictions && !hasLocalityRestrictions &&
          area.districts.some(d => norm(d) === norm(order.district!))) return true;
    } else if (order.district) {
      // 2. District match (no locality in order)
      if (hasDistrictRestrictions && !hasLocalityRestrictions &&
          area.districts.some(d => norm(d) === norm(order.district!))) return true;
      // Whole-region coverage already handled
    } else {
      // Order has only region — show to anyone with coverage in this region
      return true;
    }
  }

  return false;
}
