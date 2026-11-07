export type SectionId =
  | "home"
  | "project-geofence"
  | "project-Evilog"
  | "project-safepath"
  | "research"
  | "return";

export interface SectionConfig {
  id: SectionId;
  label: string;
  navVisible: boolean;
}

export const SECTIONS: SectionConfig[] = [
  { id: "home", label: "Home", navVisible: true },
  { id: "project-geofence", label: "GeoFence", navVisible: false },
  { id: "project-Evilog", label: "EviLog", navVisible: false },
  { id: "project-safepath", label: "SafePath", navVisible: false },
  { id: "research", label: "Research", navVisible: true },
  { id: "return", label: "Contact", navVisible: true },
];
