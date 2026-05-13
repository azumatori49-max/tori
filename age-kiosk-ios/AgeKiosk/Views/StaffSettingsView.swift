import SwiftUI

/// スタッフ向け閾値設定。誤操作防止のため PIN で保護。
/// 既定 PIN は `0000`。`UserDefaults` キー `staff.pin` で変更可。
struct StaffSettingsView: View {
    @Binding var policy: GatePolicy
    @Environment(\.dismiss) private var dismiss
    @State private var pin: String = ""
    @State private var unlocked = false

    private var storedPin: String {
        UserDefaults.standard.string(forKey: "staff.pin") ?? "0000"
    }

    var body: some View {
        NavigationStack {
            Group {
                if unlocked {
                    settings
                } else {
                    pinLock
                }
            }
            .navigationTitle("スタッフ設定")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
    }

    private var pinLock: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("スタッフ PIN を入力")
                .font(.headline)
            SecureField("PIN", text: $pin)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .padding()
                .frame(maxWidth: 240)
                .background(Color.gray.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                .onSubmit(tryUnlock)
            Button("確認", action: tryUnlock)
                .buttonStyle(.borderedProminent)
            Text("初期 PIN: 0000")
                .font(.caption)
                .foregroundStyle(.tertiary)
            Spacer()
        }
        .padding()
    }

    private func tryUnlock() {
        if pin == storedPin {
            unlocked = true
        }
        pin = ""
    }

    private var settings: some View {
        Form {
            Section("入店判定の閾値 (推定年齢ベース)") {
                Stepper(value: $policy.confidentAdultThreshold, in: 20...40, step: 1) {
                    HStack {
                        Text("成人として通す")
                        Spacer()
                        Text("\(Int(policy.confidentAdultThreshold)) 歳以上")
                            .foregroundStyle(.secondary)
                    }
                }
                Stepper(value: $policy.minorThreshold, in: 12...20, step: 1) {
                    HStack {
                        Text("明らかな未成年")
                        Spacer()
                        Text("\(Int(policy.minorThreshold)) 歳未満")
                            .foregroundStyle(.secondary)
                    }
                }
                Text("境界域 (\(Int(policy.minorThreshold))〜\(Int(policy.confidentAdultThreshold)) 歳) は必ず身分証確認に倒します。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("運用メモ") {
                Label("年齢推定は一次スクリーニングです", systemImage: "info.circle")
                Label("最終的な年齢確認はスタッフが本人確認書類で行ってください", systemImage: "person.text.rectangle")
                Label("3 本指タップで強制リセット", systemImage: "hand.tap")
                Label("1.5 秒長押しでこの設定画面", systemImage: "gear")
            }

            Section("プリセット") {
                Button("飲酒提供あり (推奨)") {
                    policy.confidentAdultThreshold = 25
                    policy.minorThreshold = 18
                }
                Button("深夜営業 (より保守的)") {
                    policy.confidentAdultThreshold = 28
                    policy.minorThreshold = 20
                }
                Button("既定に戻す") {
                    policy = .default
                }
            }
        }
    }
}
