// swift-tools-version:5.9
import PackageDescription

// Splits a small "core" of pure-Swift logic (no AVFoundation / Vision / CoreML
// / SwiftUI) out of the iOS app so it can be unit-tested with `swift test`
// from a Mac, without spinning up the iOS Simulator.
//
// The same files are *also* compiled into the iOS app via the XcodeGen
// project (project.yml). They live in their original locations under
// AgeEstimator/{ML,Camera}/; this package just lists the platform-agnostic
// subset.

let package = Package(
    name: "AgeEstimatorCore",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
    ],
    products: [
        .library(name: "AgeEstimatorCore", targets: ["AgeEstimatorCore"]),
    ],
    targets: [
        .target(
            name: "AgeEstimatorCore",
            path: "AgeEstimator",
            exclude: [
                "AgeEstimatorApp.swift",
                "AgeEstimationViewModel.swift",
                "Camera/CameraManager.swift",
                "Camera/FaceDetector.swift",
                "ML/AgeEstimator.swift",
                "Resources",
                "Views",
            ],
            sources: [
                "Camera/FaceDetection.swift",
                "Camera/FrameAlignment.swift",
                "Camera/LivenessDetector.swift",
                "ML/AgePrediction.swift",
                "ML/DatasetInfo.swift",
                "ML/JapaneseCalibration.swift",
                "ML/ScreeningPolicy.swift",
            ]
        ),
        .testTarget(
            name: "AgeEstimatorCoreTests",
            dependencies: ["AgeEstimatorCore"],
            path: "Tests/AgeEstimatorCoreTests"
        ),
    ]
)
