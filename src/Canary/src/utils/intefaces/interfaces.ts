export interface Project {
  projectID: string;
  projectName: string;
  userID: string;
  numberOfBatches: number;
  lastUpdated: string;
  settings?: ProjectSettings;
}

export interface ProjectSettings {
  session?: Session;
}

export interface Session {
  enabled: boolean;
  password: string;
}

export interface Batch {
  batchID: string;
  batchName: string;
  projectID: string;
  numberOfTotalFiles: number;
  lastUpdated?: string; // optional timestamp if backend provides
  previewURL?: string; // first image URL for blurred background
  isComplete?: boolean;
}

export interface KeypointAnnotation {
  kind: 'keypoint';
  projectID: string;
  imageID: string;
  id: string;
  labelID: string;
  position: { x: number; y: number };
  // addToDatabase(): Promise<void>;
  // removeFromDatabase(): Promise<void>;
}

export interface BoundingBoxAnnotation {
  kind: 'boundingbox';
  projectID: string;
  imageID: string;
  id: string;
  labelID: string;
  points: Array<{ x: number; y: number }>;
  // addToDatabase(): Promise<void>;
  // removeFromDatabase(): Promise<void>;
}
