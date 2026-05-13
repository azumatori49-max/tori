import Foundation

/// 居酒屋入店時の年齢確認ゲート。
///
/// 法的留意:
///   - 日本では飲酒可能年齢は 20 歳 (未成年者飲酒禁止法)。
///   - 顔写真からの年齢「推定」は本人確認書類による「確認」には法的に
///     代替できない。本ゲートはあくまで「明らかに 20 歳以上」と
///     判断できる客をスムーズに通すための一次スクリーニング。
///   - 境界域 (例: 推定 20-25 歳) は **必ず身分証確認** に倒す
///     "fail-closed" 設計とする。
///   - 風適法 22 条 (深夜酒類提供) や 18 歳未満の入店制限がかかる
///     業態 (深夜営業のキャバクラ等) では 18 歳/20 歳の双方の
///     ゲートが必要になる場合があるため `Decision` で両方扱う。
enum EntryDecision: Equatable {
    /// 明らかに 20 歳以上。入店 OK。
    case allowAdult
    /// 18 歳以上 20 歳未満が濃厚 (深夜業態などで参考)。
    case allowMinorAdultOnly
    /// 境界域 or 若年濃厚 — 身分証確認が必要。
    case requireIdCheck
    /// 顔が安定検出できなかった (再試行を促す)。
    case retry
}

struct GatePolicy {
    /// この推定年齢以上なら「明らかに成人」として通す。
    var confidentAdultThreshold: Float = 25.0
    /// この推定年齢未満は「未成年濃厚」として弾く (深夜業態用)。
    var minorThreshold: Float = 18.0
    /// 推定が境界域 (minorThreshold ..< confidentAdultThreshold) のときは
    /// 身分証確認に倒す。
    static let `default` = GatePolicy()
}

enum GateDecider {
    static func decide(displayAge: Float, policy: GatePolicy = .default) -> EntryDecision {
        if displayAge >= policy.confidentAdultThreshold {
            return .allowAdult
        }
        if displayAge >= policy.minorThreshold {
            return .requireIdCheck
        }
        // minorThreshold 未満。深夜業態でない普通の居酒屋では
        // 「要身分証」で扱えば十分 (= 入店させない)。
        return .requireIdCheck
    }
}
