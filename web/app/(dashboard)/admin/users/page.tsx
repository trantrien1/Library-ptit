"use client";

import { Search, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/library/empty-state";
import { LoadingState } from "@/components/library/loading-state";
import { PageHeader } from "@/components/library/page-header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
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
import { usersApi } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { AppUser } from "@/lib/types";

export default function AdminUsersPage() {
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [users, setUsers] = useState<AppUser[]>([]);
	const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState({
		full_name: "",
		phone: "",
		is_active: true,
		password: "",
		confirmPassword: "",
	});

	useEffect(() => {
		const timer = setTimeout(() => {
			void loadUsers();
		}, 250);
		return () => clearTimeout(timer);
	}, [search]);

	const loadUsers = async () => {
		setLoading(true);
		try {
			const data = await usersApi.list(1, 100, search);
			setUsers(data);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được độc giả");
		} finally {
			setLoading(false);
		}
	};

	const editUser = async (userId: number) => {
		try {
			const user = await usersApi.get(userId);
			setSelectedUser(user);
			setForm({
				full_name: user.full_name || "",
				phone: user.phone || "",
				is_active: Boolean(user.is_active),
				password: "",
				confirmPassword: "",
			});
			setOpen(true);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được người dùng");
		}
	};

	const saveUser = async () => {
		if (!selectedUser) return;
		if (form.password && form.password !== form.confirmPassword) {
			toast.error("Mật khẩu xác nhận không khớp");
			return;
		}

		setSaving(true);
		try {
			await usersApi.update(selectedUser.id, {
				full_name: form.full_name || null,
				phone: form.phone || null,
				is_active: form.is_active,
			});

			if (form.password) {
				await usersApi.resetPassword(selectedUser.id, form.password);
			}

			toast.success("Cập nhật người dùng thành công");
			setOpen(false);
			await loadUsers();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không lưu được người dùng");
		} finally {
			setSaving(false);
		}
	};

	const deleteUser = async (userId: number) => {
		if (!window.confirm("Bạn có chắc muốn xoá độc giả này?")) return;
		try {
			await usersApi.remove(userId);
			toast.success("Đã xoá người dùng");
			await loadUsers();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xoá được người dùng");
		}
	};

	useEffect(() => {
		void loadUsers();
	}, []);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Quản lý độc giả"
				description="Xem trạng thái tài khoản và cập nhật thông tin người dùng."
			/>

			<Card className="rounded-3xl">
				<CardContent className="pt-6">
					<div className="relative mb-6 max-w-md">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Tìm theo username, email, họ tên..."
							className="pl-10"
						/>
					</div>

					{loading ? (
						<LoadingState label="Đang tải danh sách độc giả..." />
					) : users.length === 0 ? (
						<EmptyState
							title="Không có người dùng phù hợp"
							description="Thử tìm kiếm bằng từ khoá khác."
							icon={UserCog}
						/>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>ID</TableHead>
									<TableHead>Username</TableHead>
									<TableHead>Họ tên</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>SĐT</TableHead>
									<TableHead>Trạng thái</TableHead>
									<TableHead>Ngày tạo</TableHead>
									<TableHead className="text-right">Thao tác</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{users.map((user) => (
									<TableRow key={user.id}>
										<TableCell>#{user.id}</TableCell>
										<TableCell>{user.username}</TableCell>
										<TableCell>{user.full_name || "-"}</TableCell>
										<TableCell>{user.email}</TableCell>
										<TableCell>{user.phone || "-"}</TableCell>
										<TableCell>
											<span className={user.is_active ? "text-emerald-600" : "text-red-600"}>
												{user.is_active ? "Hoạt động" : "Vô hiệu hoá"}
											</span>
										</TableCell>
										<TableCell>{formatDate(user.created_at)}</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button variant="outline" size="sm" onClick={() => void editUser(user.id)}>
													Sửa
												</Button>
												<Button variant="destructive" size="sm" onClick={() => void deleteUser(user.id)}>
													Xoá
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="rounded-3xl">
					<DialogHeader>
						<DialogTitle>Chỉnh sửa độc giả</DialogTitle>
						<DialogDescription>
							Cập nhật hồ sơ, trạng thái hoạt động hoặc đặt lại mật khẩu.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label>Username</Label>
								<Input value={selectedUser?.username || ""} disabled />
							</div>
							<div className="space-y-2">
								<Label>Email</Label>
								<Input value={selectedUser?.email || ""} disabled />
							</div>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label>Họ và tên</Label>
								<Input
									value={form.full_name}
									onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
								/>
							</div>
							<div className="space-y-2">
								<Label>Số điện thoại</Label>
								<Input
									value={form.phone}
									onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
								/>
							</div>
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={form.is_active}
								onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
							/>
							Tài khoản đang hoạt động
						</label>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label>Mật khẩu mới</Label>
								<Input
									type="password"
									value={form.password}
									onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
								/>
							</div>
							<div className="space-y-2">
								<Label>Xác nhận mật khẩu</Label>
								<Input
									type="password"
									value={form.confirmPassword}
									onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
								/>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Huỷ
						</Button>
						<Button onClick={() => void saveUser()} disabled={saving}>
							{saving ? "Đang lưu..." : "Lưu thay đổi"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
