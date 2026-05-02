import Foundation

/// Single source of truth for the "AI 学習データ 〜万人" tagline shown in the UI.
///
/// **The number you put here is a marketing/trust claim — it must match the
/// number of unique faces actually used to train the bundled `AgeNetJP`
/// model.** Update both this value and the dataset wiring in
/// `Scripts/finetune_japanese.py` together; otherwise the tagline becomes a
/// 不当景品類及び不当表示防止法 (景表法) issue.
struct DatasetInfo {
    /// Total unique face samples in the training corpus.
    let totalSampleCount: Int
    /// Optional human-readable list of source datasets, displayed in a
    /// long-press tooltip / about screen if you choose to surface it.
    let sources: [String]

    /// Conservative Japanese-style display: rounds **down** to the nearest 万
    /// so the tagline never overstates the actual count.
    var displayCountJP: String {
        if totalSampleCount >= 10_000 {
            let man = totalSampleCount / 10_000
            return "\(man)万人以上"
        }
        if totalSampleCount >= 1_000 {
            let sen = totalSampleCount / 1_000
            return "\(sen),000 人以上"
        }
        return "\(totalSampleCount) 人"
    }

    /// Full tagline, e.g. "日本人 21万人以上 の顔データで学習した AI が判定しています".
    var tagline: String {
        "日本人 \(displayCountJP) の顔データで学習した AI が判定しています"
    }

    /// Default reflects the bundled corpus configured in
    /// `Scripts/finetune_japanese.py`:
    ///   * AFAD-Full           ≈ 164,000
    ///   * All-Age-Faces (AAF) ≈  13,000
    ///   * MegaAge-Asian       ≈  40,000
    /// Rounded down to 21万.
    static let `default` = DatasetInfo(
        totalSampleCount: 217_000,
        sources: ["AFAD-Full", "All-Age-Faces", "MegaAge-Asian"]
    )
}
