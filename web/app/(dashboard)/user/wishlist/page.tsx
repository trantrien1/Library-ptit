"use client";

import { ShoppingBasket, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/library/empty-state";
import { LoadingState } from "@/components/library/loading-state";
import { PageHeader } from "@/components/library/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { borrowsApi, wishlistApi } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/format";
import type { WishlistItem } from "@/lib/types";

export default function UserWishlistPage() {
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState<WishlistItem[]>([]);
	const [dueDate, setDueDate] = useState("");
	const [note, setNote] = useState("");

	const insufficient = useMemo(
		() => items.filter((item) => (item.book?.available_quantity || 0) < item.quantity),
		[items],
	);

	const loadWishlist = async () => {
		setLoading(true);
		try {
			const data = await wishlistApi.get();
			setItems(data.items);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được giỏ mượn");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadWishlist();
	}, []);

	const updateQuantity = async (bookId: number, quantity: number) => {
		try {
			if (quantity <= 0) {
				await wishlistApi.remove(bookId);
			} else {
				await wishlistApi.update(bookId, quantity);
			}
			await loadWishlist();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không cập nhật được số lượng");
		}
	};

	const clearWishlist = async () => {
		if (!window.confirm("Bạn có chắc muốn xoá toàn bộ giỏ mượn?")) return;
		try {
			await wishlistApi.clear();
			toast.success("Đã xoá toàn bộ giỏ mượn");
			await loadWishlist();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xoá được giỏ mượn");
		}
	};

	const createBorrow = async () => {
		if (!dueDate) {
			toast.error("Vui lòng chọn ngày trả sách");
			return;
		}
		if (insufficient.length > 0) {
			toast.error("Có sách không đủ số lượng để tạo phiếu mượn");
			return;
		}
		try {
			await borrowsApi.create(note, undefined, dueDate);
			toast.success("Đã tạo phiếu mượn");
			setNote("");
			await loadWishlist();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tạo được phiếu mượn");
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Giỏ mượn"
				description="Rà soát số lượng sách và tạo phiếu mượn gửi thủ thư."
				actions={
					items.length > 0 ? (
						<Button variant="destructive" onClick={() => void clearWishlist()}>
							<Trash2 className="mr-2 h-4 w-4" />
							Xoá tất cả
						</Button>
					) : null
				}
			/>

			<Card className="rounded-3xl">
				<CardContent className="space-y-4 pt-6">
					{loading ? (
						<LoadingState label="Đang tải giỏ mượn..." />
					) : items.length === 0 ? (
						<EmptyState
							title="Giỏ mượn đang trống"
							description="Thêm sách từ danh sách để chuẩn bị tạo phiếu mượn."
							icon={ShoppingBasket}
						/>
					) : (
						items.map((item) => (
							<div
								key={item.book_id}
								className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:flex-row sm:items-center"
							>
								<div className="h-28 w-20 overflow-hidden rounded-2xl bg-muted">
									{item.book?.cover_image ? (
										<img
											src={resolveAssetUrl(item.book.cover_image)}
											alt={item.book.title}
											className="h-full w-full object-cover"
										/>
									) : null}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-lg font-semibold">{item.book?.title}</p>
									<p className="text-sm text-muted-foreground">{item.book?.author || "-"}</p>
									<p
										className={`mt-2 text-sm ${(item.book?.available_quantity || 0) >= item.quantity ? "text-emerald-600" : "text-red-600"}`}
									>
										Còn {item.book?.available_quantity || 0} cuốn
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Button variant="outline" size="icon" onClick={() => void updateQuantity(item.book_id, item.quantity - 1)}>
										-
									</Button>
									<span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
									<Button variant="outline" size="icon" onClick={() => void updateQuantity(item.book_id, item.quantity + 1)}>
										+
									</Button>
								</div>
								<Button variant="destructive" onClick={() => void updateQuantity(item.book_id, 0)}>
									Xoá
								</Button>
							</div>
						))
					)}
				</CardContent>
			</Card>

			{items.length > 0 ? (
				<Card className="rounded-3xl">
					<CardContent className="grid gap-4 pt-6 lg:grid-cols-[260px_1fr_auto]">
						<div className="space-y-2">
							<Label htmlFor="due-date">Ngày trả sách</Label>
							<Input
								id="due-date"
								type="date"
								value={dueDate}
								onChange={(event) => setDueDate(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="borrow-note">Ghi chú</Label>
							<Textarea
								id="borrow-note"
								value={note}
								onChange={(event) => setNote(event.target.value)}
								rows={3}
								placeholder="Ghi chú cho thủ thư..."
							/>
						</div>
						<div className="flex items-end">
							<Button className="w-full lg:w-auto" onClick={() => void createBorrow()}>
								Tạo phiếu mượn
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
