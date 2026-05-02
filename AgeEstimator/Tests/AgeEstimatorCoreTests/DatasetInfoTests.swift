import XCTest
@testable import AgeEstimatorCore

final class DatasetInfoTests: XCTestCase {
    func testRoundsDownToManUnit() {
        let info = DatasetInfo(totalSampleCount: 217_000, sources: [])
        XCTAssertEqual(info.displayCountJP, "21万人以上")
    }

    func testNeverOverstatesCount() {
        // 219,999 should still display as "21万", not "22万".
        let info = DatasetInfo(totalSampleCount: 219_999, sources: [])
        XCTAssertEqual(info.displayCountJP, "21万人以上")
    }

    func testFallbackForSubManCounts() {
        let info = DatasetInfo(totalSampleCount: 4_500, sources: [])
        XCTAssertEqual(info.displayCountJP, "4,000 人以上")
    }

    func testTaglineEmbedsCount() {
        let info = DatasetInfo(totalSampleCount: 100_000, sources: [])
        XCTAssertTrue(info.tagline.contains("10万人以上"))
        XCTAssertTrue(info.tagline.contains("AI"))
    }
}
