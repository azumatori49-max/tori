#if DEBUG
import SwiftUI

/// Manual test harness for the iOS Simulator. The Simulator has no camera,
/// so the real pipeline is dormant. This view exposes the underlying
/// `state` of the view model and lets you cycle through every UI screen
/// to eyeball layout, copy and colours without a physical device.
///
/// To activate, launch the app with the `-SimulatorHarness 1` argument
/// (Xcode -> Edit Scheme -> Arguments -> Arguments Passed On Launch).
/// Or set `forceEnable: true` while iterating in SwiftUI previews.
struct SimulatorHarness: View {
    @ObservedObject var viewModel: AgeEstimationViewModel

    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: "SimulatorHarness")
    }

    private static let scenarios: [(label: String, state: AgeEstimationState)] = [
        ("searching",        .searching),
        ("multipleFaces",    .multipleFaces),
        ("aligning 40%",     .aligning(progress: 0.4)),
        ("aligning 90%",     .aligning(progress: 0.9)),
        ("livenessRequired", .livenessRequired),
        ("estimating",       .estimating),
        ("cleared 32",       .cleared(age: 32, confidence: 0.82)),
        ("idCheck 22",       .idCheckRequired(age: 22, confidence: 0.71)),
        ("blocked",          .blockedMinor),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Simulator Harness")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
            ForEach(Self.scenarios.indices, id: \.self) { i in
                let s = Self.scenarios[i]
                Button(s.label) { viewModel.simulate(state: s.state) }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.black)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.9))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
        .padding(8)
        .background(Color.black.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
#endif
