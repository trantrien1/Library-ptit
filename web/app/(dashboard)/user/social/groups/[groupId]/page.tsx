"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Check,
	Heart,
	LogOut,
	MessageCircle,
	MoreHorizontal,
	Plus,
	Send,
	ShieldCheck,
	Trash2,
	UserPlus,
	UsersRound,
	X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { platformApi } from "@/lib/api-client";
import type { DiscussionGroup, DiscussionGroupMember, DiscussionPost, DiscussionPostComment } from "@/lib/types";

const postTypes = [
	{ label: "Review sách", value: "review" },
	{ label: "Hỏi đáp", value: "question" },
	{ label: "Chia sẻ tài liệu", value: "resource" },
	{ label: "Thảo luận", value: "discussion" },
];

const sortTabs = [
	{ label: "Mới nhất", value: "latest" },
	{ label: "Nổi bật", value: "popular" },
	{ label: "Nhiều bình luận", value: "comments" },
];

const groupTabs = [
	{ label: "Bài viết", value: "posts" },
	{ label: "Thành viên", value: "members" },
	{ label: "Giới thiệu", value: "about" },
];

type FormState = {
	title: string;
	content: string;
	post_type: string;
	group_id: string;
	tags: string;
};

const emptyForm: FormState = {
	title: "",
	content: "",
	post_type: "discussion",
	group_id: "",
	tags: "",
};

export default function SocialGroupPage() {
	const params = useParams<{ groupId: string }>();
	const router = useRouter();
	const { user } = useAuth();
	const groupId = Number(params.groupId);
	const [group, setGroup] = useState<DiscussionGroup | null>(null);
	const [groups, setGroups] = useState<DiscussionGroup[]>([]);
	const [posts, setPosts] = useState<DiscussionPost[]>([]);
	const [members, setMembers] = useState<DiscussionGroupMember[]>([]);
	const [pendingMembers, setPendingMembers] = useState<DiscussionGroupMember[]>([]);
	const [activeTab, setActiveTab] = useState("posts");
	const [sort, setSort] = useState("latest");
	const [createOpen, setCreateOpen] = useState(false);
	const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [busy, setBusy] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		try {
			const [groupData, groupsData, postsData, membersData] = await Promise.all([
				platformApi.group(groupId),
				platformApi.groups(),
				platformApi.feed(groupId, sort),
				platformApi.groupMembers(groupId, "approved"),
			]);
			setGroup(groupData);
			setGroups(groupsData);
			setPosts(postsData);
			setMembers(membersData);
			if (groupData.is_group_admin) {
				setPendingMembers(await platformApi.groupMembers(groupId, "pending"));
			} else {
				setPendingMembers([]);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được trang nhóm");
		}
	}, [groupId, sort]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const tabs = useMemo(() => {
		return group?.is_group_admin
			? [...groupTabs.slice(0, 2), { label: `Yêu cầu tham gia (${pendingMembers.length})`, value: "requests" }, groupTabs[2]]
			: groupTabs;
	}, [group?.is_group_admin, pendingMembers.length]);

	const openCreate = () => {
		if (!group?.is_member && group?.group_role !== "admin") {
			toast.error(group?.membership_status === "pending" ? "Yêu cầu tham gia nhóm của bạn đang chờ duyệt." : "Bạn cần tham gia nhóm để đăng bài.");
			return;
		}
		setForm({ ...emptyForm, group_id: String(groupId) });
		setCreateOpen(true);
	};

	const joinGroup = async () => {
		if (!group || group.is_member || group.membership_status === "pending") return;
		try {
			const nextGroup = await platformApi.joinGroup(group.id);
			setGroup(nextGroup);
			toast.success(nextGroup.membership_status === "pending" ? "Đã gửi yêu cầu tham gia nhóm" : "Đã tham gia nhóm");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tham gia được nhóm");
		}
	};

	const leaveGroup = async () => {
		if (!group) return;
		try {
			const nextGroup = await platformApi.leaveGroup(group.id);
			setGroup(nextGroup);
			toast.success(group.membership_status === "pending" ? "Đã hủy yêu cầu tham gia" : "Đã rời nhóm");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không rời nhóm được");
		}
	};

	const approveMember = async (member: DiscussionGroupMember) => {
		setBusy(`approve-${member.user_id}`);
		try {
			await platformApi.approveGroupMember(groupId, member.user_id);
			toast.success("Đã duyệt thành viên");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không duyệt được thành viên");
		} finally {
			setBusy(null);
		}
	};

	const rejectMember = async (member: DiscussionGroupMember) => {
		setBusy(`reject-${member.user_id}`);
		try {
			await platformApi.rejectGroupMember(groupId, member.user_id);
			toast.success("Đã từ chối yêu cầu");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không từ chối được yêu cầu");
		} finally {
			setBusy(null);
		}
	};

	const createPost = async () => {
		if (!form.title.trim() || !form.content.trim()) {
			toast.error("Vui lòng nhập tiêu đề và nội dung bài viết.");
			return;
		}
		if (!group?.is_member && group?.group_role !== "admin") {
			toast.error(group?.membership_status === "pending" ? "Yêu cầu tham gia nhóm của bạn đang chờ duyệt." : "Bạn cần tham gia nhóm trước khi đăng bài.");
			return;
		}
		setBusy("create");
		try {
			await platformApi.createPost({
				group_id: groupId,
				title: form.title.trim(),
				content: form.content.trim(),
				post_type: form.post_type,
				tags: form.tags.trim() || null,
			});
			setCreateOpen(false);
			setForm(emptyForm);
			toast.success("Đã đăng bài viết");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không đăng được bài viết");
		} finally {
			setBusy(null);
		}
	};

	const deleteGroup = async () => {
		if (!group) return;
		setBusy("delete-group");
		try {
			await platformApi.deleteGroup(group.id);
			toast.success("Đã xóa nhóm");
			router.push("/user/social");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xóa được nhóm");
		} finally {
			setBusy(null);
		}
	};

	if (!group) {
		return <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-6 text-sm text-slate-500 dark:text-slate-400">Đang tải nhóm...</div>;
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<GroupHeader
				group={group}
				onJoin={() => void joinGroup()}
				onLeave={() => void leaveGroup()}
				onCreate={openCreate}
				onDelete={() => setDeleteGroupOpen(true)}
			/>

			<div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-2 shadow-sm">
				<div className="flex gap-1 overflow-x-auto">
					{tabs.map((tab) => (
						<button
							key={tab.value}
							type="button"
							onClick={() => setActiveTab(tab.value)}
							className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
								activeTab === tab.value ? "bg-primary text-primary-foreground" : "text-slate-600 dark:text-slate-300 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{activeTab === "posts" ? (
				<section className="space-y-4">
					<div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
						<div className="flex gap-1 overflow-x-auto">
							{sortTabs.map((tab) => (
								<button
									key={tab.value}
									type="button"
									onClick={() => setSort(tab.value)}
									className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
										sort === tab.value ? "bg-primary text-primary-foreground" : "text-slate-600 dark:text-slate-300 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
									}`}
								>
									{tab.label}
								</button>
							))}
						</div>
						<Button className="gap-2" onClick={openCreate}>
							<Plus className="h-4 w-4" />
							Tạo bài viết trong nhóm
						</Button>
					</div>
					{!group.is_member && group.group_role !== "admin" ? (
						<div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-8 text-center text-sm text-slate-600 dark:text-slate-300">
							Bạn cần tham gia nhóm để đăng bài.
						</div>
					) : null}
					{posts.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-10 text-center">
							<p className="font-semibold text-slate-950 dark:text-slate-50">Nhóm chưa có bài viết</p>
							<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Hãy là người đầu tiên mở cuộc thảo luận.</p>
						</div>
					) : (
						posts.map((post) => (
							<PostCard
								key={post.id}
								post={post}
								groups={groups}
								currentUserId={user?.id || 0}
								onChanged={loadData}
								onDeleted={(postId) => setPosts((current) => current.filter((item) => item.id !== postId))}
							/>
						))
					)}
				</section>
			) : null}

			{activeTab === "members" ? <MemberList members={members} /> : null}
			{activeTab === "requests" && group.is_group_admin ? (
				<PendingRequests
					members={pendingMembers}
					busy={busy}
					onApprove={(member) => void approveMember(member)}
					onReject={(member) => void rejectMember(member)}
				/>
			) : null}
			{activeTab === "about" ? <AboutGroup group={group} members={members} /> : null}

			<PostFormDialog
				open={createOpen}
				title="Tạo bài viết trong nhóm"
				description={`Bài viết sẽ được đăng trong nhóm ${group.name}.`}
				form={form}
				groups={[group]}
				submitting={busy === "create"}
				submitLabel="Đăng bài"
				onOpenChange={setCreateOpen}
				onFormChange={setForm}
				onCancel={() => setCreateOpen(false)}
				onSubmit={() => void createPost()}
			/>

			<ConfirmDialog
				open={deleteGroupOpen}
				title="Bạn có chắc chắn muốn xóa nhóm này không?"
				description="Tất cả bài viết trong nhóm cũng sẽ bị ẩn hoặc xóa."
				confirmLabel="Xóa nhóm"
				loading={busy === "delete-group"}
				onOpenChange={setDeleteGroupOpen}
				onConfirm={() => void deleteGroup()}
			/>
		</div>
	);
}

function GroupHeader({
	group,
	onJoin,
	onLeave,
	onCreate,
	onDelete,
}: {
	group: DiscussionGroup;
	onJoin: () => void;
	onLeave: () => void;
	onCreate: () => void;
	onDelete: () => void;
}) {
	return (
		<Card className="rounded-3xl border-slate-200 dark:border-white/10 shadow-sm dark:bg-slate-950/72">
			<CardContent className="p-6">
				<Link href="/user/social" className="text-sm font-medium text-cyan-700 hover:underline">
					Quay lại Social Hub
				</Link>
				<div className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
					<div>
						<div className="flex items-center gap-3">
							<Avatar className="h-14 w-14">
								<AvatarFallback className="bg-cyan-100 font-semibold text-cyan-700">{getInitials(group.name)}</AvatarFallback>
							</Avatar>
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{group.name}</h1>
									{group.is_group_admin ? (
										<Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
											<ShieldCheck className="h-3.5 w-3.5" />
											Quản trị viên
										</Badge>
									) : null}
								</div>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									{(group.member_count || 0).toLocaleString("vi-VN")} thành viên · {(group.post_count || 0).toLocaleString("vi-VN")} bài viết
								</p>
							</div>
						</div>
						<p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">{group.description}</p>
						<div className="mt-3 flex flex-wrap gap-2">
							{group.topic ? <Badge variant="outline">{group.topic}</Badge> : null}
							{group.requires_approval ? <Badge variant="outline">Cần duyệt thành viên</Badge> : null}
						</div>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<GroupAction group={group} onJoin={onJoin} onLeave={onLeave} onDelete={onDelete} />
						<Button className="gap-2" onClick={onCreate}>
							<Plus className="h-4 w-4" />
							Tạo bài viết
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function GroupAction({
	group,
	onJoin,
	onLeave,
	onDelete,
}: {
	group: DiscussionGroup;
	onJoin: () => void;
	onLeave: () => void;
	onDelete: () => void;
}) {
	if (group.is_group_admin) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" className="gap-2">
						<ShieldCheck className="h-4 w-4" />
						Quản lý nhóm
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={onLeave}>
						<LogOut className="mr-2 h-4 w-4" />
						Rời nhóm
					</DropdownMenuItem>
					<DropdownMenuItem variant="destructive" onClick={onDelete}>
						<Trash2 className="mr-2 h-4 w-4" />
						Xóa nhóm
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}
	if (group.membership_status === "pending") {
		return (
			<Button variant="secondary" className="gap-2" onClick={onLeave}>
				<LogOut className="h-4 w-4" />
				Hủy yêu cầu
			</Button>
		);
	}
	if (group.is_member) {
		return (
			<Button variant="secondary" className="gap-2" onClick={onLeave}>
				<LogOut className="h-4 w-4" />
				Rời nhóm
			</Button>
		);
	}
	return (
		<Button className="gap-2" onClick={onJoin}>
			<UserPlus className="h-4 w-4" />
			Tham gia
		</Button>
	);
}

function MemberList({ members }: { members: DiscussionGroupMember[] }) {
	return (
		<section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-5 shadow-sm">
			<h2 className="font-semibold text-slate-950 dark:text-slate-50">Thành viên đã duyệt</h2>
			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				{members.map((member) => (
					<MemberRow key={member.id} member={member} />
				))}
			</div>
		</section>
	);
}

function PendingRequests({
	members,
	busy,
	onApprove,
	onReject,
}: {
	members: DiscussionGroupMember[];
	busy: string | null;
	onApprove: (member: DiscussionGroupMember) => void;
	onReject: (member: DiscussionGroupMember) => void;
}) {
	return (
		<section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-5 shadow-sm">
			<h2 className="font-semibold text-slate-950 dark:text-slate-50">Yêu cầu tham gia</h2>
			{members.length === 0 ? (
				<p className="mt-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
					Chưa có yêu cầu tham gia nào.
				</p>
			) : (
				<div className="mt-4 space-y-3">
					{members.map((member) => (
						<div key={member.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 dark:border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
							<MemberIdentity member={member} />
							<div className="flex gap-2">
								<Button size="sm" className="gap-2" disabled={busy === `approve-${member.user_id}`} onClick={() => onApprove(member)}>
									<Check className="h-4 w-4" />
									Duyệt
								</Button>
								<Button size="sm" variant="outline" className="gap-2" disabled={busy === `reject-${member.user_id}`} onClick={() => onReject(member)}>
									<X className="h-4 w-4" />
									Từ chối
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

function AboutGroup({ group, members }: { group: DiscussionGroup; members: DiscussionGroupMember[] }) {
	const owner = members.find((member) => member.role === "admin" || member.role === "owner");
	return (
		<section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-5 shadow-sm">
			<h2 className="font-semibold text-slate-950 dark:text-slate-50">Giới thiệu nhóm</h2>
			<div className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
				<p>{group.description}</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<InfoBlock label="Ngày tạo" value={new Date(group.created_at).toLocaleDateString("vi-VN")} />
					<InfoBlock label="Người tạo / quản trị" value={owner?.user?.full_name || owner?.user?.username || "Quản trị viên nhóm"} />
					<InfoBlock label="Chủ đề" value={group.topic || "Chưa đặt chủ đề"} />
					<InfoBlock label="Cơ chế tham gia" value={group.requires_approval ? "Cần quản trị viên duyệt" : "Tham gia ngay"} />
				</div>
				<div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] p-4">
					<p className="font-medium text-slate-950 dark:text-slate-50">Quy định nhóm</p>
					<p className="mt-2">{group.rules || "Tôn trọng người khác, chia sẻ đúng chủ đề và ưu tiên nguồn tài liệu đáng tin cậy."}</p>
				</div>
			</div>
		</section>
	);
}

function InfoBlock({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-slate-100 dark:border-white/10 p-3">
			<p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">{label}</p>
			<p className="mt-1 font-medium text-slate-800 dark:text-slate-200">{value}</p>
		</div>
	);
}

function MemberRow({ member }: { member: DiscussionGroupMember }) {
	return (
		<div className="rounded-xl border border-slate-100 dark:border-white/10 p-3">
			<MemberIdentity member={member} />
		</div>
	);
}

function MemberIdentity({ member }: { member: DiscussionGroupMember }) {
	const name = member.user?.full_name || member.user?.username || "Bạn đọc PTIT";
	return (
		<div className="flex items-center gap-3">
			<Avatar className="h-10 w-10">
				<AvatarFallback className="bg-cyan-100 text-sm font-semibold text-cyan-700">{getInitials(name)}</AvatarFallback>
			</Avatar>
			<div>
				<p className="font-medium text-slate-950 dark:text-slate-50">{name}</p>
				<p className="text-xs text-slate-500 dark:text-slate-400">
					{member.role === "admin" || member.role === "owner" ? "Quản trị viên" : "Thành viên"} · {formatRelativeTime(member.joined_at)}
				</p>
			</div>
		</div>
	);
}

function PostCard({
	post,
	groups,
	currentUserId,
	onChanged,
	onDeleted,
}: {
	post: DiscussionPost;
	groups: DiscussionGroup[];
	currentUserId: number;
	onChanged: () => Promise<void>;
	onDeleted: (postId: number) => void;
}) {
	const [liked, setLiked] = useState(Boolean(post.liked_by_me));
	const [likeCount, setLikeCount] = useState(post.like_count || 0);
	const [commentCount, setCommentCount] = useState(post.comment_count || 0);
	const [comments, setComments] = useState<DiscussionPostComment[]>([]);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [commentDraft, setCommentDraft] = useState("");
	const [busy, setBusy] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [editForm, setEditForm] = useState<FormState>(() => postToForm(post));
	const canEdit = Boolean(post.can_edit || post.is_owner || post.user_id === currentUserId);
	const canDelete = Boolean(post.can_delete || canEdit);
	const author = post.user?.full_name || post.user?.username || "Bạn đọc PTIT";

	useEffect(() => {
		setLiked(Boolean(post.liked_by_me));
		setLikeCount(post.like_count || 0);
		setCommentCount(post.comment_count || 0);
		setEditForm(postToForm(post));
	}, [post]);

	const loadComments = async () => {
		setCommentsOpen((current) => !current);
		if (commentsOpen || comments.length > 0) return;
		try {
			setComments(await platformApi.comments(post.id));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được bình luận");
		}
	};

	const toggleLike = async () => {
		setBusy("like");
		try {
			const result = await platformApi.likePost(post.id);
			setLiked(result.active);
			setLikeCount(result.like_count);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không thể thích bài viết");
		} finally {
			setBusy(null);
		}
	};


	const submitComment = async () => {
		const content = commentDraft.trim();
		if (!content) return;
		setBusy("comment");
		try {
			const comment = await platformApi.commentPost(post.id, content);
			setComments((current) => [...current, comment]);
			setCommentCount((count) => count + 1);
			setCommentDraft("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không gửi được bình luận");
		} finally {
			setBusy(null);
		}
	};

	const updatePost = async () => {
		if (!editForm.title.trim() || !editForm.content.trim()) {
			toast.error("Vui lòng nhập tiêu đề và nội dung.");
			return;
		}
		setBusy("edit");
		try {
			await platformApi.updatePost(post.id, {
				group_id: Number(editForm.group_id),
				title: editForm.title.trim(),
				content: editForm.content.trim(),
				post_type: editForm.post_type,
				tags: editForm.tags.trim() || null,
			});
			setEditing(false);
			toast.success("Đã lưu thay đổi");
			await onChanged();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không sửa được bài viết");
		} finally {
			setBusy(null);
		}
	};

	const deletePost = async () => {
		setBusy("delete");
		try {
			await platformApi.deletePost(post.id);
			onDeleted(post.id);
			setDeleting(false);
			toast.success("Đã xóa bài viết");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không xóa được bài viết");
		} finally {
			setBusy(null);
		}
	};

	return (
		<article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-5 shadow-sm">
			<div className="flex items-start gap-3">
				<Avatar className="h-11 w-11">
					<AvatarFallback className="bg-slate-900 text-sm font-semibold text-white">{getInitials(author)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<p className="font-semibold text-slate-950 dark:text-slate-50">{author}</p>
						<Badge variant="secondary" className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
							{post.user?.role === "admin" ? "Quản trị viên" : "Sinh viên"}
						</Badge>
						<span className="text-sm text-slate-400">·</span>
						<span className="text-sm text-slate-500 dark:text-slate-400">{formatRelativeTime(post.created_at)}</span>
					</div>
					<p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-cyan-700">
						<UsersRound className="h-4 w-4" />
						{post.group?.name || "Cộng đồng thư viện"}
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{canEdit ? <DropdownMenuItem onClick={() => setEditing(true)}>Sửa bài viết</DropdownMenuItem> : null}
						{canDelete ? (
							<DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
								Xóa bài viết
							</DropdownMenuItem>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="mt-4">
				<h2 className="text-xl font-semibold leading-7 text-slate-950 dark:text-slate-50">{post.title}</h2>
				<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{post.content}</p>
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				<Badge variant="outline" className="border-cyan-100 bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">{postTypeLabel(post.post_type)}</Badge>
				{splitTags(post.tags).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
			</div>
			<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-white/10 pt-4">
				<div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
					<span>{likeCount} lượt thích</span>
					<button type="button" className="hover:text-slate-950 dark:hover:text-slate-50" onClick={() => void loadComments()}>{commentCount} bình luận</button>
				</div>
				<div className="flex flex-wrap gap-1">
					<Button variant="ghost" size="sm" disabled={busy === "like"} onClick={() => void toggleLike()} className={liked ? "gap-2 text-red-600 hover:text-red-700" : "gap-2 text-slate-600 dark:text-slate-300"}>
						<Heart className={`h-4 w-4 ${liked ? "fill-red-600" : ""}`} /> Thích
					</Button>
					<Button variant="ghost" size="sm" className="gap-2 text-slate-600 dark:text-slate-300" onClick={() => void loadComments()}>
						<MessageCircle className="h-4 w-4" /> Bình luận
					</Button>
				</div>
			</div>
			{commentsOpen ? (
				<CommentSection comments={comments} commentDraft={commentDraft} busy={busy === "comment"} onDraftChange={setCommentDraft} onSubmit={() => void submitComment()} />
			) : null}
			<PostFormDialog open={editing} title="Sửa bài viết" description="Chỉ tác giả bài viết được sửa nội dung." form={editForm} groups={groups} submitting={busy === "edit"} submitLabel="Lưu thay đổi" onOpenChange={setEditing} onFormChange={setEditForm} onCancel={() => setEditing(false)} onSubmit={() => void updatePost()} />
			<ConfirmDialog open={deleting} title="Bạn có chắc chắn muốn xóa bài viết này không?" description="Bài viết sẽ biến mất khỏi feed chính và trang nhóm." confirmLabel="Xóa" loading={busy === "delete"} onOpenChange={setDeleting} onConfirm={() => void deletePost()} />
		</article>
	);
}

function CommentSection({
	comments,
	commentDraft,
	busy,
	onDraftChange,
	onSubmit,
}: {
	comments: DiscussionPostComment[];
	commentDraft: string;
	busy: boolean;
	onDraftChange: (value: string) => void;
	onSubmit: () => void;
}) {
	return (
		<div className="mt-4 space-y-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] p-4">
			{comments.length === 0 ? (
				<p className="text-sm text-slate-500 dark:text-slate-400">Chưa có bình luận nào. Hãy là người đầu tiên bình luận.</p>
			) : (
				comments.map((comment) => (
					<div key={comment.id} className="flex gap-3">
						<Avatar className="h-8 w-8">
							<AvatarFallback className="bg-cyan-100 text-xs font-semibold text-cyan-700">{getInitials(comment.user?.full_name || comment.user?.username || "Bạn đọc")}</AvatarFallback>
						</Avatar>
						<div className="min-w-0 rounded-xl bg-white dark:bg-slate-900/80 px-3 py-2 shadow-sm">
							<p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{comment.user?.full_name || comment.user?.username || "Bạn đọc"}</p>
							<p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{comment.content}</p>
						</div>
					</div>
				))
			)}
			<div className="flex gap-3 pt-2">
				<Avatar className="h-9 w-9"><AvatarFallback className="bg-cyan-100 text-xs font-semibold text-cyan-700">PT</AvatarFallback></Avatar>
				<div className="min-w-0 flex-1">
					<Textarea value={commentDraft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Viết bình luận..." className="min-h-16 resize-none rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
					<div className="mt-2 flex justify-end">
						<Button size="sm" disabled={!commentDraft.trim() || busy} onClick={onSubmit}>
							<Send className="mr-2 h-4 w-4" /> Gửi bình luận
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

function PostFormDialog({
	open,
	title,
	description,
	form,
	groups,
	submitting,
	submitLabel,
	onOpenChange,
	onFormChange,
	onCancel,
	onSubmit,
}: {
	open: boolean;
	title: string;
	description: string;
	form: FormState;
	groups: DiscussionGroup[];
	submitting: boolean;
	submitLabel: string;
	onOpenChange: (open: boolean) => void;
	onFormChange: (form: FormState) => void;
	onCancel: () => void;
	onSubmit: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<Field label="Tiêu đề bài viết"><Input value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} /></Field>
					<Field label="Nội dung bài viết"><Textarea value={form.content} onChange={(event) => onFormChange({ ...form, content: event.target.value })} className="min-h-32 resize-none" /></Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Loại bài viết">
							<Select value={form.post_type} onValueChange={(value) => onFormChange({ ...form, post_type: value })}>
								<SelectTrigger className="h-10 w-full rounded-xl bg-background shadow-none">
									<SelectValue placeholder="Chọn loại bài viết" />
								</SelectTrigger>
								<SelectContent className="rounded-xl shadow-xl">
									{postTypes.map((type) => <SelectItem key={type.value} value={type.value} className="rounded-lg">{type.label}</SelectItem>)}
								</SelectContent>
							</Select>
						</Field>
						<Field label="Nhóm đăng bài">
							<Select value={form.group_id || undefined} onValueChange={(value) => onFormChange({ ...form, group_id: value })}>
								<SelectTrigger className="h-10 w-full rounded-xl bg-background shadow-none">
									<SelectValue placeholder="Chọn nhóm" />
								</SelectTrigger>
								<SelectContent className="rounded-xl shadow-xl">
									{groups.map((group) => <SelectItem key={group.id} value={String(group.id)} className="rounded-lg">{group.name}</SelectItem>)}
								</SelectContent>
							</Select>
						</Field>
					</div>
					<Field label="Tag chủ đề"><Input value={form.tags} onChange={(event) => onFormChange({ ...form, tags: event.target.value })} placeholder="Ví dụ: AI, RAG, Review sách" /></Field>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onCancel}>Hủy</Button>
						<Button disabled={submitting} onClick={onSubmit}>{submitLabel}</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	loading,
	onOpenChange,
	onConfirm,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	loading: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-2xl sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
					<Button variant="destructive" disabled={loading} onClick={onConfirm}>
						<Trash2 className="mr-2 h-4 w-4" /> {confirmLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="space-y-2">
			<label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
			{children}
		</div>
	);
}

function postToForm(post: DiscussionPost): FormState {
	return {
		title: post.title,
		content: post.content,
		post_type: post.post_type || "discussion",
		group_id: String(post.group_id),
		tags: post.tags || "",
	};
}

function splitTags(tags?: string | null) {
	return (tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function postTypeLabel(value: string) {
	return postTypes.find((type) => type.value === value)?.label || "Thảo luận";
}

function getInitials(name: string) {
	return name.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

function formatRelativeTime(value: string) {
	const date = new Date(value);
	const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
	if (diffMinutes < 60) return `${diffMinutes} phút trước`;
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours} giờ trước`;
	return date.toLocaleDateString("vi-VN");
}
