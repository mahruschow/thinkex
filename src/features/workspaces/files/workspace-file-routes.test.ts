import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionFromRequest = vi.hoisted(() => vi.fn());
const readWorkspaceFilePreview = vi.hoisted(() => vi.fn());
const readWorkspaceFileSource = vi.hoisted(() => vi.fn());
const recordOperationalFailure = vi.hoisted(() => vi.fn());

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("#/lib/auth-queries.server", () => ({ getSessionFromRequest }));
vi.mock("#/features/workspaces/persistence/workspace-files", () => ({
	readWorkspaceFilePreview,
	readWorkspaceFileSource,
}));
vi.mock("#/integrations/observability/operational-events", () => ({
	recordOperationalFailure,
}));
vi.mock("#/integrations/posthog/server-context", () => ({
	getTelemetryRequestDetails: () => ({}),
}));

import { WorkspaceItemNotFoundError } from "#/features/workspaces/persistence/workspace-postgres-support";
import { handleWorkspaceFileContent } from "#/routes/api/v1/workspaces.$workspaceId.files.$itemId.content";
import { handleWorkspaceFilePreview } from "#/routes/api/v1/workspaces.$workspaceId.files.$itemId.preview";

beforeEach(() => {
	getSessionFromRequest.mockReset();
	readWorkspaceFilePreview.mockReset();
	readWorkspaceFileSource.mockReset();
	recordOperationalFailure.mockReset();
	getSessionFromRequest.mockResolvedValue({ user: { id: "user_1" } });
});

describe("workspace file routes with a missing item", () => {
	it("returns 404 and records no failure when the preview item is missing", async () => {
		readWorkspaceFilePreview.mockRejectedValue(new WorkspaceItemNotFoundError());

		const response = await handleWorkspaceFilePreview(
			new Request("https://thinkex.app/api/v1/workspaces/ws_1/files/item_1/preview"),
			"ws_1",
			"item_1",
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ code: "PREVIEW_NOT_FOUND" });
		expect(recordOperationalFailure).not.toHaveBeenCalled();
	});

	it("returns 404 and records no failure when the content item is missing", async () => {
		readWorkspaceFileSource.mockRejectedValue(new WorkspaceItemNotFoundError());

		const response = await handleWorkspaceFileContent(
			new Request("https://thinkex.app/api/v1/workspaces/ws_1/files/item_1/content"),
			"ws_1",
			"item_1",
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ code: "FILE_NOT_FOUND" });
		expect(recordOperationalFailure).not.toHaveBeenCalled();
	});

	it("returns 500 and records a failure for an unexpected error", async () => {
		readWorkspaceFilePreview.mockRejectedValue(new Error("storage is down"));

		const response = await handleWorkspaceFilePreview(
			new Request("https://thinkex.app/api/v1/workspaces/ws_1/files/item_1/preview"),
			"ws_1",
			"item_1",
		);

		expect(response.status).toBe(500);
		expect(recordOperationalFailure).toHaveBeenCalledTimes(1);
	});
});
