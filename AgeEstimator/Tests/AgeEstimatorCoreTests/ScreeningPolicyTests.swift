import XCTest
@testable import AgeEstimatorCore

final class ScreeningPolicyTests: XCTestCase {
    private let policy = ScreeningPolicy.izakaya

    func testNotEnoughSamplesAlwaysRoutesToIDCheck() {
        let outcome = policy.evaluate(age: 35, stdDev: 1, sampleCount: 1)
        XCTAssertEqual(outcome, .idCheckRequired)
    }

    func testClearAdultIsCleared() {
        // 35 ± 1.5 = 33.5..36.5, lower bound well above 25 -> cleared.
        let outcome = policy.evaluate(age: 35, stdDev: 1, sampleCount: 5)
        XCTAssertEqual(outcome, .cleared)
    }

    func testGrayZoneRoutesToIDCheck() {
        // 22 ± 4.5 -> 17.5..26.5: upper > 18 (no hard block), lower < 25 (no clear).
        let outcome = policy.evaluate(age: 22, stdDev: 3, sampleCount: 6)
        XCTAssertEqual(outcome, .idCheckRequired)
    }

    func testYoungAdultBorderlineGoesToIDCheck() {
        // 26 ± 1.5 -> 24.5..27.5: lower below 25 -> still ID check, even though
        // the point estimate is over 25. This is the policy's whole point.
        let outcome = policy.evaluate(age: 26, stdDev: 1, sampleCount: 5)
        XCTAssertEqual(outcome, .idCheckRequired)
    }

    func testObviousMinorIsBlocked() {
        // 14 ± 1.5 -> 12.5..15.5, upper bound under 18 -> hard block.
        let outcome = policy.evaluate(age: 14, stdDev: 1, sampleCount: 5)
        XCTAssertEqual(outcome, .blockedMinor)
    }

    func testMinorOnTheBubbleGoesToIDCheckNotBlock() {
        // 17 ± 1.5*1 = 15.5..18.5: upper bound at 18 or above -> NOT a hard
        // block, must go to staff. We require certainty before blocking.
        let outcome = policy.evaluate(age: 17, stdDev: 1, sampleCount: 5)
        XCTAssertEqual(outcome, .idCheckRequired)
    }

    func testHighUncertaintyDownGradesToIDCheck() {
        // Even an apparent 40-year-old with huge stdDev shouldn't be cleared
        // — uncertainty band crosses the 25-yr line.
        let outcome = policy.evaluate(age: 40, stdDev: 12, sampleCount: 5)
        XCTAssertEqual(outcome, .idCheckRequired)
    }

    func testStdDevFloorPreventsRunawayConfidence() {
        // stdDev = 0 should still get treated as if stdDev = 1 (the floor),
        // so we never hand out clearings on zero variance noise.
        let outcome = policy.evaluate(age: 26, stdDev: 0, sampleCount: 5)
        // 26 - 1.5 * 1 = 24.5 < 25 -> ID check, not cleared.
        XCTAssertEqual(outcome, .idCheckRequired)
    }
}
