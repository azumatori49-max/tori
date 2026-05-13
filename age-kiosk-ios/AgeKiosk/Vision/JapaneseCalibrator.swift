import Foundation

/// 日本人 (East Asian, 特に日本人) 向けの年齢キャリブレーション。
///
/// 多くの公開年齢推定モデル (IMDB-WIKI / Adience / UTKFace 等で学習) は
/// 欧米人サンプルが多数を占めるため、東アジア人 (特に女性) の年齢を
/// 実年齢より若く推定する偏りが先行研究で繰り返し報告されている。
/// (例: 20–40 代で平均 -3 〜 -6 歳のバイアス、子供 / 高齢者でバイアス縮小)
///
/// ここでは
///   1) 区分ごとのオフセット
///   2) 推定値が極端な場合の縮約 (高齢側で過大、若年側で過小になる回帰縮約)
///   3) 時系列の指数移動平均によるノイズ抑制
/// を組み合わせて、出荷時の Core ML モデルを再学習せずに
/// 日本人向け表示値へ寄せる。
///
/// 注: 真に日本人特化したい場合は、UTKFace の East-Asian サブセットや
/// AFAD (Asian Face Age Dataset) など東アジア中心データで学習した
/// モデル (`AgeNet.mlmodel`) に差し替えるのが最も効果的。
/// 本クラスは「公開モデル + 表示時補正」での実用ラインを担保する。
struct JapaneseCalibrator {
    /// 推定生年齢 → 表示用年齢へ変換。
    static func calibrate(rawAge: Float) -> Float {
        let age = max(0, min(100, rawAge))

        // (1) East-Asian bias の経験的オフセット (歳)。
        //     若年〜中年で大きく、未成年と高齢で縮小する区分線形。
        let offset: Float
        switch age {
        case ..<6:     offset =  0.0
        case ..<12:    offset = +1.0
        case ..<18:    offset = +2.5
        case ..<25:    offset = +4.0   // 学生〜社会人初期は最も若く出やすい
        case ..<35:    offset = +4.5
        case ..<45:    offset = +3.5
        case ..<55:    offset = +2.0
        case ..<65:    offset = +1.0
        default:       offset =  0.0
        }

        // (2) 極端な推定の縮約 (population mean ≒ 38 に向けて軽く Bayes shrink)
        let prior: Float = 38.0
        let shrink: Float = 0.08
        let shrunk = age + (prior - age) * shrink

        return max(0, min(100, shrunk + offset))
    }

    /// 信頼度に応じた重みを返す (顔の品質 / 角度から)。
    static func weight(captureQuality: Float, yaw: Float, pitch: Float, roll: Float) -> Float {
        let q = max(0, min(1, captureQuality))
        let yawPenalty   = max(0, 1 - abs(yaw)   / 0.6) // ~35°
        let pitchPenalty = max(0, 1 - abs(pitch) / 0.5)
        let rollPenalty  = max(0, 1 - abs(roll)  / 0.6)
        return q * yawPenalty * pitchPenalty * rollPenalty
    }
}

/// 時系列スムージング: 信頼度重み付き指数移動平均。
final class AgeSmoother {
    private(set) var smoothed: Float?
    private var totalWeight: Float = 0
    private let alpha: Float

    init(alpha: Float = 0.35) {
        self.alpha = alpha
    }

    func update(age: Float, weight: Float) -> Float {
        let w = max(0.05, min(1, weight))
        if let prev = smoothed {
            let a = alpha * w
            let next = prev * (1 - a) + age * a
            smoothed = next
            totalWeight += w
            return next
        } else {
            smoothed = age
            totalWeight = w
            return age
        }
    }

    func reset() {
        smoothed = nil
        totalWeight = 0
    }

    var isStable: Bool { totalWeight >= 3.0 }
}
