import Foundation
import Combine

@MainActor
final class ServerManager: ObservableObject {

    enum Status: Equatable {
        case idle
        case starting
        case running
        case failed(String)
    }

    @Published var status: Status = .idle

    var isServerRunning: Bool { status == .running }

    private var serverProcess: Process?
    private var healthCheckTask: Task<Void, Never>?

    // MARK: - Lifecycle

    /// Ensure a healthy server is available. Safe to call repeatedly (launch,
    /// wake, retry): when our own child process is alive and the server answers
    /// health checks, this is a no-op — it never tears down a healthy server.
    func ensureServerRunning() async {
        if let process = serverProcess, process.isRunning,
           await APIClient.shared.checkServerHealth() {
            status = .running
            return
        }

        // Only the bundled Community server may serve this app. A process already
        // listening on the Community port is never adopted or terminated.
        let previousProcess = serverProcess
        stopServer()
        if let previousProcess {
            for _ in 0..<20 {
                guard previousProcess.isRunning else { break }
                try? await Task.sleep(nanoseconds: 100 * 1_000_000)
            }
        }
        status = .starting
        guard let embedded = findEmbeddedServer() else {
            status = .failed(Strings.serverNotAvailableMessage)
            return
        }
        if await APIClient.shared.checkServerHealth() {
            status = .failed(Strings.serverNotResponding(port: Constants.serverPort))
            return
        }
        launchServer(nodePath: embedded.nodePath, entryPath: embedded.entryPath)
        guard serverProcess != nil else { return }

        // Poll until server responds (up to 15 seconds) with exponential backoff
        let started = await waitForServer(timeout: 15)
        if started {
            status = .running
            startHealthCheckLoop(ownership: .ownedProcess)
        } else {
            status = .failed(Strings.serverNotResponding(port: Constants.serverPort))
        }
    }

    /// Gracefully stop the server process when app quits.
    func stopServer() {
        healthCheckTask?.cancel()
        healthCheckTask = nil

        if let process = serverProcess, process.isRunning {
            process.terminate()
        }
        serverProcess = nil
    }

    /// Retry starting the server (e.g. from a Retry button).
    func retry() async {
        stopServer()
        await ensureServerRunning()
    }

    // MARK: - Find Embedded Server

    private func findEmbeddedServer() -> (nodePath: String, entryPath: String)? {
        guard let resourceURL = Bundle.main.resourceURL else { return nil }

        let nodePath = resourceURL
            .appendingPathComponent("EmbeddedServer/node")
            .path
        let entryPath = resourceURL
            .appendingPathComponent("EmbeddedServer/tokentracker/bin/tracker.js")
            .path

        let fm = FileManager.default
        guard fm.isExecutableFile(atPath: nodePath),
              fm.fileExists(atPath: entryPath) else {
            return nil
        }

        return (nodePath, entryPath)
    }

    // MARK: - Launch Server

    /// Launch using the embedded Node.js binary — no login shell needed.
    private func launchServer(nodePath: String, entryPath: String) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = [entryPath, "serve", "--port", "\(Constants.serverPort)", "--no-sync", "--no-open"]
        process.currentDirectoryURL = FileManager.default.temporaryDirectory
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        var env = ProcessInfo.processInfo.environment
        env["NODE_ENV"] = "production"
        env["HOME"] = NSHomeDirectory()
        env["TOKENTRACKER_APP_SHELL"] = "macos"
        env["TOKENTRACKER_DATA_ROOT"] = Constants.dataRootURL.path
        process.environment = env

        process.terminationHandler = { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if self.status == .running {
                    self.status = .failed(Strings.serverExitedUnexpectedly)
                }
            }
        }

        do {
            try process.run()
            serverProcess = process
        } catch {
            serverProcess = nil
            status = .failed(Strings.embeddedServerLaunchFailed(error.localizedDescription))
        }
    }

    // MARK: - Wait for Server (with exponential backoff)

    private func waitForServer(timeout: TimeInterval) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        var delay: UInt64 = 200 // start at 200ms
        let maxDelay: UInt64 = 2000

        while Date() < deadline {
            guard let process = serverProcess, process.isRunning else { return false }
            let healthy = await APIClient.shared.checkServerHealth()
            if healthy && process.isRunning { return true }
            try? await Task.sleep(nanoseconds: delay * 1_000_000)
            delay = min(delay * 2, maxDelay)
        }
        return false
    }

    // MARK: - Health Check Loop

    private func startHealthCheckLoop(ownership: ServerHealthCheckPolicy.Ownership) {
        healthCheckTask?.cancel()
        let interval = ServerHealthCheckPolicy.interval(for: ownership)
        healthCheckTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                guard !Task.isCancelled, let self else { break }
                let healthy = await APIClient.shared.checkServerHealth()
                if healthy, let process = self.serverProcess, process.isRunning {
                    self.status = .running
                } else {
                    self.status = .failed(Strings.serverBecameUnreachable)
                }
            }
        }
    }
}
