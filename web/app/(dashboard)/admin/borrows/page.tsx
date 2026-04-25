"use client";

import { FileClock, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/library/empty-state";
import { LoadingState } from "@/components/library/loading-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationControls } from "@/components/library/pagination-controls";
import { StatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { borrowsApi, renewalApi } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { BorrowRequest, PaginatedResponse, RenewalRequest } from "@/lib/types";

export default function AdminBorrowsPage() {
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [borrows, setBorrows] = useState<PaginatedResponse<BorrowRequest> | null>(null);
	const [renewals, setRenewals] = useState<RenewalRequest[]>([]);
	const [selectedBorrow, setSelectedBorrow] = useState<BorrowRequest | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [approveNote, setApproveNote] = useState("");
	const [rejectNote, setRejectNote] = useState("");
	const [rejectRequireEdit, setRejectRequireEdit] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			void loadBorrows();
		}, 250);
		return () => clearTimeout(timer);
	}, [page, search, status]);

	useEffect(() => {
		void loadRenewals();
	}, []);

	const loadBorrows = async () => {
		setLoading(true);
		try {
			setBorrows(await borrowsApi.list(page, 10, status, search));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được phiếu mượn");
		} finally {
			setLoading(false);
		}
	};

	const loadRenewals = async () => {
		try {
			setRenewals(await renewalApi.getPending());
		} catch {
			setRenewals([]);
		}
	};

	const openBorrow = async (borrowId: number) => {
		try {
			const borrow = await borrowsApi.get(borrowId);
			setSelectedBorrow(borrow);
			setApproveNote("");
			setRejectNote("");
			setRejectRequireEdit(false);
			setDetailsOpen(true);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được phiếu mượn");
		}
	};

	const approveBorrow = async () => {
		if (!selectedBorrow) return;
		try {
			await borrowsApi.approve(selectedBorrow.id, approveNote);
			toast.success("Đã duyệt phiếu mượn");
			setDetailsOpen(false);
			await loadBorrows();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không duyệt được phiếu");
		}
	};

	const rejectBorrow = async () => {
		if (!selectedBorrow) return;
		if (!rejectNote.trim()) {
			toast.error("Vui lòng nhập lý do");
			return;
		}
		try {
			await borrowsApi.reject(selectedBorrow.id, rejectNote, rejectRequireEdit);
			toast.success(rejectRequireEdit ? "Đã yêu cầu chỉnh sửa phiếu" : "Đã từ chối phiếu");
			setDetailsOpen(false);
			await loadBorrows();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không từ chối được phiếu");
		}
	};

	const returnBorrow = async () => {
		if (!selectedBorrow) return;
		try {
			await borrowsApi.returnBooks(selectedBorrow.id);
			toast.success("Đã xác nhận trả sách");
			setDetailsOpen(false);
			await loadBorrows();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xác nhận được");
		}
	};

	const approveRenewal = async (renewalId: number) => {
		try {
			await renewalApi.approve(renewalId);
			toast.success("Đã duyệt gia hạn");
			await Promise.all([loadRenewals(), loadBorrows()]);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không duyệt được gia hạn");
		}
	};

	const rejectRenewal = async (renewalId: number) => {
		const note = window.prompt("Lý do từ chối gia hạn:", "") || "";
		try {
			await renewalApi.reject(renewalId, note);
			toast.success("Đã từ chối gia hạn");
			await loadRenewals();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không từ chối được gia hạn");
		}
	};

	useEffect(() => {
		void loadBorrows();
	}, []);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Quản lý mượn trả"
				description="Duyệt phiếu mượn, xem chi tiết và xử lý gia hạn."
			/>

			{renewals.length > 0 ? (
				<Card className="rounded-3xl border-amber-200 bg-amber-50/70">
					<CardHeader>
						<CardTitle>Yêu cầu gia hạn chờ duyệt</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>ID</TableHead>
									<TableHead>Phiếu</TableHead>
									<TableHead>Số ngày</TableHead>
									<TableHead>Lý do</TableHead>
									<TableHead>Ngày tạo</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{renewals.map((renewal) => (
									<TableRow key={renewal.id}>
										<TableCell>#{renewal.id}</TableCell>
										<TableCell>#{renewal.request_id}</TableCell>
										<TableCell>{renewal.requested_days} ngày</TableCell>
										<TableCell>{renewal.reason || "-"}</TableCell>
										<TableCell>{formatDateTime(renewal.created_at)}</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button size="sm" onClick={() => void approveRenewal(renewal.id)}>
													Duyệt
												</Button>
												<Button variant="destructive" size="sm" onClick={() => void rejectRenewal(renewal.id)}>
													Từ chối
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			) : null}

			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Bộ lọc</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 md:grid-cols-[1fr_220px]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => {
								setPage(1);
								setSearch(event.target.value);
							}}
							placeholder="Tìm theo tên hoặc email độc giả..."
							className="pl-10"
						/>
					</div>
					<select
						value={status}
						onChange={(event) => {
							setPage(1);
							setStatus(event.target.value);
						}}
						className="h-10 rounded-xl border bg-background px-3 text-sm"
					>
						<option value="">Tất cả trạng thái</option>
						<option value="pending">Chờ duyệt</option>
						<option value="approved">Đã duyệt</option>
						<option value="need_edit">Cần chỉnh sửa</option>
						<option value="rejected">Từ chối</option>
						<option value="returned">Đã trả</option>
					</select>
				</CardContent>
			</Card>

			<Card className="rounded-3xl">
				<CardContent className="pt-6">
					{loading ? (
						<LoadingState label="Đang tải phiếu mượn..." />
					) : !borrows || borrows.items.length === 0 ? (
						<EmptyState
							title="Không có phiếu mượn phù hợp"
							description="Thử thay đổi từ khoá tìm kiếm hoặc bộ lọc trạng thái."
							icon={FileClock}
						/>
					) : (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Độc giả</TableHead>
										<TableHead>Số sách</TableHead>
										<TableHead>Ngày tạo</TableHead>
										<TableHead>Hạn trả</TableHead>
										<TableHead>Trạng thái</TableHead>
										<TableHead className="text-right">Thao tác</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{borrows.items.map((borrow) => (
										<TableRow key={borrow.id}>
											<TableCell>#{borrow.id}</TableCell>
											<TableCell>{borrow.user?.full_name || borrow.user?.username}</TableCell>
											<TableCell>{borrow.items?.length || 0}</TableCell>
											<TableCell>{formatDateTime(borrow.created_at)}</TableCell>
											<TableCell>{formatDate(borrow.due_date)}</TableCell>
											<TableCell>
												<StatusBadge status={borrow.status} />
											</TableCell>
											<TableCell className="text-right">
												<Button variant="outline" size="sm" onClick={() => void openBorrow(borrow.id)}>
													Chi tiết
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
							<PaginationControls
								page={borrows.page}
								totalPages={borrows.total_pages}
								onChange={setPage}
							/>
						</>
					)}
				</CardContent>
			</Card>

			<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
				<DialogContent className="max-w-4xl rounded-3xl">
					<DialogHeader>
						<DialogTitle>
							Chi tiết phiếu mượn {selectedBorrow ? `#${selectedBorrow.id}` : ""}
						</DialogTitle>
						<DialogDescription>
							Xem danh sách sách, ghi chú và xử lý trạng thái phiếu.
						</DialogDescription>
					</DialogHeader>
					{selectedBorrow ? (
						<div className="space-y-5">
							<div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2">
								<div>
									<p className="text-sm text-muted-foreground">Độc giả</p>
									<p className="font-medium">
										{selectedBorrow.user?.full_name || selectedBorrow.user?.username}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Trạng thái</p>
									<StatusBadge status={selectedBorrow.status} />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Ngày tạo</p>
									<p className="font-medium">{formatDateTime(selectedBorrow.created_at)}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Hạn trả</p>
									<p className="font-medium">{formatDate(selectedBorrow.due_date)}</p>
								</div>
							</div>

							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Tên sách</TableHead>
										<TableHead>Tác giả</TableHead>
										<TableHead>SL mượn</TableHead>
										<TableHead>Còn lại</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{selectedBorrow.items.map((item, index) => (
										<TableRow key={`${item.book_id}-${index}`}>
											<TableCell>{item.book?.title || "N/A"}</TableCell>
											<TableCell>{item.book?.author || "-"}</TableCell>
											<TableCell>{item.quantity}</TableCell>
											<TableCell>{item.book?.available_quantity ?? 0}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							<div className="grid gap-4 lg:grid-cols-2">
								<div className="space-y-2">
									<p className="text-sm font-medium">Ghi chú admin khi duyệt</p>
									<Textarea
										value={approveNote}
										onChange={(event) => setApproveNote(event.target.value)}
										rows={4}
										placeholder="Ghi chú cho độc giả..."
									/>
								</div>
								<div className="space-y-2">
									<p className="text-sm font-medium">Lý do từ chối / yêu cầu sửa</p>
									<Textarea
										value={rejectNote}
										onChange={(event) => setRejectNote(event.target.value)}
										rows={4}
										placeholder="Nhập lý do..."
									/>
									<label className="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={rejectRequireEdit}
											onChange={(event) => setRejectRequireEdit(event.target.checked)}
										/>
										Yêu cầu độc giả chỉnh sửa phiếu
									</label>
								</div>
							</div>
						</div>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDetailsOpen(false)}>
							Đóng
						</Button>
						{selectedBorrow?.status === "pending" ? (
							<>
								<Button variant="destructive" onClick={() => void rejectBorrow()}>
									Từ chối
								</Button>
								<Button onClick={() => void approveBorrow()}>Duyệt</Button>
							</>
						) : null}
						{selectedBorrow?.status === "approved" ? (
							<Button onClick={() => void returnBorrow()}>Xác nhận đã trả</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
