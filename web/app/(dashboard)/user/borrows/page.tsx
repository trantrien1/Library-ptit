"use client";

import { BookCheck, FileClock } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { booksApi, borrowsApi, renewalApi } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { BorrowItem, BorrowRequest, PaginatedResponse } from "@/lib/types";

export default function UserBorrowsPage() {
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState("");
	const [daysAhead, setDaysAhead] = useState(3);
	const [borrows, setBorrows] = useState<PaginatedResponse<BorrowRequest> | null>(null);
	const [selectedBorrow, setSelectedBorrow] = useState<BorrowRequest | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [renewalOpen, setRenewalOpen] = useState(false);
	const [editItems, setEditItems] = useState<BorrowItem[]>([]);
	const [editDueDate, setEditDueDate] = useState("");
	const [editNote, setEditNote] = useState("");
	const [renewalDays, setRenewalDays] = useState("7");
	const [renewalReason, setRenewalReason] = useState("");
	const [reviewBookId, setReviewBookId] = useState("");
	const [reviewRating, setReviewRating] = useState(0);
	const [reviewComment, setReviewComment] = useState("");
	const [reminderMessages, setReminderMessages] = useState<string[]>([]);

	useEffect(() => {
		void loadBorrows();
	}, [page, status]);

	useEffect(() => {
		void loadReminders();
	}, [daysAhead]);

	const loadBorrows = async () => {
		setLoading(true);
		try {
			setBorrows(await borrowsApi.list(page, 10, status));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được phiếu mượn");
		} finally {
			setLoading(false);
		}
	};

	const loadReminders = async () => {
		try {
			const data = await borrowsApi.reminders(daysAhead, 6);
			setReminderMessages(data.items.map((item) => item.message));
		} catch {
			setReminderMessages([]);
		}
	};

	const openBorrow = async (borrowId: number) => {
		try {
			const borrow = await borrowsApi.get(borrowId);
			setSelectedBorrow(borrow);
			setDetailsOpen(true);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được chi tiết phiếu");
		}
	};

	const openEdit = () => {
		if (!selectedBorrow) return;
		setEditItems(selectedBorrow.items.map((item) => ({ ...item })));
		setEditDueDate(selectedBorrow.due_date || "");
		setEditNote(selectedBorrow.note || "");
		setDetailsOpen(false);
		setEditOpen(true);
	};

	const saveEdit = async () => {
		if (!selectedBorrow) return;
		try {
			await borrowsApi.update(
				selectedBorrow.id,
				editNote,
				editItems.map((item) => ({ book_id: item.book_id, quantity: item.quantity })),
				editDueDate,
			);
			toast.success("Đã cập nhật phiếu mượn");
			setEditOpen(false);
			await loadBorrows();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được phiếu");
		}
	};

	const cancelBorrow = async () => {
		if (!selectedBorrow) return;
		if (!window.confirm("Bạn có chắc muốn huỷ phiếu này?")) return;
		try {
			await borrowsApi.remove(selectedBorrow.id);
			toast.success("Đã huỷ phiếu mượn");
			setDetailsOpen(false);
			await loadBorrows();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không huỷ được phiếu");
		}
	};

	const submitRenewal = async () => {
		if (!selectedBorrow) return;
		try {
			await renewalApi.requestRenewal(selectedBorrow.id, Number(renewalDays), renewalReason);
			toast.success("Đã gửi yêu cầu gia hạn");
			setRenewalOpen(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không gia hạn được");
		}
	};

	const submitReview = async () => {
		if (!reviewBookId || reviewRating < 1) {
			toast.error("Vui lòng chọn sách và số sao");
			return;
		}
		try {
			await booksApi.saveReview(Number(reviewBookId), reviewRating, reviewComment);
			toast.success("Đã lưu đánh giá");
			setReviewBookId("");
			setReviewRating(0);
			setReviewComment("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được đánh giá");
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Phiếu mượn"
				description="Theo dõi trạng thái, gia hạn hoặc chỉnh sửa phiếu mượn."
			/>

			<Card className="rounded-3xl">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Lời nhắc</CardTitle>
					<select
						value={daysAhead}
						onChange={(event) => setDaysAhead(Number(event.target.value))}
						className="h-9 rounded-xl border bg-background px-3 text-sm"
					>
						<option value={1}>1 ngày</option>
						<option value={3}>3 ngày</option>
						<option value={7}>7 ngày</option>
					</select>
				</CardHeader>
				<CardContent className="space-y-3">
					{reminderMessages.length === 0 ? (
						<p className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
							Không có lời nhắc nào trong giai đoạn này.
						</p>
					) : (
						reminderMessages.map((message) => (
							<div key={message} className="rounded-2xl border bg-muted/40 p-4 text-sm">
								{message}
							</div>
						))
					)}
				</CardContent>
			</Card>

			<Card className="rounded-3xl">
				<CardContent className="space-y-4 pt-6">
					<div className="max-w-xs">
						<select
							value={status}
							onChange={(event) => {
								setPage(1);
								setStatus(event.target.value);
							}}
							className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
						>
							<option value="">Tất cả trạng thái</option>
							<option value="pending">Chờ duyệt</option>
							<option value="approved">Đã duyệt</option>
							<option value="need_edit">Cần chỉnh sửa</option>
							<option value="rejected">Từ chối</option>
							<option value="returned">Đã trả</option>
						</select>
					</div>

					{loading ? (
						<LoadingState label="Đang tải phiếu mượn..." />
					) : !borrows || borrows.items.length === 0 ? (
						<EmptyState
							title="Chưa có phiếu mượn"
							description="Sau khi tạo phiếu từ giỏ mượn, bạn sẽ thấy chúng ở đây."
							icon={FileClock}
						/>
					) : (
						<>
							<div className="space-y-4">
								{borrows.items.map((borrow) => (
									<Card key={borrow.id} className="rounded-3xl">
										<CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
											<div>
												<p className="text-lg font-semibold">Phiếu #{borrow.id}</p>
												<p className="text-sm text-muted-foreground">
													{formatDateTime(borrow.created_at)} • {borrow.items.length} sách • Hạn trả {formatDate(borrow.due_date)}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<StatusBadge status={borrow.status} />
												<Button variant="outline" onClick={() => void openBorrow(borrow.id)}>
													Chi tiết
												</Button>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
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
							Phiếu mượn {selectedBorrow ? `#${selectedBorrow.id}` : ""}
						</DialogTitle>
						<DialogDescription>
							Trạng thái hiện tại, sách đã mượn và các thao tác khả dụng.
						</DialogDescription>
					</DialogHeader>
					{selectedBorrow ? (
						<div className="space-y-4">
							<div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2">
								<div>
									<p className="text-sm text-muted-foreground">Ngày tạo</p>
									<p className="font-medium">{formatDateTime(selectedBorrow.created_at)}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Hạn trả</p>
									<p className="font-medium">{formatDate(selectedBorrow.due_date)}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Trạng thái</p>
									<StatusBadge status={selectedBorrow.status} />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Số lần gia hạn</p>
									<p className="font-medium">{selectedBorrow.renewal_count || 0}</p>
								</div>
							</div>

							<div className="rounded-2xl border bg-card p-4">
								<p className="font-medium">Ghi chú của bạn</p>
								<p className="mt-2 text-sm text-muted-foreground">
									{selectedBorrow.note || "Không có ghi chú"}
								</p>
							</div>

							{selectedBorrow.admin_note ? (
								<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
									<p className="font-medium text-amber-900">Ghi chú từ thủ thư</p>
									<p className="mt-2 text-sm text-amber-800">{selectedBorrow.admin_note}</p>
								</div>
							) : null}

							<div className="space-y-3">
								{selectedBorrow.items.map((item, index) => (
									<div key={`${item.book_id}-${index}`} className="rounded-2xl border bg-card p-4">
										<p className="font-medium">{item.book?.title || "N/A"}</p>
										<p className="text-sm text-muted-foreground">
											Số lượng: {item.quantity}
										</p>
									</div>
								))}
							</div>
						</div>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDetailsOpen(false)}>
							Đóng
						</Button>
						{selectedBorrow?.status === "need_edit" ? (
							<Button variant="secondary" onClick={openEdit}>
								Chỉnh sửa phiếu
							</Button>
						) : null}
						{selectedBorrow && ["pending", "need_edit", "rejected"].includes(selectedBorrow.status) ? (
							<Button variant="destructive" onClick={() => void cancelBorrow()}>
								Huỷ phiếu
							</Button>
						) : null}
						{selectedBorrow?.status === "approved" ? (
							<Button onClick={() => {
								setRenewalOpen(true);
								setDetailsOpen(false);
							}}>
								Gia hạn
							</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className="max-w-3xl rounded-3xl">
					<DialogHeader>
						<DialogTitle>Chỉnh sửa phiếu mượn</DialogTitle>
						<DialogDescription>
							Điều chỉnh ngày trả, ghi chú và số lượng từng sách.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<Input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} />
						<Textarea value={editNote} onChange={(event) => setEditNote(event.target.value)} rows={3} />
						<div className="space-y-3">
							{editItems.map((item, index) => (
								<div key={`${item.book_id}-${index}`} className="flex items-center justify-between rounded-2xl border p-4">
									<div>
										<p className="font-medium">{item.book?.title || "N/A"}</p>
										<p className="text-sm text-muted-foreground">
											Còn {item.book?.available_quantity ?? 0} cuốn
										</p>
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="icon"
											onClick={() =>
												setEditItems((current) =>
													current
														.map((entry, entryIndex) =>
															entryIndex === index
																? { ...entry, quantity: Math.max(1, entry.quantity - 1) }
																: entry,
														)
												)
											}
										>
											-
										</Button>
										<span className="w-10 text-center">{item.quantity}</span>
										<Button
											variant="outline"
											size="icon"
											onClick={() =>
												setEditItems((current) =>
													current.map((entry, entryIndex) =>
														entryIndex === index
															? { ...entry, quantity: entry.quantity + 1 }
															: entry,
													)
												)
											}
										>
											+
										</Button>
									</div>
								</div>
							))}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditOpen(false)}>
							Huỷ
						</Button>
						<Button onClick={() => void saveEdit()}>Lưu thay đổi</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={renewalOpen} onOpenChange={setRenewalOpen}>
				<DialogContent className="rounded-3xl">
					<DialogHeader>
						<DialogTitle>Gia hạn phiếu mượn</DialogTitle>
						<DialogDescription>Gửi yêu cầu gia hạn để thủ thư xem xét.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<select
							value={renewalDays}
							onChange={(event) => setRenewalDays(event.target.value)}
							className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
						>
							<option value="7">7 ngày</option>
							<option value="14">14 ngày</option>
							<option value="30">30 ngày</option>
						</select>
						<Textarea
							value={renewalReason}
							onChange={(event) => setRenewalReason(event.target.value)}
							rows={4}
							placeholder="Nêu lý do muốn gia hạn..."
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRenewalOpen(false)}>
							Huỷ
						</Button>
						<Button onClick={() => void submitRenewal()}>Gửi yêu cầu</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Đánh giá sách đã trả</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 lg:grid-cols-[1fr_120px]">
					<select
						value={reviewBookId}
						onChange={(event) => setReviewBookId(event.target.value)}
						className="h-10 rounded-xl border bg-background px-3 text-sm"
					>
						<option value="">Chọn sách đã mượn để đánh giá</option>
						{borrows?.items
							.filter((borrow) => borrow.status === "returned")
							.flatMap((borrow) => borrow.items)
							.map((item) => (
								<option key={`${item.book_id}-${item.book?.title}`} value={item.book_id}>
									{item.book?.title}
								</option>
							))}
					</select>
					<div className="flex items-center gap-2">
						{[1, 2, 3, 4, 5].map((value) => (
							<button key={value} type="button" onClick={() => setReviewRating(value)}>
								<span className={value <= reviewRating ? "text-amber-500" : "text-muted-foreground"}>★</span>
							</button>
						))}
					</div>
					<Textarea
						value={reviewComment}
						onChange={(event) => setReviewComment(event.target.value)}
						rows={3}
						placeholder="Chia sẻ cảm nhận của bạn về cuốn sách..."
						className="lg:col-span-2"
					/>
					<div className="lg:col-span-2">
						<Button onClick={() => void submitReview()}>
							<BookCheck className="mr-2 h-4 w-4" />
							Gửi đánh giá
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
