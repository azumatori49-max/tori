import SwiftUI

struct KioskView: View {
    @StateObject private var viewModel = KioskViewModel()
    @State private var showSettings = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                CameraPreviewView(session: viewModel.camera.session)
                    .ignoresSafeArea()
                    .overlay(decisionTint)

                FaceBoxOverlay(rect: viewModel.faceBox, size: proxy.size)

                VStack {
                    HeaderBar()
                    Spacer()
                    StateCard(state: viewModel.state)
                        .padding(.horizontal, 24)
                        .padding(.bottom, 24)
                    DisclaimerBar()
                        .padding(.horizontal, 24)
                        .padding(.bottom, 24)
                }
            }
            .task { await viewModel.bootstrap() }
            // 4 本指長押し: スタッフ用設定 (誤操作防止)
            .onLongPressGesture(minimumDuration: 1.5) { /* primary, ignored */ }
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 1.5)
                    .onEnded { _ in showSettings = true }
            )
            .onTapGesture(count: 3) {
                viewModel.resetToWaiting()
            }
            .sheet(isPresented: $showSettings) {
                StaffSettingsView(policy: $viewModel.policy)
            }
        }
    }

    @ViewBuilder
    private var decisionTint: some View {
        switch viewModel.state {
        case .decided(.allowAdult, _):
            Color.green.opacity(0.18).ignoresSafeArea().allowsHitTesting(false)
        case .decided(.requireIdCheck, _), .decided(.allowMinorAdultOnly, _):
            Color.orange.opacity(0.22).ignoresSafeArea().allowsHitTesting(false)
        default:
            Color.clear
        }
    }
}

private struct HeaderBar: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("年齢確認")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                Text("カメラを正面から見てください")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.75))
            }
            Spacer()
            Image(systemName: "lock.shield")
                .foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 24)
        .padding(.top, 24)
    }
}

private struct DisclaimerBar: View {
    var body: some View {
        Text("映像はこの端末内でのみ処理され、保存・送信されません。\n最終的な年齢確認はスタッフが行います。")
            .font(.system(size: 11))
            .foregroundStyle(.white.opacity(0.55))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }
}

private struct FaceBoxOverlay: View {
    let rect: CGRect?
    let size: CGSize

    var body: some View {
        Canvas { ctx, _ in
            guard let r = rect else { return }
            let box = CGRect(
                x: r.minX * size.width,
                y: r.minY * size.height,
                width: r.width * size.width,
                height: r.height * size.height
            )
            let path = Path(roundedRect: box, cornerRadius: 16)
            ctx.stroke(path, with: .color(.white.opacity(0.85)), lineWidth: 3)
        }
        .allowsHitTesting(false)
    }
}

private struct StateCard: View {
    let state: KioskViewModel.State

    var body: some View {
        Group {
            switch state {
            case .waiting:
                MessageCard(
                    title: "顔をフレームに合わせてください",
                    subtitle: "正面を向いて、明るい場所で",
                    systemImage: "person.crop.circle.dashed",
                    accent: .white
                )
            case .scanning(let progress):
                ScanningCard(progress: progress)
            case .decided(.allowAdult, _):
                BigDecisionCard(
                    headline: "どうぞ お入りください",
                    sub: "20歳以上と推定されました",
                    systemImage: "checkmark.seal.fill",
                    color: .green
                )
            case .decided(.requireIdCheck, _):
                BigDecisionCard(
                    headline: "身分証のご提示をお願いします",
                    sub: "スタッフが確認いたします",
                    systemImage: "person.text.rectangle.fill",
                    color: .orange
                )
            case .decided(.allowMinorAdultOnly, _):
                BigDecisionCard(
                    headline: "身分証のご提示をお願いします",
                    sub: "未成年の可能性があります",
                    systemImage: "exclamationmark.shield.fill",
                    color: .orange
                )
            case .decided(.retry, _):
                MessageCard(
                    title: "もう一度お試しください",
                    subtitle: "正面を向いて 2 秒お待ちください",
                    systemImage: "arrow.clockwise",
                    accent: .white
                )
            case .noPermission:
                MessageCard(
                    title: "カメラ許可が必要です",
                    subtitle: "設定 → AgeKiosk → カメラ をオン",
                    systemImage: "exclamationmark.triangle.fill",
                    accent: .yellow
                )
            case .noModel:
                MessageCard(
                    title: "モデル未搭載",
                    subtitle: "AgeNet.mlmodel を Resources に追加",
                    systemImage: "questionmark.app.dashed",
                    accent: .yellow
                )
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.white.opacity(0.08), lineWidth: 1)
        )
    }
}

private struct MessageCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let accent: Color

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.system(size: 36))
                .foregroundStyle(accent.opacity(0.9))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.7))
            }
            Spacer()
        }
    }
}

private struct ScanningCard: View {
    let progress: Float

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                ProgressView().tint(.white)
                Text("確認中...")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
            }
            ProgressView(value: Double(progress))
                .tint(.white)
            Text("そのまま静止してください")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.7))
        }
    }
}

private struct BigDecisionCard: View {
    let headline: String
    let sub: String
    let systemImage: String
    let color: Color

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 72, weight: .bold))
                .foregroundStyle(color)
            Text(headline)
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text(sub)
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.8))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    KioskView()
}
