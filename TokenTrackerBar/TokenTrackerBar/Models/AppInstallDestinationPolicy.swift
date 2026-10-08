import Foundation

/// Chooses where the updater replaces an installed app while keeping the
/// visible bundle name separate from the bundle's long-lived identifier.
enum AppInstallDestinationPolicy {
    enum ResolutionError: Error, Equatable {
        case existingDestinationHasDifferentIdentity
    }

    static func resolve(
        in applicationsDirectory: URL,
        newBundleName: String,
        legacyBundleName: String,
        expectedBundleIdentifier: String,
        fileManager: FileManager = .default
    ) throws -> URL {
        let newDestination = applicationsDirectory.appendingPathComponent(newBundleName, isDirectory: true)
        if hasFileSystemEntry(at: newDestination, fileManager: fileManager) {
            guard isOwnedApplicationBundle(
                at: newDestination,
                expectedBundleIdentifier: expectedBundleIdentifier,
                fileManager: fileManager
            ) else {
                throw ResolutionError.existingDestinationHasDifferentIdentity
            }
            return newDestination
        }

        let legacyDestination = applicationsDirectory.appendingPathComponent(legacyBundleName, isDirectory: true)
        if isOwnedApplicationBundle(
            at: legacyDestination,
            expectedBundleIdentifier: expectedBundleIdentifier,
            fileManager: fileManager
        ) {
            return legacyDestination
        }

        return newDestination
    }

    private static func isOwnedApplicationBundle(
        at url: URL,
        expectedBundleIdentifier: String,
        fileManager: FileManager
    ) -> Bool {
        guard hasFileSystemEntry(at: url, fileManager: fileManager),
              let values = try? url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]),
              values.isDirectory == true,
              values.isSymbolicLink != true,
              Bundle(url: url)?.bundleIdentifier == expectedBundleIdentifier else {
            return false
        }
        return true
    }

    private static func hasFileSystemEntry(at url: URL, fileManager: FileManager) -> Bool {
        if fileManager.fileExists(atPath: url.path) {
            return true
        }
        return (try? fileManager.destinationOfSymbolicLink(atPath: url.path)) != nil
    }
}
