"use client";

import { BookOpen, Search, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/library/empty-state";
import { LoadingState } from "@/components/library/loading-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationControls } from "@/components/library/pagination-controls";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { booksApi, borrowsApi, wishlistApi } from "@/lib/api-client";
import { formatNumber, resolveAssetUrl } from "@/lib/format";
import type { Book, PaginatedResponse, Review, ReviewSummary } from "@/lib/types";

function renderStars(rating: number) {
	return Array.from({ length: 5 }, (_, index) => (
		<Star
			key={`${rating}-${index}`}
			className={`h-4 w-4 ${index < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
		/>
	));
}

export default function UserBooksPage() {
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("");
	const [categories, setCategories] = useState<string[]>([]);
	const [books, setBooks] = useState<PaginatedResponse<Book> | null>(null);
	const [selectedBook, setSelectedBook] = useState<Book | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [reviewRating, setReviewRating] = useState(0);
	const [reviewComment, setReviewComment] = useState("");
	const [reviews, setReviews] = useState<Review[]>([]);
	const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
	const [myReview, setMyReview] = useState<Review | null>(null);

	useEffect(() => {
		const timer = setTimeout(() => {
			void loadBooks();
		}, 250);
		return () => clearTimeout(timer);
	}, [page, search, category]);

	useEffect(() => {
		void loadCategories();
	}, []);

	const loadBooks = async () => {
		setLoading(true);
		try {
			setBooks(await booksApi.list(page, 12, search, category));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được sách");
		} finally {
			setLoading(false);
		}
	};

	const loadCategories = async () => {
		try {
			setCategories(await booksApi.categories());
		} catch {
			setCategories([]);
		}
	};

	const openDetails = async (bookId: number) => {
		try {
			const book = await booksApi.get(bookId);
			const [summary, reviewsData, myReviewData] = await Promise.all([
				booksApi.reviewSummary(bookId),
				booksApi.reviews(bookId),
				booksApi.myReview(bookId),
			]);
			setSelectedBook(book);
			setReviewSummary(summary);
			setReviews(reviewsData);
			setMyReview(myReviewData);
			setReviewRating(myReviewData?.rating || 0);
			setReviewComment(myReviewData?.comment || "");
			setDetailsOpen(true);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được chi tiết sách");
		}
	};

	const addToWishlist = async (bookId: number) => {
		try {
			await wishlistApi.add(bookId, 1);
			toast.success("Đã thêm sách vào giỏ mượn");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không thêm được vào giỏ");
		}
	};

	const joinWaitlist = async (bookId: number) => {
		try {
			await borrowsApi.waitlistJoin(bookId, 1);
			toast.success("Đã vào hàng chờ");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không vào được hàng chờ");
		}
	};

	const saveReview = async () => {
		if (!selectedBook) return;
		if (reviewRating < 1) {
			toast.error("Vui lòng chọn số sao");
			return;
		}
		try {
			await booksApi.saveReview(selectedBook.id, reviewRating, reviewComment);
			toast.success("Đã lưu đánh giá");
			await openDetails(selectedBook.id);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được đánh giá");
		}
	};

	useEffect(() => {
		void loadBooks();
	}, []);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Danh sách sách"
				description="Tìm đầu sách, xem mô tả và thêm vào giỏ mượn."
			/>

			<Card className="rounded-3xl">
				<CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_240px]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => {
								setPage(1);
								setSearch(event.target.value);
							}}
							placeholder="Tìm theo tên, tác giả, ISBN..."
							className="pl-10"
						/>
					</div>
					<select
						value={category}
						onChange={(event) => {
							setPage(1);
							setCategory(event.target.value);
						}}
						className="h-10 rounded-xl border bg-background px-3 text-sm"
					>
						<option value="">Tất cả danh mục</option>
						{categories.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
				</CardContent>
			</Card>

			{loading ? (
				<LoadingState label="Đang tải sách..." />
			) : !books || books.items.length === 0 ? (
				<EmptyState
					title="Không tìm thấy sách phù hợp"
					description="Thử đổi từ khoá hoặc bộ lọc danh mục."
					icon={BookOpen}
				/>
			) : (
				<>
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{books.items.map((book) => (
							<Card key={book.id} className="overflow-hidden rounded-3xl">
								<div className="h-56 bg-muted">
									{book.cover_image ? (
										<img
											src={resolveAssetUrl(book.cover_image)}
											alt={book.title}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="flex h-full items-center justify-center text-muted-foreground">
											<BookOpen className="h-12 w-12" />
										</div>
									)}
								</div>
								<CardHeader>
									<CardTitle className="line-clamp-2">{book.title}</CardTitle>
									<CardDescription>
										{book.author || "Không rõ tác giả"} • {book.category || "Chưa phân loại"}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="rounded-2xl bg-muted/40 p-3 text-sm">
										<p>
											Sẵn sàng:{" "}
											<span className="font-medium">{formatNumber(book.available_quantity)}</span>
										</p>
										<p>
											Tổng số lượng:{" "}
											<span className="font-medium">{formatNumber(book.quantity)}</span>
										</p>
									</div>
									<div className="flex gap-2">
										<Button variant="outline" className="flex-1" onClick={() => void openDetails(book.id)}>
											Chi tiết
										</Button>
										{book.available_quantity > 0 ? (
											<Button className="flex-1" onClick={() => void addToWishlist(book.id)}>
												Thêm giỏ
											</Button>
										) : (
											<Button className="flex-1" variant="secondary" onClick={() => void joinWaitlist(book.id)}>
												Hàng chờ
											</Button>
										)}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
					<PaginationControls page={books.page} totalPages={books.total_pages} onChange={setPage} />
				</>
			)}

			<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
				<DialogContent className="max-w-4xl rounded-3xl">
					<DialogHeader>
						<DialogTitle>{selectedBook?.title}</DialogTitle>
						<DialogDescription>
							{selectedBook?.author || "Không rõ tác giả"} • {selectedBook?.category || "Chưa phân loại"}
						</DialogDescription>
					</DialogHeader>
					{selectedBook ? (
						<div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
							<div className="space-y-4">
								<div className="overflow-hidden rounded-3xl border bg-muted">
									{selectedBook.cover_image ? (
										<img
											src={resolveAssetUrl(selectedBook.cover_image)}
											alt={selectedBook.title}
											className="h-80 w-full object-cover"
										/>
									) : (
										<div className="flex h-80 items-center justify-center text-muted-foreground">
											<BookOpen className="h-14 w-14" />
										</div>
									)}
								</div>
								<div className="rounded-2xl border bg-muted/30 p-4 text-sm">
									<p>ISBN: {selectedBook.isbn || "-"}</p>
									<p>Số lượng: {selectedBook.quantity}</p>
									<p>Còn lại: {selectedBook.available_quantity}</p>
								</div>
								{selectedBook.pdf_file ? (
									<Button variant="outline" className="w-full" asChild>
										<a href={booksApi.previewPdfUrl(selectedBook.id)} target="_blank" rel="noreferrer">
											Xem thử PDF
										</a>
									</Button>
								) : null}
							</div>
							<div className="space-y-5">
								<div className="rounded-2xl border bg-muted/30 p-4">
									<p className="text-sm text-muted-foreground">Mô tả</p>
									<p className="mt-2 leading-7">
										{selectedBook.description || "Chưa có mô tả cho đầu sách này."}
									</p>
								</div>
								<div className="rounded-2xl border bg-muted/30 p-4">
									<p className="text-sm text-muted-foreground">Đánh giá trung bình</p>
									<div className="mt-2 flex items-center gap-2">
										<div className="flex items-center gap-1">
											{renderStars(Math.round(reviewSummary?.average_rating || 0))}
										</div>
										<span className="font-medium">
											{reviewSummary?.average_rating?.toFixed(1) || "0.0"}/5
										</span>
										<span className="text-sm text-muted-foreground">
											({reviewSummary?.total_reviews || 0} đánh giá)
										</span>
									</div>
								</div>
								<div className="space-y-3">
									<h3 className="font-semibold">Đánh giá gần đây</h3>
									{reviews.length === 0 ? (
										<p className="text-sm text-muted-foreground">Chưa có đánh giá nào.</p>
									) : (
										reviews.slice(0, 5).map((review) => (
											<div key={review.id} className="rounded-2xl border bg-card p-4">
												<div className="flex items-center justify-between">
													<p className="font-medium">{review.full_name || review.username}</p>
													<div className="flex items-center gap-1">
														{renderStars(review.rating)}
													</div>
												</div>
												<p className="mt-2 text-sm text-muted-foreground">
													{review.comment || "Không có nhận xét"}
												</p>
											</div>
										))
									)}
								</div>
								<div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
									<h3 className="font-semibold">Đánh giá của bạn</h3>
									<div className="flex gap-2">
										{[1, 2, 3, 4, 5].map((value) => (
											<button
												key={value}
												type="button"
												className="rounded-full p-1"
												onClick={() => setReviewRating(value)}
											>
												<Star
													className={`h-5 w-5 ${value <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
												/>
											</button>
										))}
									</div>
									<Textarea
										value={reviewComment}
										onChange={(event) => setReviewComment(event.target.value)}
										rows={3}
										placeholder="Nhập nhận xét của bạn..."
									/>
									<Button onClick={() => void saveReview()}>
										{myReview ? "Cập nhật đánh giá" : "Gửi đánh giá"}
									</Button>
								</div>
							</div>
						</div>
					) : null}
					<DialogFooter>
						{selectedBook ? (
							selectedBook.available_quantity ? (
								<Button onClick={() => void addToWishlist(selectedBook.id)}>Thêm vào giỏ</Button>
							) : (
								<Button variant="secondary" onClick={() => void joinWaitlist(selectedBook.id)}>
									Tham gia hàng chờ
								</Button>
							)
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
