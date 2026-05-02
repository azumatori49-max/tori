import XCTest
@testable import AgeEstimatorCore

final class PredictionSmootherTests: XCTestCase {
    private func sample(_ age: Double, conf: Double = 0.7) -> AgePrediction {
        AgePrediction(rawAge: age, age: age, confidence: conf)
    }

    func testSingleSamplePassesThrough() {
        let s = PredictionSmoother(capacity: 5)
        let out = s.add(sample(30))
        XCTAssertEqual(out.age, 30, accuracy: 1e-9)
        XCTAssertEqual(s.ageStdDev, 0)
    }

    func testTrimmedMeanDropsExtremesOnceWeHaveFour() {
        let s = PredictionSmoother(capacity: 5)
        _ = s.add(sample(20))
        _ = s.add(sample(30))
        _ = s.add(sample(31))
        let out = s.add(sample(50)) // should drop 20 and 50, mean of 30+31
        XCTAssertEqual(out.age, 30.5, accuracy: 1e-9)
    }

    func testCapacityTrimsOldestSample() {
        let s = PredictionSmoother(capacity: 3)
        _ = s.add(sample(10))
        _ = s.add(sample(20))
        _ = s.add(sample(30))
        let out = s.add(sample(40)) // 10 evicted; window is [20, 30, 40]
        // capacity 3: trimmed mean isn't applied (need >= 4), so simple mean.
        XCTAssertEqual(out.age, 30, accuracy: 1e-9)
    }

    func testStdDevReflectsSpread() {
        let s = PredictionSmoother(capacity: 5)
        _ = s.add(sample(20))
        _ = s.add(sample(40))
        // Sample stdDev of [20,40] is sqrt(((20-30)^2 + (40-30)^2)/1) = sqrt(200) ~ 14.14
        XCTAssertEqual(s.ageStdDev, sqrt(200), accuracy: 1e-6)
    }

    func testResetClearsHistory() {
        let s = PredictionSmoother(capacity: 5)
        _ = s.add(sample(20))
        _ = s.add(sample(40))
        s.reset()
        XCTAssertEqual(s.ageStdDev, 0)
        let out = s.add(sample(33))
        XCTAssertEqual(out.age, 33, accuracy: 1e-9)
    }
}
