import SwiftUI

struct RootView: View {
    @StateObject private var viewModel = AgeEstimationViewModel()

    var body: some View {
        ZStack {
            backgroundColor(for: viewModel.state).ignoresSafeArea()

            CameraPreviewView(session: viewModel.cameraManager.session)
                .ignoresSafeArea()
                .scaleEffect(x: -1, y: 1)
                .opacity(viewModel.state.isTerminal ? 0.25 : 1.0)

            OvalFrameOverlay(state: viewModel.state)
                .ignoresSafeArea()
                .opacity(viewModel.state.isTerminal ? 0 : 1)

            VStack(spacing: 0) {
                DatasetBadge(info: .default)
                    .padding(.top, 24)
                Header(state: viewModel.state)
                    .padding(.top, 24)
                Spacer()
                ResultPanel(viewModel: viewModel)
                    .padding(.bottom, 40)
                FooterDisclaimer()
                    .padding(.bottom, 20)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: viewModel.state)
        .task { await viewModel.start() }
        .onDisappear { viewModel.stop() }
    }

    private func backgroundColor(for state: AgeEstimationState) -> Color {
        switch state {
        case .cleared: return Color(red: 0.05, green: 0.35, blue: 0.20)
        case .idCheckRequired: return Color(red: 0.55, green: 0.35, blue: 0.05)
        case .blockedMinor: return Color(red: 0.45, green: 0.05, blue: 0.05)
        default: return .black
        }
    }
}

private struct Header: View {
    let state: AgeEstimationState

    var body: some View {
        Group {
            switch state {
            case .searching:
                title("枠に顔を合わせてください",
                      subtitle: DatasetInfo.default.tagline)
            case .multipleFaces:
                title("お一人ずつお願いします",
                      subtitle: "枠の中に映るのは一名のみにしてください。")
            case .aligning(let progress):
                title("そのまま静止…",
                      subtitle: String(format: "%d%%", Int(progress * 100)))
            case .livenessRequired:
                title("少し顔を動かしてください",
                      subtitle: "本人確認のため、軽く顔を左右に振ってください。")
            case .estimating:
                title("解析中…", subtitle: "数秒お待ちください。")
            case .cleared, .idCheckRequired, .blockedMinor:
                EmptyView()
            }
        }
    }

    private func title(_ t: String, subtitle: String?) -> some View {
        VStack(spacing: 8) {
            Text(t)
                .font(.system(size: 24, weight: .semibold))
                .foregroundColor(.white)
                .multilineTextAlignment(.center)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundColor(.white.opacity(0.75))
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 32)
        .shadow(radius: 4)
    }
}

private struct ResultPanel: View {
    @ObservedObject var viewModel: AgeEstimationViewModel

    var body: some View {
        VStack(spacing: 18) {
            switch viewModel.state {
            case .cleared:
                BigBadge(symbol: "checkmark.circle.fill",
                         color: .green,
                         heading: "OK どうぞお入りください",
                         subheading: "20 歳以上と判定されました。")
            case .idCheckRequired(let age, _):
                BigBadge(symbol: "person.text.rectangle.fill",
                         color: .yellow,
                         heading: "店員に身分証をご提示ください",
                         subheading: String(format: "推定 %d 歳前後 — 規定により確認させていただきます。",
                                            Int(age.rounded())))
            case .blockedMinor:
                BigBadge(symbol: "xmark.octagon.fill",
                         color: .red,
                         heading: "ご利用いただけません",
                         subheading: "20 歳未満の方への酒類提供はできません。")
            default:
                EmptyView()
            }

            if viewModel.state.isTerminal {
                Button("次の方へ") { viewModel.reset() }
                    .font(.system(size: 16, weight: .semibold))
                    .padding(.horizontal, 36)
                    .padding(.vertical, 14)
                    .background(Color.white)
                    .foregroundColor(.black)
                    .clipShape(Capsule())
            }
        }
    }
}

private struct BigBadge: View {
    let symbol: String
    let color: Color
    let heading: String
    let subheading: String

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 88, weight: .bold))
                .foregroundColor(color)
                .shadow(radius: 6)
            Text(heading)
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.white)
                .multilineTextAlignment(.center)
            Text(subheading)
                .font(.system(size: 14))
                .foregroundColor(.white.opacity(0.85))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 32)
    }
}

private struct DatasetBadge: View {
    let info: DatasetInfo

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "person.3.sequence.fill")
                .font(.system(size: 12, weight: .semibold))
            Text("AI 学習データ \(info.displayCountJP)")
                .font(.system(size: 12, weight: .semibold))
        }
        .foregroundColor(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.18))
        .overlay(Capsule().stroke(Color.white.opacity(0.35), lineWidth: 0.5))
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.3), radius: 4, y: 1)
    }
}

private struct FooterDisclaimer: View {
    var body: some View {
        Text("AI 推定はあくまで一次スクリーニングです。最終判断は店舗スタッフが身分証で行います。\n撮影画像はデバイス内で処理され、保存・送信されません。")
            .font(.system(size: 11))
            .foregroundColor(.white.opacity(0.6))
            .multilineTextAlignment(.center)
            .padding(.horizontal, 24)
    }
}

#Preview {
    RootView()
}
