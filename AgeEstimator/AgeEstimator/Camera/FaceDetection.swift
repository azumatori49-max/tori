import CoreGraphics

/// One face Vision found in a single camera frame.
struct FaceDetection {
    /// Bounding box in normalized image coordinates (Vision: origin bottom-left).
    let boundingBoxNormalized: CGRect
    /// Roll/yaw/pitch in radians, when available.
    let roll: CGFloat
    let yaw: CGFloat
    let pitch: CGFloat
    /// Cropped, upright RGB face image suitable for CoreML inference.
    let alignedFace: CGImage
}

/// Result of running face detection on a single camera frame.
struct FaceDetectionResult {
    /// Number of faces Vision found, regardless of whether we extracted a crop.
    let totalFaceCount: Int
    /// The largest face — the one we'll feed to the age model.
    let primary: FaceDetection?
}
