import SwiftUI

struct RootView: View {
    @StateObject private var viewModel = AgeEstimationViewModel()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            CameraPreviewView(session: viewModel.cameraManager.session)
                .ignoresSafeArea()
                .scaleEffect(x: -1, y: 1) // mirror for selfie UX

            OvalFrameOverlay(state: viewModel.state)
                .ignoresSafeArea()

            VStack {
                StatusText(state: viewModel.state)
                    .padding(.top, 80)
                Spacer()
                BottomBar(viewModel: viewModel)
                    .padding(.bottom, 40)
            }
        }
        .task {
            await viewModel.start()
        }
        .onDisappear {
            viewModel.stop()
        }
    }
}

private struct StatusText: View {
    let state: AgeEstimationState

    var body: some View {
        Group {
            switch state {
            case .searching:
                Text("顔を近づけて\n枠に合わせてください")
            case .aligning(let progress):
                Text(String(format: "そのまま静止… %d%%", Int(progress * 100)))
            case .estimating:
                Text("解析中…")
            case .result:
                Text("推定年齢")
            case .blockedMinor:
                Text("ご利用いただけません")
            }
        }
        .font(.system(size: 22, weight: .medium))
        .foregroundColor(.white)
        .multilineTextAlignment(.center)
        .shadow(radius: 4)
    }
}

private struct BottomBar: View {
    @ObservedObject var viewModel: AgeEstimationViewModel

    var body: some View {
        VStack(spacing: 16) {
            switch viewModel.state {
            case .result(let age, let confidence):
                Text("\(Int(age.rounded()))")
                    .font(.system(size: 96, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                Text("歳")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white.opacity(0.9))
                Text(String(format: "信頼度 %d%%", Int(confidence * 100)))
                    .font(.system(size: 14))
                    .foregroundColor(.white.opacity(0.7))
                retryButton
            case .blockedMinor:
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 56))
                    .foregroundColor(.yellow)
                Text("18 歳未満の可能性があるため、\n結果を表示できません。")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                Text("成人の方はもう一度お試しください")
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.7))
                retryButton
            default:
                EmptyView()
            }
        }
    }

    private var retryButton: some View {
        Button("もう一度") { viewModel.reset() }
            .font(.system(size: 16, weight: .semibold))
            .padding(.horizontal, 32)
            .padding(.vertical, 12)
            .background(Color.white)
            .foregroundColor(.black)
            .clipShape(Capsule())
    }
}

#Preview {
    RootView()
}
