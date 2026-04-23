import {
  RekognitionClient,
  DetectFacesCommand,
  type FaceDetail,
} from '@aws-sdk/client-rekognition';
import { toByteArray } from 'base64-js';

export type FaceAnalysis = {
  ageLow: number;
  ageHigh: number;
  confidence: number;
  qualityBrightness: number;
  qualitySharpness: number;
  boundingBox: { left: number; top: number; width: number; height: number };
  faceCount: number;
};

let cachedClient: RekognitionClient | null = null;

function getClient(): RekognitionClient {
  if (cachedClient) return cachedClient;
  const region = process.env.EXPO_PUBLIC_AWS_REGION;
  const accessKeyId = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS 認証情報が未設定です。.env の EXPO_PUBLIC_AWS_* を確認してください。',
    );
  }
  cachedClient = new RekognitionClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

// グループ入店時の未成年検知のため、最年少候補（AgeRange.High が最小）を採用する。
// 大人と一緒に入る未成年を「最大の顔」ロジックで見逃さないための措置。
function pickYoungestFace(faces: FaceDetail[]): FaceDetail {
  return faces.reduce((youngest, current) => {
    const yHigh = youngest.AgeRange?.High ?? Number.POSITIVE_INFINITY;
    const cHigh = current.AgeRange?.High ?? Number.POSITIVE_INFINITY;
    return cHigh < yHigh ? current : youngest;
  });
}

export async function detectFaces(base64Jpeg: string): Promise<FaceAnalysis | null> {
  const bytes = toByteArray(base64Jpeg);
  const client = getClient();
  const res = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: bytes },
      Attributes: ['AGE_RANGE', 'DEFAULT'],
    }),
  );
  const faces = res.FaceDetails ?? [];
  if (faces.length === 0) return null;
  const face = pickYoungestFace(faces);
  const box = face.BoundingBox;
  return {
    ageLow: face.AgeRange?.Low ?? 0,
    ageHigh: face.AgeRange?.High ?? 0,
    confidence: face.Confidence ?? 0,
    qualityBrightness: face.Quality?.Brightness ?? 0,
    qualitySharpness: face.Quality?.Sharpness ?? 0,
    boundingBox: {
      left: box?.Left ?? 0,
      top: box?.Top ?? 0,
      width: box?.Width ?? 0,
      height: box?.Height ?? 0,
    },
    faceCount: faces.length,
  };
}
