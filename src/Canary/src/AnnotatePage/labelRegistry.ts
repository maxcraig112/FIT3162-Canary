// Shared, in-memory registry for current project's label maps

let kpIdToName: Record<string, string> = {};
let kpNameToId: Record<string, string> = {};
let bbIdToName: Record<string, string> = {};
let bbNameToId: Record<string, string> = {};

export function setKeypointLabelMaps(idToName: Record<string, string>) {
  kpIdToName = { ...idToName };
  kpNameToId = Object.fromEntries(Object.entries(idToName).map(([id, name]) => [name, id]));
}

export function setBoundingBoxLabelMaps(idToName: Record<string, string>) {
  bbIdToName = { ...idToName };
  bbNameToId = Object.fromEntries(Object.entries(idToName).map(([id, name]) => [name, id]));
}

export function getKeypointLabelName(id: string): string {
  if (!id) return '';
  return kpIdToName[id];
}

export function getBoundingBoxLabelName(id: string): string {
  if (!id) return '';
  return bbIdToName[id];
}

export function getKeypointLabelIdByName(name: string): string {
  if (!name) return '';
  return kpNameToId[name];
}

export function getBoundingBoxLabelIdByName(name: string): string {
  if (!name) return '';
  return bbNameToId[name];
}

export function getKeypointIdToNameMap(): Record<string, string> {
  return { ...kpIdToName };
}

export function getBoundingBoxIdToNameMap(): Record<string, string> {
  return { ...bbIdToName };
}

export function getKeypointLabelNames(): string[] {
  return Object.values(kpIdToName);
}

export function getBoundingBoxLabelNames(): string[] {
  return Object.values(bbIdToName);
}
