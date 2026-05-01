import SwiftUI

struct OvalFrameOverlay: View {
    let state: AgeEstimationState

    var body: some View {
        GeometryReader { geo in
            let rect = Self.ovalRect(in: geo.size)
            ZStack {
                // dim outside oval
                Path { p in
                    p.addRect(CGRect(origin: .zero, size: geo.size))
                    p.addEllipse(in: rect)
                }
                .fill(Color.black.opacity(0.35), style: FillStyle(eoFill: true))

                Ellipse()
                    .stroke(borderColor, lineWidth: 4)
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)

                // dashed center line
                Path { p in
                    p.move(to: CGPoint(x: rect.midX, y: rect.minY + 20))
                    p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY - 20))
                }
                .stroke(Color.white.opacity(0.7),
                        style: StrokeStyle(lineWidth: 1.5, dash: [6, 6]))
            }
        }
        .allowsHitTesting(false)
    }

    private var borderColor: Color {
        switch state {
        case .searching: return Color(red: 0.92, green: 0.86, blue: 0.5)
        case .aligning: return Color(red: 1.0, green: 0.85, blue: 0.3)
        case .estimating: return Color.white
        case .result: return Color.green
        case .blockedMinor: return Color.red.opacity(0.85)
        }
    }

    static func ovalRect(in size: CGSize) -> CGRect {
        let w = size.width * 0.62
        let h = w * 1.35
        let x = (size.width - w) / 2
        let y = (size.height - h) / 2
        return CGRect(x: x, y: y, width: w, height: h)
    }
}
