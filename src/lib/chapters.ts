export const chapters = [
  { id: "awakening", number: "00", title: "The Awakening" },
  { id: "genesis", number: "01", title: "Genesis" },
  { id: "fracture", number: "02", title: "Fracture" },
  { id: "metamorphosis", number: "03", title: "Metamorphosis" },
  { id: "rebirth", number: "04", title: "Rebirth" },
] as const;

export type Chapter = (typeof chapters)[number];
export type ChapterId = Chapter["id"];
