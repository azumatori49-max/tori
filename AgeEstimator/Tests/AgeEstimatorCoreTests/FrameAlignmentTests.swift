import XCTest
import CoreGraphics
@testable import AgeEstimatorCore

final class FrameAlignmentTests: XCTestCase {
    /// Build a `FaceDetection` good enough for FrameAlignment, with a 1x1
    /// dummy `CGImage` standing in for the actual crop.
    private func detection(centerX: CGFloat = 0.5,
                           centerY: CGFloat = 0.5,
                           height: CGFloat = FrameAlignment.targetHeight,
                           yaw: CGFloat = 0,
                           roll: CGFloat = 0) -> FaceDetection {
        let width = height * 0.75
        let bbox = CGRect(x: centerX - width / 2,
                          y: centerY - height / 2,
                          width: width,
                          height: height)
        let cs = CGColorSpaceCreateDeviceRGB()
        let ctx = CGContext(data: nil, width: 1, height: 1,
                            bitsPerComponent: 8, bytesPerRow: 4,
                            space: cs,
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        let dummy = ctx.makeImage()!
        return FaceDetection(boundingBoxNormalized: bbox,
                             roll: roll, yaw: yaw, pitch: 0,
                             alignedFace: dummy)
    }

    func testCenteredAtTargetSizeIsAligned() {
        XCTAssertTrue(FrameAlignment.isAligned(detection()))
    }

    func testOffCenterIsNotAligned() {
        let d = detection(centerX: 0.2, centerY: 0.5)
        XCTAssertFalse(FrameAlignment.isAligned(d))
    }

    func testTooSmallIsNotAligned() {
        let d = detection(height: FrameAlignment.targetHeight - 0.20)
        XCTAssertFalse(FrameAlignment.isAligned(d))
    }

    func testTiltedFaceIsNotAligned() {
        let d = detection(roll: 0.5) // ~28° tilt
        XCTAssertFalse(FrameAlignment.isAligned(d))
    }

    func testYawedFaceIsNotAligned() {
        let d = detection(yaw: 0.6) // ~34°
        XCTAssertFalse(FrameAlignment.isAligned(d))
    }

    func testScoreInZeroOneRange() {
        let s = FrameAlignment.score(for: detection(centerX: 0.1))
        XCTAssertGreaterThanOrEqual(s, 0)
        XCTAssertLessThanOrEqual(s, 1)
    }
}
