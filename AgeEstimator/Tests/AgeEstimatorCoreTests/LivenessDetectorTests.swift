import XCTest
@testable import AgeEstimatorCore

final class LivenessDetectorTests: XCTestCase {
    func testFreshDetectorIsNotLive() {
        let l = LivenessDetector()
        XCTAssertFalse(l.isLive)
    }

    func testStaticPoseStaysNotLive() {
        // Simulates a held-up photo: no pose movement at all.
        let l = LivenessDetector(window: 5, minSamples: 12, minPoseVariance: 0.0008)
        for _ in 0..<30 {
            l.observe(yaw: 0.05, pitch: -0.02, roll: 0.01)
        }
        XCTAssertFalse(l.isLive,
                       "A perfectly still presentation must not pass liveness.")
    }

    func testMovingHeadPasses() {
        let l = LivenessDetector(window: 5, minSamples: 12, minPoseVariance: 0.0008)
        // Simulate a real face swaying: yaw oscillates ±0.08 rad (~4.5°).
        for i in 0..<24 {
            let yaw = 0.08 * sin(Double(i) * 0.5)
            l.observe(yaw: CGFloat(yaw), pitch: 0, roll: 0)
        }
        XCTAssertTrue(l.isLive)
    }

    func testInsufficientSamplesNotLive() {
        let l = LivenessDetector(window: 5, minSamples: 12, minPoseVariance: 0.0001)
        for i in 0..<5 {
            l.observe(yaw: CGFloat(i) * 0.05, pitch: 0, roll: 0)
        }
        XCTAssertFalse(l.isLive)
    }

    func testResetClearsHistory() {
        let l = LivenessDetector(window: 5, minSamples: 12, minPoseVariance: 0.0008)
        for i in 0..<24 {
            l.observe(yaw: CGFloat(0.08 * sin(Double(i) * 0.5)), pitch: 0, roll: 0)
        }
        XCTAssertTrue(l.isLive)
        l.reset()
        XCTAssertFalse(l.isLive)
    }
}
