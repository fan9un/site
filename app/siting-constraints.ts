export type ConstraintKind =
  | "airport"
  | "port"
  | "industrial"
  | "waste"
  | "wastewater"
  | "freight";

export type ConstraintPoint = {
  lat: number;
  lng: number;
  kind: ConstraintKind;
};

const constraintLabels: Record<ConstraintKind, string> = {
  airport: "机场",
  port: "港口",
  industrial: "化工园",
  waste: "垃圾处理设施",
  wastewater: "污水处理设施",
  freight: "铁路货运站",
};

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const aLat = toRadians(a.lat);
  const bLat = toRadians(b.lat);
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function hardExclusionRadius(kind: ConstraintKind, factor: string) {
  const sensitive = ["medical", "education", "care", "green", "culture"].includes(factor);
  const communityFacing = ["culture", "retail", "dining", "safety"].includes(factor);
  if (factor === "transit") {
    return kind === "waste" ? 0.5 : kind === "wastewater" ? 0.35 : 0;
  }
  if (kind === "airport") {
    if (["education", "care"].includes(factor)) return 8;
    if (["medical", "culture", "green"].includes(factor)) return 6;
    return communityFacing ? 4 : 3;
  }
  if (kind === "port") {
    if (["education", "care"].includes(factor)) return 5.5;
    return sensitive ? 5 : communityFacing ? 2.5 : 1.5;
  }
  if (kind === "industrial") return sensitive ? 2.5 : communityFacing ? 1.2 : 0.8;
  if (kind === "waste") return sensitive ? 3 : 1.5;
  if (kind === "wastewater") return sensitive ? 2 : 1;
  return sensitive ? 1.5 : 0.8;
}

export function assessCandidateSuitability(
  center: { lat: number; lng: number },
  factor: string,
  constraints: ConstraintPoint[],
) {
  if (!constraints.length) {
    return {
      eligible: true,
      score: 72,
      verified: false,
      notes: ["未取得机场、港口等冲突源数据，需规划核验"],
    };
  }
  let penalty = 0;
  const audits = constraints
    .map((constraint) => {
      const distance = haversine(center, constraint);
      const hardRadius = hardExclusionRadius(constraint.kind, factor);
      const cautionRadius =
        hardRadius +
        (constraint.kind === "airport" ? 5 : constraint.kind === "port" ? 2.5 : 2);
      return { constraint, distance, hardRadius, cautionRadius };
    })
    .sort((a, b) => a.distance - b.distance);
  const blocked = audits.find(
    (audit) => audit.hardRadius > 0 && audit.distance <= audit.hardRadius + 0.15,
  );
  if (blocked) {
    return {
      eligible: false,
      score: 0,
      verified: true,
      notes: [
        `距${constraintLabels[blocked.constraint.kind]} ${blocked.distance.toFixed(1)}km，小于 ${blocked.hardRadius.toFixed(1)}km 避让线`,
      ],
    };
  }
  audits.forEach((audit) => {
    if (audit.distance < audit.cautionRadius) {
      penalty +=
        24 *
        (1 -
          (audit.distance - audit.hardRadius) /
            Math.max(0.25, audit.cautionRadius - audit.hardRadius));
    }
  });
  const nearestAudits = audits.slice(0, 2);
  return {
    eligible: true,
    score: Math.max(35, 100 - Math.min(65, penalty)),
    verified: true,
    notes: nearestAudits.map((audit) =>
      audit.hardRadius > 0
        ? `距${constraintLabels[audit.constraint.kind]} ${audit.distance.toFixed(1)}km（红线 ${audit.hardRadius.toFixed(1)}km）`
        : `距${constraintLabels[audit.constraint.kind]} ${audit.distance.toFixed(1)}km`,
    ),
  };
}
