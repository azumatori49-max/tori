import CoreGraphics

/// Decides whether the detected face fits the on-screen oval guide well enough
/// to trigger inference. All checks use Vision's normalized image space (origin
/// bottom-left, coordinates in [0,1]).
struct FrameAlignment {
    /// Target face bbox center, in normalized image space.
    static let targetCenter = CGPoint(x: 0.5, y: 0.5)
    /// Target face bbox height (face occupying ~55% of frame height).
    static let targetHeight: CGFloat = 0.55
    static let centerTolerance: CGFloat = 0.08
    static let sizeTolerance: CGFloat = 0.12
    static let maxYawRad: CGFloat = 0.35
    static let maxRollRad: CGFloat = 0.30

    /// 0...1 score of how well the face fits the frame. >= 1 means aligned.
    static func score(for detection: FaceDetection) -> CGFloat {
        let bbox = detection.boundingBoxNormalized
        let center = CGPoint(x: bbox.midX, y: bbox.midY)
        let dx = abs(center.x - targetCenter.x)
        let dy = abs(center.y - targetCenter.y)
        let centerOK = max(0, 1 - max(dx, dy) / centerTolerance)
        let sizeOK = max(0, 1 - abs(bbox.height - targetHeight) / sizeTolerance)
        let yawOK = max(0, 1 - abs(detection.yaw) / maxYawRad)
        let rollOK = max(0, 1 - abs(detection.roll) / maxRollRad)
        return min(centerOK, sizeOK, yawOK, rollOK)
    }

    static func isAligned(_ detection: FaceDetection) -> Bool {
        score(for: detection) >= 0.85
    }
}
