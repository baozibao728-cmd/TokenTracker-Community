import Foundation
import XCTest

final class AppInstallDestinationPolicyTests: XCTestCase {
    private let bundleIdentifier = "com.tokentracker.community"

    private func makeApplicationsDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("AppInstallDestinationPolicyTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func makeAppBundle(at url: URL, bundleIdentifier: String) throws {
        let contents = url.appendingPathComponent("Contents", isDirectory: true)
        try FileManager.default.createDirectory(at: contents, withIntermediateDirectories: true)
        let info: [String: Any] = [
            "CFBundleIdentifier": bundleIdentifier,
            "CFBundleName": url.deletingPathExtension().lastPathComponent,
            "CFBundlePackageType": "APPL",
        ]
        let data = try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        try data.write(to: contents.appendingPathComponent("Info.plist"))
    }

    private func resolve(in directory: URL) throws -> URL {
        try AppInstallDestinationPolicy.resolve(
            in: directory,
            newBundleName: "TokenOrbit.app",
            legacyBundleName: "TokenTracker Community.app",
            expectedBundleIdentifier: bundleIdentifier
        )
    }

    func testOwnedLegacyBundleKeepsItsExistingInstallPathForUpgrade() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let legacy = directory.appendingPathComponent("TokenTracker Community.app", isDirectory: true)
        try makeAppBundle(at: legacy, bundleIdentifier: bundleIdentifier)

        XCTAssertEqual(try resolve(in: directory), legacy)
    }

    func testFreshInstallUsesTokenOrbitPath() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        XCTAssertEqual(
            try resolve(in: directory),
            directory.appendingPathComponent("TokenOrbit.app", isDirectory: true)
        )
    }

    func testForeignLegacyBundleIsPreservedAndNewPathIsSelected() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let legacy = directory.appendingPathComponent("TokenTracker Community.app", isDirectory: true)
        try makeAppBundle(at: legacy, bundleIdentifier: "example.foreign.app")

        XCTAssertEqual(try resolve(in: directory).lastPathComponent, "TokenOrbit.app")
        XCTAssertTrue(FileManager.default.fileExists(atPath: legacy.path))
        XCTAssertEqual(Bundle(url: legacy)?.bundleIdentifier, "example.foreign.app")
    }

    func testLegacySymlinkIsPreservedAndNewPathIsSelected() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let target = directory.appendingPathComponent("OwnedTarget.app", isDirectory: true)
        let legacy = directory.appendingPathComponent("TokenTracker Community.app", isDirectory: true)
        try makeAppBundle(at: target, bundleIdentifier: bundleIdentifier)
        try FileManager.default.createSymbolicLink(at: legacy, withDestinationURL: target)

        XCTAssertEqual(try resolve(in: directory).lastPathComponent, "TokenOrbit.app")
        XCTAssertTrue(FileManager.default.fileExists(atPath: legacy.path))
        XCTAssertTrue(try legacy.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink == true)
    }

    func testBrokenLegacySymlinkIsPreservedAndNewPathIsSelected() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let legacy = directory.appendingPathComponent("TokenTracker Community.app", isDirectory: true)
        let missingTarget = directory.appendingPathComponent("Missing.app", isDirectory: true)
        try FileManager.default.createSymbolicLink(at: legacy, withDestinationURL: missingTarget)

        XCTAssertEqual(try resolve(in: directory).lastPathComponent, "TokenOrbit.app")
        XCTAssertNoThrow(try FileManager.default.destinationOfSymbolicLink(atPath: legacy.path))
    }

    func testOwnedTokenOrbitBundleTakesPrecedenceAndUpdatesNormally() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let current = directory.appendingPathComponent("TokenOrbit.app", isDirectory: true)
        let legacy = directory.appendingPathComponent("TokenTracker Community.app", isDirectory: true)
        try makeAppBundle(at: current, bundleIdentifier: bundleIdentifier)
        try makeAppBundle(at: legacy, bundleIdentifier: bundleIdentifier)

        XCTAssertEqual(try resolve(in: directory), current)
    }

    func testForeignTokenOrbitDestinationIsRejectedWithoutReplacingIt() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let current = directory.appendingPathComponent("TokenOrbit.app", isDirectory: true)
        try makeAppBundle(at: current, bundleIdentifier: "example.foreign.app")

        XCTAssertThrowsError(try resolve(in: directory)) { error in
            XCTAssertEqual(
                error as? AppInstallDestinationPolicy.ResolutionError,
                .existingDestinationHasDifferentIdentity
            )
        }
        XCTAssertEqual(Bundle(url: current)?.bundleIdentifier, "example.foreign.app")
    }

    func testTokenOrbitSymlinkDestinationIsRejectedAndPreserved() throws {
        let directory = try makeApplicationsDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let target = directory.appendingPathComponent("OwnedTarget.app", isDirectory: true)
        let current = directory.appendingPathComponent("TokenOrbit.app", isDirectory: true)
        try makeAppBundle(at: target, bundleIdentifier: bundleIdentifier)
        try FileManager.default.createSymbolicLink(at: current, withDestinationURL: target)

        XCTAssertThrowsError(try resolve(in: directory)) { error in
            XCTAssertEqual(
                error as? AppInstallDestinationPolicy.ResolutionError,
                .existingDestinationHasDifferentIdentity
            )
        }
        XCTAssertTrue(try current.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink == true)
        XCTAssertEqual(Bundle(url: target)?.bundleIdentifier, bundleIdentifier)
    }
}
