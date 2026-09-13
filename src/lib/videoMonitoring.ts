// ── Client-side video proctoring (Part B) ───────────────────────────────
// Uses MediaPipe's FaceLandmarker, self-hosted under /public/mediapipe/
// (WASM runtime + the float16 face_landmarker.task model) because the
// jsdelivr/unpkg CDNs MediaPipe normally loads from are unreachable from
// this environment.
//
// Two signals are derived from every analyzed frame:
//   - faceCount: how many faces the model detects (0 = no face, >1 = multiple faces)
//   - gazeDeviation: how far the candidate is looking away from the camera,
//     taken from the FaceLandmarker's blendshape outputs (outputFaceBlendshapes),
//     specifically the max of the 8 standard eye-gaze categories
//     (eyeLookIn/Out/Up/Down, Left/Right). Blendshapes were chosen over
//     decomposing the transformation matrix into Euler angles because their
//     meaning is unambiguous and needs no rotation-order assumptions.
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function createLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mediapipe/models/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
  } catch (err) {
    console.warn("FaceLandmarker GPU delegate failed, falling back to CPU:", err);
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mediapipe/models/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
  }
}

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker();
  }
  return landmarkerPromise;
}

const GAZE_BLENDSHAPES = [
  "eyeLookInLeft", "eyeLookOutLeft", "eyeLookUpLeft", "eyeLookDownLeft",
  "eyeLookInRight", "eyeLookOutRight", "eyeLookUpRight", "eyeLookDownRight",
];

export interface VideoFrameAnalysis {
  faceCount: number;
  gazeDeviation: number; // 0-1, higher = looking further away from camera
  // The first detected face's raw landmarks, present only when exactly one
  // face is in frame — callers (e.g. face-identity comparison) reuse these
  // instead of running a second detectForVideo() call on the same frame,
  // which MediaPipe's video mode doesn't support (it requires monotonically
  // increasing timestamps per call).
  landmarks: NormalizedLandmark[] | null;
}

export function analyzeVideoFrame(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number
): VideoFrameAnalysis {
  const result = landmarker.detectForVideo(video, timestampMs);
  const faceCount = result.faceLandmarks?.length ?? 0;

  let gazeDeviation = 0;
  const shapes = result.faceBlendshapes?.[0]?.categories;
  if (shapes) {
    for (const category of shapes) {
      if (GAZE_BLENDSHAPES.includes(category.categoryName)) {
        gazeDeviation = Math.max(gazeDeviation, category.score);
      }
    }
  }

  const landmarks = faceCount === 1 ? (result.faceLandmarks[0] ?? null) : null;

  return { faceCount, gazeDeviation, landmarks };
}

// ── Debounce helper ──────────────────────────────────────────────────────
// A single noisy frame (a blink, a momentary re-angle, a model miss) must
// never fire an alert on its own — that mirrors the existing
// voiceMismatchCountRef pattern in InterviewScreen.tsx, which only escalates
// a voice mismatch after it repeats across answers. Here it's applied per
// video frame: a condition must hold for `requiredHits` consecutive checks
// before onTrigger fires, and it fires only once per sustained episode
// (reset() re-arms it once the condition clears).
export class SustainedCondition {
  private hitCount = 0;
  private fired = false;

  constructor(private requiredHits: number) {}

  update(conditionMet: boolean): boolean {
    if (!conditionMet) {
      this.hitCount = 0;
      this.fired = false;
      return false;
    }
    this.hitCount += 1;
    if (this.hitCount >= this.requiredHits && !this.fired) {
      this.fired = true;
      return true;
    }
    return false;
  }
}
