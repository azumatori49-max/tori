import Foundation

/// Three-tier screening decision for an izakaya / 酒類提供 entrance:
///
///   * `.cleared`         — clearly past the gray zone. Let them through.
///   * `.idCheckRequired` — borderline. Hand off to staff for ID check.
///   * `.blockedMinor`    — almost certainly under the legal threshold.
///
/// The classifier looks at *both* the smoothed point estimate and the
/// uncertainty band (`mean ± k*stdDev`):
///
///   - If the upper bound is below `hardBlockBelow`, even being generous
///     puts them under age -> hard block.
///   - If the lower bound is at or above `idCheckBelow`, even being
///     conservative puts them past the ID-check zone -> cleared.
///   - Anything else -> ID check required.
///
/// **This is screening, not verification.** Japanese law (風営法/未成年者飲酒禁止法)
/// puts the legal duty to refuse alcohol service to minors on the operator,
/// and an age-estimation model has ~3-5 year MAE — so any prediction in the
/// gray zone *must* still be verified by staff with a physical ID.
struct ScreeningPolicy {
    /// Upper bound below this -> hard block. Default 18 (Japanese drinking age).
    let hardBlockBelow: Double
    /// Lower bound at/above this -> cleared without ID check. Default 25, the
    /// industry-standard "looks 25 or younger -> ask for ID" margin.
    let idCheckBelow: Double
    /// Multiplier on stdDev for the uncertainty band.
    let safetyMargin: Double
    /// Minimum samples before we'll emit anything other than `.idCheckRequired`.
    let minSamples: Int

    enum Outcome: Equatable {
        case cleared
        case idCheckRequired
        case blockedMinor
    }

    func evaluate(age: Double, stdDev: Double, sampleCount: Int) -> Outcome {
        // Until we have enough samples, default-deny: send to staff for ID.
        guard sampleCount >= minSamples else { return .idCheckRequired }
        let band = safetyMargin * max(stdDev, 1.0)
        let lower = age - band
        let upper = age + band
        if upper < hardBlockBelow { return .blockedMinor }
        if lower >= idCheckBelow { return .cleared }
        return .idCheckRequired
    }

    /// Defaults tuned for a Japanese izakaya:
    ///   - hard block when even the upper bound is < 18
    ///   - clear only when the lower bound is ≥ 25
    ///   - everything in between is staff handoff
    static let izakaya = ScreeningPolicy(
        hardBlockBelow: 18,
        idCheckBelow: 25,
        safetyMargin: 1.5,
        minSamples: 5
    )
}
