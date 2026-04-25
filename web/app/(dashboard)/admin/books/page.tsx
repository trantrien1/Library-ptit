"use client";

import { BookOpen, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/library/empty-state";
import { LoadingState } from "@/components/library/loading-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationControls } from "@/components/library/pagination-controls";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
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
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { booksApi } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/format";
import type { Book, PaginatedResponse } from "@/lib/types";

const initialForm = {
	title: "",
	author: "",
	isbn: "",
	category: "",
	quantity: "0",
	description: "",
	cover_image: "",
};

export default function AdminBooksPage() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [books, setBooks] = useState<PaginatedResponse<Book> | null>(null);
	const [categories, setCategories] = useState<string[]>([]);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("");
	const [open, setOpen] = useState(false);
	const [editingBook, setEditingBook] = useState<Book | null>(null);
	const [pdfFile, setPdfFile] = useState<File | null>(null);
	const [form, setForm] = useState(initialForm);

	const normalizedForm = useMemo(
		() => ({
			title: form.title,
			author: form.author || null,
			isbn: form.isbn || null,
			category: form.category || null,
			quantity: Number(form.quantity) || 0,
			description: form.description || null,
			cover_image: form.cover_image || null,
		}),
		[form],
	);

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
			const data = await booksApi.list(page, 10, search, category);
			setBooks(data);
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

	const resetForm = () => {
		setEditingBook(null);
		setPdfFile(null);
		setForm(initialForm);
		setOpen(true);
	};

	const startEdit = async (bookId: number) => {
		try {
			const book = await booksApi.get(bookId);
			setEditingBook(book);
			setForm({
				title: book.title,
				author: book.author || "",
				isbn: book.isbn || "",
				category: book.category || "",
				quantity: String(book.quantity ?? 0),
				description: book.description || "",
				cover_image: book.cover_image || "",
			});
			setPdfFile(null);
			setOpen(true);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được sách");
		}
	};

	const saveBook = async () => {
		if (!form.title.trim()) {
			toast.error("Tên sách là bắt buộc");
			return;
		}

		setSaving(true);
		try {
			const saved = editingBook
				? await booksApi.update(editingBook.id, normalizedForm)
				: await booksApi.create(normalizedForm);

			if (pdfFile) {
				await booksApi.uploadPdf(saved.id, pdfFile);
			}

			toast.success(editingBook ? "Cập nhật sách thành công" : "Thêm sách thành công");
			setOpen(false);
			setForm(initialForm);
			setPdfFile(null);
			await Promise.all([loadBooks(), loadCategories()]);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được sách");
		} finally {
			setSaving(false);
		}
	};

	const deleteBook = async (bookId: number) => {
		if (!window.confirm("Bạn có chắc muốn xoá sách này?")) return;
		try {
			await booksApi.remove(bookId);
			toast.success("Đã xoá sách");
			await loadBooks();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xoá được sách");
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Quản lý sách"
				description="Thêm, chỉnh sửa đầu sách và tải lên PDF đọc thử."
				actions={
					<Button onClick={resetForm}>
						<Plus className="mr-2 h-4 w-4" />
						Thêm sách
					</Button>
				}
			/>

			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Bộ lọc</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 md:grid-cols-[1fr_240px]">
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

			<Card className="rounded-3xl">
				<CardContent className="pt-6">
					{loading ? (
						<LoadingState label="Đang tải danh sách sách..." />
					) : !books || books.items.length === 0 ? (
						<EmptyState
							title="Chưa có đầu sách phù hợp"
							description="Thử đổi bộ lọc hoặc thêm một đầu sách mới."
							icon={BookOpen}
						/>
					) : (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Tên sách</TableHead>
										<TableHead>Tác giả</TableHead>
										<TableHead>Danh mục</TableHead>
										<TableHead>SL</TableHead>
										<TableHead>Còn</TableHead>
										<TableHead className="text-right">Thao tác</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{books.items.map((book) => (
										<TableRow key={book.id}>
											<TableCell>#{book.id}</TableCell>
											<TableCell className="font-medium">{book.title}</TableCell>
											<TableCell>{book.author || "-"}</TableCell>
											<TableCell>{book.category || "-"}</TableCell>
											<TableCell>{book.quantity}</TableCell>
											<TableCell>{book.available_quantity}</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => void startEdit(book.id)}
													>
														Sửa
													</Button>
													<Button
														variant="destructive"
														size="sm"
														onClick={() => void deleteBook(book.id)}
													>
														Xoá
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
							<PaginationControls
								page={books.page}
								totalPages={books.total_pages}
								onChange={setPage}
							/>
						</>
					)}
				</CardContent>
			</Card>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-3xl rounded-3xl">
					<DialogHeader>
						<DialogTitle>{editingBook ? "Chỉnh sửa sách" : "Thêm sách mới"}</DialogTitle>
						<DialogDescription>
							Cập nhật thông tin cơ bản, số lượng và file PDF nếu có.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="book-title">Tên sách</Label>
							<Input
								id="book-title"
								value={form.title}
								onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="book-author">Tác giả</Label>
							<Input
								id="book-author"
								value={form.author}
								onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="book-isbn">ISBN</Label>
							<Input
								id="book-isbn"
								value={form.isbn}
								onChange={(event) => setForm((current) => ({ ...current, isbn: event.target.value }))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="book-category">Danh mục</Label>
							<Input
								id="book-category"
								value={form.category}
								onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="book-quantity">Số lượng</Label>
							<Input
								id="book-quantity"
								type="number"
								value={form.quantity}
								onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
							/>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="book-cover">Ảnh bìa</Label>
							<Input
								id="book-cover"
								value={form.cover_image}
								onChange={(event) => setForm((current) => ({ ...current, cover_image: event.target.value }))}
							/>
							{form.cover_image ? (
								<img
									src={resolveAssetUrl(form.cover_image)}
									alt="Preview cover"
									className="mt-2 h-40 rounded-2xl object-cover"
								/>
							) : null}
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="book-description">Mô tả</Label>
							<Textarea
								id="book-description"
								value={form.description}
								onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
								rows={4}
							/>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="book-pdf">PDF</Label>
							<Input
								id="book-pdf"
								type="file"
								accept=".pdf"
								onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Huỷ
						</Button>
						<Button onClick={() => void saveBook()} disabled={saving}>
							{saving ? "Đang lưu..." : "Lưu thay đổi"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
