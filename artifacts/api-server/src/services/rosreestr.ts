export interface RosreestrRecord {
  attestatNumber: string;
  engineerName: string;
  status: "active" | "suspended" | "revoked";
  sroName: string;
  sroStatus: "active" | "inactive";
  worksCount: number;
  rejectionsCount: number;
  suspensionsCount: number;
}

export interface RosreestrProvider {
  lookupByAttestat(attestatNumber: string): Promise<RosreestrRecord | null>;
}

const MOCK_REGISTRY: Record<string, RosreestrRecord> = {
  "77-13-2023001": {
    attestatNumber: "77-13-2023001",
    engineerName: "Дмитрий Иванов",
    status: "active",
    sroName: "СРО АКО «Кадастровые инженеры»",
    sroStatus: "active",
    worksCount: 143,
    rejectionsCount: 4,
    suspensionsCount: 0,
  },
  "78-05-2022015": {
    attestatNumber: "78-05-2022015",
    engineerName: "Анна Смирнова",
    status: "active",
    sroName: "НП СРО КИ «Содружество кадастровых инженеров»",
    sroStatus: "active",
    worksCount: 87,
    rejectionsCount: 2,
    suspensionsCount: 1,
  },
  "50-11-2021044": {
    attestatNumber: "50-11-2021044",
    engineerName: "Алексей Петров",
    status: "active",
    sroName: "Ассоциация «КИ Подмосковья»",
    sroStatus: "active",
    worksCount: 212,
    rejectionsCount: 6,
    suspensionsCount: 0,
  },
  "23-08-2020099": {
    attestatNumber: "23-08-2020099",
    engineerName: "Марина Козлова",
    status: "suspended",
    sroName: "СРО АКО «Кадастровые инженеры»",
    sroStatus: "active",
    worksCount: 35,
    rejectionsCount: 11,
    suspensionsCount: 2,
  },
  "66-02-2019007": {
    attestatNumber: "66-02-2019007",
    engineerName: "Игорь Волков",
    status: "active",
    sroName: "Уральская ассоциация кадастровых инженеров",
    sroStatus: "inactive",
    worksCount: 62,
    rejectionsCount: 3,
    suspensionsCount: 0,
  },
  "54-09-2022031": {
    attestatNumber: "54-09-2022031",
    engineerName: "Светлана Новикова",
    status: "revoked",
    sroName: "СРО КИ Сибири",
    sroStatus: "active",
    worksCount: 14,
    rejectionsCount: 5,
    suspensionsCount: 3,
  },
};

export class MockRosreestrProvider implements RosreestrProvider {
  async lookupByAttestat(attestatNumber: string): Promise<RosreestrRecord | null> {
    const record = MOCK_REGISTRY[attestatNumber.trim()];
    return record ?? null;
  }
}

export const rosreestrProvider: RosreestrProvider = new MockRosreestrProvider();

export function computeRatingFromRosreestr(record: RosreestrRecord): number {
  if (record.worksCount === 0) return 3.5;
  const rejectionRate = record.rejectionsCount / record.worksCount;
  const suspensionPenalty = record.suspensionsCount * 0.1;
  let rating = 5.0 - rejectionRate * 10 - suspensionPenalty;
  if (record.worksCount >= 100) rating += 0.2;
  else if (record.worksCount >= 50) rating += 0.1;
  rating = Math.max(2.5, Math.min(5.0, rating));
  return Math.round(rating * 10) / 10;
}
