import { React } from "@webpack/common";
import { PLUGIN_VERSION, UPDATE_CHECK_URL, GITHUB_RELEASE_URL } from "../constants";
import { compareVersions } from "../utils/helpers";
import { showUpdateModal } from "./UpdateModal";

export function VersionDisplay() {
    const [updateStatus, setUpdateStatus] = React.useState<string | null>(null);
    const [isChecking, setIsChecking] = React.useState(false);

    const checkForUpdates = React.useCallback(async () => {
        if (!UPDATE_CHECK_URL) {
            setUpdateStatus("No release URL configured");
            return;
        }

        setIsChecking(true);
        setUpdateStatus("Checking...");

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(UPDATE_CHECK_URL, {
                signal: controller.signal,
                headers: { Accept: "application/vnd.github.v3+json" },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                setUpdateStatus("Failed to check");
                setIsChecking(false);
                return;
            }

            const data = await response.json();
            let latestVersion = data.tag_name || data.name || "";
            latestVersion = latestVersion.replace(/^v/i, "").trim();

            if (!latestVersion) {
                setUpdateStatus("No public release feed (local build)");
                setIsChecking(false);
                return;
            }

            const comparison = compareVersions(latestVersion, PLUGIN_VERSION);

            if (comparison > 0) {
                setUpdateStatus(`Update available: v${latestVersion}`);
                setTimeout(() => {
                    showUpdateModal(latestVersion, data.body || "No release notes available.");
                }, 500);
            } else {
                setUpdateStatus("You're up to date!");
            }
        } catch (e) {
            console.warn("[Clonecord] Update check failed:", e);
            setUpdateStatus("Check failed");
        }

        setIsChecking(false);
    }, []);

    const getStatusColor = () => {
        if (!updateStatus) return "var(--text-muted)";
        if (updateStatus.includes("available")) return "#43b581";
        if (updateStatus.includes("up to date")) return "#43b581";
        if (updateStatus.includes("failed") || updateStatus.includes("Failed")) return "#f04747";
        return "var(--text-muted)";
    };

    return (
        <div>
            <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#FFFFFF" }}>Clonecord</div>
                <div
                    style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}
                >
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                        Version:{" "}
                        <span style={{ color: "#FFFFFF", fontWeight: 600 }}>v{PLUGIN_VERSION}</span>
                    </span>
                    {updateStatus && (
                        <span style={{ color: getStatusColor(), fontSize: "14px" }}>
                            • {updateStatus}
                        </span>
                    )}
                </div>
            </div>
            <button
                onClick={checkForUpdates}
                disabled={isChecking}
                style={{
                    background: "var(--brand-experiment, #5865f2)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isChecking ? "not-allowed" : "pointer",
                    opacity: isChecking ? 0.6 : 1,
                }}
            >
                {isChecking ? "Checking..." : "Check for Updates"}
            </button>
            {GITHUB_RELEASE_URL && (
                <div style={{ marginTop: "8px" }}>
                    <a
                        href={GITHUB_RELEASE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--brand-experiment, #5865f2)", fontSize: "13px" }}
                    >
                        View Releases
                    </a>
                </div>
            )}
        </div>
    );
}
