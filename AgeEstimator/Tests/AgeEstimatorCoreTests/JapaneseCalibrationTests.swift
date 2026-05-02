import XCTest
@testable import AgeEstimatorCore

final class JapaneseCalibrationTests: XCTestCase {
    func testDefaultCalibrationAppliesPerDecadeOffset() {
        let cal = JapaneseCalibration.default
        // Default decadeOffsets[4] (40s) is +2.5 — model under-predicts adult
        // Asian faces, calibration corrects upward.
        XCTAssertEqual(cal.apply(toAge: 45), 47.5, accuracy: 1e-9)
        // Default decadeOffsets[1] (teens) is -2.0.
        XCTAssertEqual(cal.apply(toAge: 15), 13.0, accuracy: 1e-9)
    }

    func testClampHonored() {
        let cal = JapaneseCalibration(decadeOffsets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                      scale: 1, bias: 0,
                                      clampMin: 18, clampMax: 80)
        XCTAssertEqual(cal.apply(toAge: 5), 18)
        XCTAssertEqual(cal.apply(toAge: 120), 80)
    }

    func testScaleAndBiasApply() {
        let cal = JapaneseCalibration(decadeOffsets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                      scale: 1.1, bias: -1,
                                      clampMin: 0, clampMax: 100)
        // (30 + 0) * 1.1 - 1 = 32
        XCTAssertEqual(cal.apply(toAge: 30), 32, accuracy: 1e-9)
    }

    func testOffsetIndexClampedToValidRange() {
        let cal = JapaneseCalibration.default
        // Negative input shouldn't crash on index lookup.
        _ = cal.apply(toAge: -5)
        // Very high input should pick the last decade slot, not overflow.
        _ = cal.apply(toAge: 200)
    }
}
