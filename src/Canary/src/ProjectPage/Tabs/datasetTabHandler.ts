import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthTokenFromCookie } from "../../utils/cookieUtils";

export interface Batch {
	batchID: string;
	batchName: string;
	projectID: string;
	numberOfTotalFiles: number;
	numberOfAnnotatedFiles: number;
	lastUpdated?: string | { seconds: number; nanos?: number } | number | Date;
}

function projectServiceUrl() {
	return import.meta.env.VITE_PROJECT_SERVICE_URL as string;
}

async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
	const token = getAuthTokenFromCookie();
	const headers: HeadersInit = {
		Accept: "application/json",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...(init?.headers || {}),
	};
	const resp = await fetch(input, { ...init, headers });
	const text = await resp.text();
	if (!resp.ok) {
		throw new Error(text || `${resp.status} ${resp.statusText}`);
	}
	try {
		return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
	} catch {
		// for DELETE/empty bodies
		return undefined as unknown as T;
	}
}

export async function fetchBatches(projectID: string): Promise<Batch[]> {
	const url = `${projectServiceUrl()}/projects/${projectID}/batches`;
	return apiFetch<Batch[]>(url);
}

export async function renameBatch(batchID: string, newBatchName: string): Promise<void> {
	const url = `${projectServiceUrl()}/batch/${batchID}`;
	await apiFetch<void>(url, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ newBatchName }),
	});
}

export async function deleteBatch(batchID: string): Promise<void> {
	const url = `${projectServiceUrl()}/batch/${batchID}`;
	await apiFetch<void>(url, { method: "DELETE" });
}

export function formatDateOnly(value?: Batch["lastUpdated"]): string {
	if (!value) return "";
	let date: Date;
	if (value instanceof Date) date = value;
	else if (typeof value === "number") date = new Date(value);
	else if (typeof value === "string") date = new Date(value);
	else if (typeof value === "object" && "seconds" in value) {
		date = new Date((value.seconds as number) * 1000);
	} else {
		return "";
	}
	return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function useDatasetTab(projectID?: string) {
	const [batches, setBatches] = useState<Batch[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// menu state
	const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
	const [menuBatchId, setMenuBatchId] = useState<string | null>(null);

	// rename state
	const [renameOpen, setRenameOpen] = useState(false);
	const [renameValue, setRenameValue] = useState("");
	const [renaming, setRenaming] = useState(false);

	// delete state
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const selectedBatch = useMemo(
		() => batches.find((b) => b.batchID === menuBatchId) || null,
		[batches, menuBatchId],
	);

	const load = useCallback(async () => {
		if (!projectID) return;
		setLoading(true);
		setError(null);
		try {
			const data = await fetchBatches(projectID);
			setBatches(data || []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load batches");
		} finally {
			setLoading(false);
		}
	}, [projectID]);

	useEffect(() => {
		load();
	}, [load]);

	// menu handlers
	const openMenu = useCallback((evt: React.MouseEvent<HTMLElement>, batchID: string) => {
		evt.stopPropagation();
		setMenuAnchorEl(evt.currentTarget);
		setMenuBatchId(batchID);
	}, []);

	const closeMenu = useCallback(() => {
		setMenuAnchorEl(null);
		setMenuBatchId(null);
	}, []);

	// Finish action (no-op for now)
	const handleFinish = useCallback(() => {
		closeMenu();
	}, [closeMenu]);

	// rename flow
	const openRename = useCallback(() => {
		if (!selectedBatch) return;
		setRenameValue(selectedBatch.batchName);
		setRenameOpen(true);
		setMenuAnchorEl(null);
	}, [selectedBatch]);

		const closeRename = useCallback(() => {
			setRenameOpen(false);
		}, []);

	const submitRename = useCallback(async () => {
		if (!menuBatchId) return;
		setRenaming(true);
		try {
			await renameBatch(menuBatchId, renameValue.trim());
			setBatches((prev) => prev.map((b) => (b.batchID === menuBatchId ? { ...b, batchName: renameValue.trim() } : b)));
			setRenameOpen(false);
			setMenuBatchId(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to rename batch");
		} finally {
			setRenaming(false);
		}
	}, [menuBatchId, renameValue]);

	// delete flow
	const openDelete = useCallback(() => {
		setDeleteOpen(true);
		setMenuAnchorEl(null);
	}, []);

		const closeDelete = useCallback(() => {
			setDeleteOpen(false);
		}, []);

	const confirmDelete = useCallback(async () => {
		if (!menuBatchId) return;
		setDeleting(true);
		try {
			await deleteBatch(menuBatchId);
			setBatches((prev) => prev.filter((b) => b.batchID !== menuBatchId));
			setDeleteOpen(false);
			setMenuBatchId(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to delete batch");
		} finally {
			setDeleting(false);
		}
	}, [menuBatchId]);

	return {
		// data
		batches,
		loading,
		error,
		// menu
		menuAnchorEl,
		menuBatchId,
		openMenu,
		closeMenu,
		handleFinish,
		// rename
		renameOpen,
		renameValue,
		setRenameValue,
		openRename,
		closeRename,
		submitRename,
		renaming,
		// delete
		deleteOpen,
		openDelete,
		closeDelete,
		confirmDelete,
		deleting,
		// utils
		formatDateOnly,
		reload: load,
	};
}

