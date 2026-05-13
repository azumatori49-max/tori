import SwiftUI

struct KioskView: View {
    @StateObject private var viewModel = KioskViewModel()

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                CameraPreviewView(session: viewModel.camera.session)
                    .ignoresSafeArea()

                FaceBoxOverlay(rect: viewModel.faceBox, size: proxy.size)

                VStack {
                    HeaderBar()
                    Spacer()
                    StateCard(state: viewModel.state)
                        .padding(.horizontal, 24)
                        .padding(.bottom, 48)
                }
            }
            .task { await viewModel.bootstrap() }
            .onTapGesture(count: 3) {
                viewModel.resetToWaiting()
            }
        }
    }
}

private struct HeaderBar: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("年齢推定")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                Text("カメラを正面から見てください")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.7))
            }
            Spacer()
            Image(systemName: "lock.shield")
                .foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 24)
        .padding(.top, 24)
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
            ctx.stroke(path, with: .color(.white.opacity(0.9)), lineWidth: 3)
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
                    systemImage: "person.crop.circle.dashed"
                )
            case .scanning(let progress):
                ScanningCard(progress: progress)
            case .result(let age):
                ResultCard(age: age)
            case .noPermission:
                MessageCard(
                    title: "カメラ許可が必要です",
                    subtitle: "設定 → AgeKiosk → カメラ をオンにしてください",
                    systemImage: "exclamationmark.triangle.fill"
                )
            case .noModel:
                MessageCard(
                    title: "モデル未搭載",
                    subtitle: "AgeNet.mlmodel をプロジェクトに追加してください",
                    systemImage: "questionmark.app.dashed"
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

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.system(size: 36))
                .foregroundStyle(.white.opacity(0.9))
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
                Text("解析中...")
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

private struct ResultCard: View {
    let age: Int

    var body: some View {
        VStack(spacing: 8) {
            Text("推定年齢")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white.opacity(0.7))
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text("\(age)")
                    .font(.system(size: 96, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("歳")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.9))
            }
            Text("※ 日本人向けに補正済みの参考値です")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    KioskView()
}
