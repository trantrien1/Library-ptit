"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Flame,
	Heart,
	LogOut,
	MessageCircle,
	MoreHorizontal,
	Plus,
	Search,
	Send,
	ShieldCheck,
	Trash2,
	UserPlus,
	UsersRound,
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
import type {
	CommunityLeaderboardItem,
	DiscussionGroup,
	DiscussionPost,
	DiscussionPostComment,
	SocialHubSidebar,
} from "@/lib/types";

const postTypes = [
	{ label: "Review sách", value: "review" },
	{ label: "Hỏi đáp", value: "question" },
	{ label: "Chia sẻ tài liệu", value: "resource" },
	{ label: "Thảo luận", value: "discussion" },
];

const quickFilters = [
	"Tất cả",
	"Review sách",
	"Hỏi đáp",
	"Chia sẻ tài liệu",
	"Cộng đồng AI",
	"Cybersecurity",
];

const feedTabs = [
	{ label: "Mới nhất", value: "latest" },
	{ label: "Nổi bật", value: "popular" },
	{ label: "Đang theo dõi", value: "following" },
];

const POSTS_PAGE_SIZE = 6;

type PostFormState = {
	title: string;
	content: string;
	post_type: string;
	group_id: string;
	tags: string;
};

type GroupFormState = {
	name: string;
	topic: string;
	description: string;
	requires_approval: boolean;
	rules: string;
};

const emptyPostForm: PostFormState = {
	title: "",
	content: "",
	post_type: "discussion",
	group_id: "",
	tags: "",
};

const emptyGroupForm: GroupFormState = {
	name: "",
	topic: "",
	description: "",
	requires_approval: false,
	rules: "",
};

export default function SocialHubPage() {
	const { user } = useAuth();
	const [groups, setGroups] = useState<DiscussionGroup[]>([]);
	const [posts, setPosts] = useState<DiscussionPost[]>([]);
	const [sidebar, setSidebar] = useState<SocialHubSidebar | null>(null);
	const [postOffset, setPostOffset] = useState(0);
	const [hasMorePosts, setHasMorePosts] = useState(true);
	const [loadingMorePosts, setLoadingMorePosts] = useState(false);
	const [query, setQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState("Tất cả");
	const [sort, setSort] = useState("latest");
	const [postModalOpen, setPostModalOpen] = useState(false);
	const [groupModalOpen, setGroupModalOpen] = useState(false);
	const [exploreOpen, setExploreOpen] = useState(false);
	const [postForm, setPostForm] = useState<PostFormState>(emptyPostForm);
	const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
	const [groupErrors, setGroupErrors] = useState<Partial<Record<keyof GroupFormState, string>>>({});
	const [submittingPost, setSubmittingPost] = useState(false);
	const [submittingGroup, setSubmittingGroup] = useState(false);
	const loadMoreObserver = useRef<IntersectionObserver | null>(null);

	const loadData = useCallback(async () => {
		try {
			const apiSort = sort === "following" ? "latest" : sort;
			const [groupData, postData, sidebarData] = await Promise.all([
				platformApi.groups(),
				platformApi.feed(undefined, apiSort, POSTS_PAGE_SIZE, 0),
				platformApi.socialSidebar(),
			]);
			setGroups(groupData);
			setPosts(postData);
			setPostOffset(postData.length);
			setHasMorePosts(postData.length === POSTS_PAGE_SIZE);
			setSidebar(sidebarData);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu cộng đồng");
		}
	}, [sort]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	useEffect(() => {
		return () => loadMoreObserver.current?.disconnect();
	}, []);

	const loadMorePosts = useCallback(async () => {
		if (loadingMorePosts || !hasMorePosts) return;
		setLoadingMorePosts(true);
		try {
			const apiSort = sort === "following" ? "latest" : sort;
			const nextPosts = await platformApi.feed(undefined, apiSort, POSTS_PAGE_SIZE, postOffset);
			setPosts((current) => {
				const existingIds = new Set(current.map((post) => post.id));
				return [...current, ...nextPosts.filter((post) => !existingIds.has(post.id))];
			});
			setPostOffset((current) => current + nextPosts.length);
			setHasMorePosts(nextPosts.length === POSTS_PAGE_SIZE);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tải thêm được bài viết");
		} finally {
			setLoadingMorePosts(false);
		}
	}, [hasMorePosts, loadingMorePosts, postOffset, sort]);

	const loadMoreTriggerRef = useCallback(
		(node: HTMLDivElement | null) => {
			if (loadingMorePosts) return;
			loadMoreObserver.current?.disconnect();
			loadMoreObserver.current = new IntersectionObserver(
				(entries) => {
					if (entries[0]?.isIntersecting) {
						void loadMorePosts();
					}
				},
				{ rootMargin: "240px 0px" },
			);
			if (node) loadMoreObserver.current.observe(node);
		},
		[loadMorePosts, loadingMorePosts],
	);

	const visiblePosts = useMemo(() => {
		return posts.filter((post) => {
			if (sort === "following" && !post.group?.is_member) return false;
			const searchable = [
				post.title,
				post.content,
				post.group?.name,
				post.group?.topic,
				post.tags,
				postTypeLabel(post.post_type),
			]
				.join(" ")
				.toLowerCase();
			const matchesQuery = !query.trim() || searchable.includes(query.toLowerCase());
			const matchesFilter =
				activeFilter === "Tất cả" ||
				postTypeLabel(post.post_type) === activeFilter ||
				post.group?.name === activeFilter ||
				post.group?.topic === activeFilter ||
				(post.tags || "").toLowerCase().includes(activeFilter.toLowerCase());
			return matchesQuery && matchesFilter;
		});
	}, [activeFilter, posts, query, sort]);

	const openCreatePost = (groupId?: number) => {
		setPostForm({ ...emptyPostForm, group_id: groupId ? String(groupId) : "" });
		setPostModalOpen(true);
	};

	const createPost = async () => {
		if (!postForm.group_id) {
			toast.error("Vui lòng chọn nhóm đăng bài.");
			return;
		}
		if (!postForm.title.trim() || !postForm.content.trim()) {
			toast.error("Vui lòng nhập tiêu đề và nội dung bài viết.");
			return;
		}
		const selectedGroup = groups.find((group) => group.id === Number(postForm.group_id));
		if (!selectedGroup?.is_member && selectedGroup?.group_role !== "admin") {
			toast.error(
				selectedGroup?.membership_status === "pending"
					? "Yêu cầu tham gia nhóm của bạn đang chờ duyệt."
					: "Bạn cần tham gia nhóm trước khi đăng bài.",
			);
			return;
		}
		setSubmittingPost(true);
		try {
			const created = await platformApi.createPost({
				group_id: Number(postForm.group_id),
				title: postForm.title.trim(),
				content: postForm.content.trim(),
				post_type: postForm.post_type,
				tags: postForm.tags.trim() || null,
			});
			setPosts((current) => [created, ...current]);
			setPostForm(emptyPostForm);
			setPostModalOpen(false);
			toast.success("Đã đăng bài viết");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không đăng được bài viết");
		} finally {
			setSubmittingPost(false);
		}
	};

	const createGroup = async () => {
		const errors: Partial<Record<keyof GroupFormState, string>> = {};
		if (!groupForm.name.trim()) errors.name = "Tên nhóm không được trống.";
		if (!groupForm.description.trim()) errors.description = "Mô tả nhóm không được trống.";
		setGroupErrors(errors);
		if (Object.keys(errors).length > 0) return;

		setSubmittingGroup(true);
		try {
			const created = await platformApi.createGroup({
				name: groupForm.name.trim(),
				slug: slugify(groupForm.name),
				topic: groupForm.topic.trim() || undefined,
				description: groupForm.description.trim(),
				requires_approval: groupForm.requires_approval,
				rules: groupForm.rules.trim() || null,
			});
			setGroups((current) => [created, ...current]);
			setGroupForm(emptyGroupForm);
			setGroupModalOpen(false);
			toast.success("Tạo nhóm thành công.");
			window.location.href = `/user/social/groups/${created.id}`;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tạo được nhóm");
		} finally {
			setSubmittingGroup(false);
		}
	};

	const joinGroup = async (group: DiscussionGroup) => {
		if (group.is_member || group.membership_status === "pending") return;
		try {
			const nextGroup = await platformApi.joinGroup(group.id);
			mergeGroup(nextGroup, setGroups, setSidebar);
			toast.success(nextGroup.membership_status === "pending" ? "Đã gửi yêu cầu tham gia nhóm" : "Đã tham gia nhóm");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không tham gia được nhóm");
		}
	};

	const leaveGroup = async (group: DiscussionGroup) => {
		try {
			const nextGroup = await platformApi.leaveGroup(group.id);
			mergeGroup(nextGroup, setGroups, setSidebar);
			toast.success(group.membership_status === "pending" ? "Đã hủy yêu cầu tham gia" : "Đã rời nhóm");
			await loadData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Không rời nhóm được");
		}
	};

	const featuredGroups = sidebar?.featured_groups?.length ? sidebar.featured_groups : groups.slice(0, 3);
	const managedGroups = groups.filter((group) => group.is_group_admin || group.group_role === "admin");

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
			<SocialHeader
				onCreatePost={() => openCreatePost()}
				onCreateGroup={() => setGroupModalOpen(true)}
				onExplore={() => setExploreOpen(true)}
			/>
			<SearchAndFilters
				query={query}
				activeFilter={activeFilter}
				onQueryChange={setQuery}
				onFilterChange={setActiveFilter}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]">
				<main className="min-w-0 space-y-4">
					<FeedTabs value={sort} onChange={setSort} />
					{visiblePosts.length === 0 ? (
						<EmptyFeed onCreate={() => openCreatePost()} />
					) : (
						<>
							{visiblePosts.map((post, index) => {
								const shouldLoadMore = hasMorePosts && index === Math.max(0, visiblePosts.length - 3);
								return (
									<div key={post.id} ref={shouldLoadMore ? loadMoreTriggerRef : undefined}>
										<PostCard
											post={post}
											groups={groups}
											currentUserId={user?.id || 0}
											onChanged={loadData}
											onDeleted={(postId) => setPosts((current) => current.filter((item) => item.id !== postId))}
										/>
									</div>
								);
							})}
							{loadingMorePosts ? (
								<div className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-400">
									Đang tải thêm bài viết...
								</div>
							) : null}
						</>
					)}
				</main>

				<CommunitySidebar
					groups={featuredGroups}
					managedGroups={managedGroups}
					leaderboard={sidebar?.leaderboard || []}
					onExplore={() => setExploreOpen(true)}
					onJoin={joinGroup}
					onLeave={leaveGroup}
				/>
			</div>

			<PostFormDialog
				open={postModalOpen}
				title="Tạo bài viết"
				description="Chọn nhóm đăng bài để bài viết xuất hiện trong feed chính và trang riêng của nhóm."
				form={postForm}
				groups={groups}
				submitting={submittingPost}
				submitLabel="Đăng bài"
				onOpenChange={setPostModalOpen}
				onFormChange={setPostForm}
				onCancel={() => setPostModalOpen(false)}
				onSubmit={() => void createPost()}
			/>
			<CreateGroupDialog
				open={groupModalOpen}
				form={groupForm}
				errors={groupErrors}
				submitting={submittingGroup}
				onOpenChange={setGroupModalOpen}
				onFormChange={setGroupForm}
				onCancel={() => setGroupModalOpen(false)}
				onSubmit={() => void createGroup()}
			/>
			<ExploreGroupsDialog
				open={exploreOpen}
				groups={groups}
				onOpenChange={setExploreOpen}
				onJoin={joinGroup}
				onLeave={leaveGroup}
			/>
		</div>
	);
}

function SocialHeader({
	onCreatePost,
	onCreateGroup,
	onExplore,
}: {
	onCreatePost: () => void;
	onCreateGroup: () => void;
	onExplore: () => void;
}) {
	return (
		<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
			<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
				<div className="max-w-3xl">
					<div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700 dark:bg-cyan-500/12 dark:text-cyan-300">
						<UsersRound className="h-4 w-4" />
						Cộng đồng học tập thư viện số
					</div>
					<h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-4xl">
						Library Social Hub
					</h1>
					<p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
						Kết nối bạn đọc, chia sẻ tri thức và cùng nhau xây dựng thói quen đọc.
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<Button className="gap-2" onClick={onCreatePost}>
						<Plus className="h-4 w-4" />
						Tạo bài viết
					</Button>
					<Button variant="outline" className="gap-2" onClick={onCreateGroup}>
						<Plus className="h-4 w-4" />
						Tạo nhóm
					</Button>
					<Button variant="outline" className="gap-2" onClick={onExplore}>
						<UsersRound className="h-4 w-4" />
						Khám phá nhóm
					</Button>
				</div>
			</div>
		</section>
	);
}

function SearchAndFilters({
	query,
	activeFilter,
	onQueryChange,
	onFilterChange,
}: {
	query: string;
	activeFilter: string;
	onQueryChange: (value: string) => void;
	onFilterChange: (value: string) => void;
}) {
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
			<div className="relative">
				<Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
				<Input
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder="Tìm bài viết, nhóm thảo luận, review sách..."
					className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-12 text-base text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
				/>
			</div>
			<div className="mt-4 flex gap-2 overflow-x-auto pb-1">
				{quickFilters.map((filter) => (
					<button
						key={filter}
						type="button"
						onClick={() => onFilterChange(filter)}
						className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
							activeFilter === filter
								? "border-primary bg-primary text-primary-foreground shadow-sm"
								: "border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-primary/5 hover:text-primary dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-primary/30 dark:hover:bg-primary/10 dark:hover:text-primary"
						}`}
					>
						{filter}
					</button>
				))}
			</div>
		</section>
	);
}

function FeedTabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-slate-950/72">
			<div className="flex gap-1 overflow-x-auto">
				{feedTabs.map((tab) => (
					<button
						key={tab.value}
						type="button"
						onClick={() => onChange(tab.value)}
						className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
							value === tab.value ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-primary/5 hover:text-primary dark:text-slate-300 dark:hover:bg-primary/10 dark:hover:text-primary"
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>
		</div>
	);
}

function CommunitySidebar({
	groups,
	managedGroups,
	leaderboard,
	onExplore,
	onJoin,
	onLeave,
}: {
	groups: DiscussionGroup[];
	managedGroups: DiscussionGroup[];
	leaderboard: CommunityLeaderboardItem[];
	onExplore: () => void;
	onJoin: (group: DiscussionGroup) => void;
	onLeave: (group: DiscussionGroup) => void;
}) {
	return (
		<aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
			<SidebarCard icon={<ShieldCheck className="h-5 w-5 text-amber-600" />} title="Nhóm của tôi">
				{managedGroups.length === 0 ? (
					<div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-4 text-center">
						<ShieldCheck className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" />
						<p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
							Bạn chưa quản lý nhóm nào. Hãy tạo nhóm mới để bắt đầu xây dựng cộng đồng học tập.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{managedGroups.map((group) => (
							<ManagedGroupCard key={group.id} group={group} />
						))}
					</div>
				)}
			</SidebarCard>
			<SidebarCard icon={<UsersRound className="h-5 w-5 text-cyan-600" />} title="Nhóm nổi bật" action="Xem tất cả nhóm" onAction={onExplore}>
				<div className="space-y-3">
					{groups.map((group) => (
						<GroupMiniCard key={group.id} group={group} onJoin={onJoin} onLeave={onLeave} />
					))}
				</div>
			</SidebarCard>
			<SidebarCard icon={<Flame className="h-5 w-5 text-rose-600" />} title="Bảng xếp hạng ngắn">
				<p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
					Thả tim +5 điểm, bình luận +10 điểm.
				</p>
				<div className="space-y-3">
					{leaderboard.slice(0, 5).map((item, index) => (
						<div key={item.user_id} className="flex items-center gap-3">
							<div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-sm font-semibold text-slate-600 dark:text-slate-300">
								{index + 1}
							</div>
							<Avatar className="h-9 w-9">
								<AvatarFallback className="bg-cyan-100 text-xs font-semibold text-cyan-700">
									{getInitials(item.full_name || item.username)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-slate-950 dark:text-slate-50">{item.full_name || item.username}</p>
								<p className="text-xs text-slate-500 dark:text-slate-400">{item.community_points.toLocaleString("vi-VN")} điểm cộng đồng</p>
								<p className="text-xs text-slate-400 dark:text-slate-500">
									{(item.like_count || 0).toLocaleString("vi-VN")} tim · {item.comment_count.toLocaleString("vi-VN")} bình luận
								</p>
							</div>
						</div>
					))}
				</div>
			</SidebarCard>
		</aside>
	);
}

function ManagedGroupCard({ group }: { group: DiscussionGroup }) {
	return (
		<Link
			href={`/user/social/groups/${group.id}`}
			className="block rounded-xl border border-amber-100 bg-amber-50/60 p-3 transition hover:border-amber-200 hover:bg-amber-50"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate font-semibold text-slate-950 dark:text-slate-50">{group.name}</p>
					<p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
						{(group.member_count || 0).toLocaleString("vi-VN")} thành viên · {(group.post_count || 0).toLocaleString("vi-VN")} bài viết
					</p>
				</div>
				<Badge className="shrink-0 bg-amber-100 text-amber-800 hover:bg-amber-100">Quản lý</Badge>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				{group.topic ? <Badge variant="outline" className="border-amber-200 bg-white dark:bg-slate-950/80 text-amber-800 dark:text-amber-200">{group.topic}</Badge> : null}
				{group.requires_approval ? <Badge variant="outline" className="border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-300">Cần duyệt</Badge> : null}
			</div>
		</Link>
	);
}

function GroupMiniCard({
	group,
	onJoin,
	onLeave,
}: {
	group: DiscussionGroup;
	onJoin: (group: DiscussionGroup) => void;
	onLeave: (group: DiscussionGroup) => void;
}) {
	return (
		<div className="rounded-xl border border-slate-100 dark:border-white/10 p-3 transition hover:border-cyan-200 hover:bg-cyan-50/40 dark:hover:border-cyan-500/30 dark:hover:bg-cyan-500/8">
			<div className="flex items-start justify-between gap-3">
				<Link href={`/user/social/groups/${group.id}`} className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-semibold text-slate-950 dark:text-slate-50 hover:text-cyan-700 dark:hover:text-cyan-300">{group.name}</p>
						{group.is_group_admin ? (
							<Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Quản trị viên</Badge>
						) : null}
					</div>
					<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{(group.member_count || 0).toLocaleString("vi-VN")} thành viên</p>
				</Link>
				<GroupActionButton group={group} onJoin={onJoin} onLeave={onLeave} />
			</div>
			<p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{group.description}</p>
		</div>
	);
}

function GroupActionButton({
	group,
	onJoin,
	onLeave,
}: {
	group: DiscussionGroup;
	onJoin: (group: DiscussionGroup) => void;
	onLeave: (group: DiscussionGroup) => void;
}) {
	if (group.is_group_admin) {
		return (
			<Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
				<ShieldCheck className="h-3.5 w-3.5" />
				Admin
			</Badge>
		);
	}
	if (group.membership_status === "pending") {
		return (
			<Button size="sm" variant="secondary" className="h-8 gap-1" onClick={() => onLeave(group)}>
				Hủy yêu cầu
			</Button>
		);
	}
	if (group.is_member) {
		return (
			<Button size="sm" variant="secondary" className="h-8 gap-1" onClick={() => onLeave(group)}>
				<LogOut className="h-3.5 w-3.5" />
				Rời
			</Button>
		);
	}
	return (
		<Button size="sm" className="h-8 gap-1" onClick={() => onJoin(group)}>
			<UserPlus className="h-3.5 w-3.5" />
			Tham gia
		</Button>
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
	const [editForm, setEditForm] = useState<PostFormState>(() => postToForm(post));
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
		if (!editForm.group_id || !editForm.title.trim() || !editForm.content.trim()) {
			toast.error("Vui lòng nhập đầy đủ nhóm, tiêu đề và nội dung.");
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
		<article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:hover:bg-slate-950/80">
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
					<Link href={`/user/social/groups/${post.group_id}`} className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:underline">
						<UsersRound className="h-4 w-4" />
						{post.group?.name || "Cộng đồng thư viện"}
					</Link>
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
				<Badge variant="outline" className="border-cyan-100 bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
					{postTypeLabel(post.post_type)}
				</Badge>
				{splitTags(post.tags).map((tag) => (
					<Badge key={tag} variant="outline" className="border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300">
						{tag}
					</Badge>
				))}
			</div>

			<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-white/10 pt-4">
				<div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
					<span>{likeCount} lượt thích</span>
					<button type="button" className="hover:text-slate-950 dark:hover:text-slate-50" onClick={() => void loadComments()}>
						{commentCount} bình luận
					</button>
				</div>
				<div className="flex flex-wrap gap-1">
					<Button variant="ghost" size="sm" disabled={busy === "like"} onClick={() => void toggleLike()} className={liked ? "gap-2 text-red-600 hover:text-red-700" : "gap-2 text-slate-600 dark:text-slate-300"}>
						<Heart className={`h-4 w-4 ${liked ? "fill-red-600" : ""}`} />
						Thích
					</Button>
					<Button variant="ghost" size="sm" className="gap-2 text-slate-600 dark:text-slate-300" onClick={() => void loadComments()}>
						<MessageCircle className="h-4 w-4" />
						Bình luận
					</Button>
				</div>
			</div>

			{commentsOpen ? (
				<CommentSection
					comments={comments}
					commentDraft={commentDraft}
					busy={busy === "comment"}
					onDraftChange={setCommentDraft}
					onSubmit={() => void submitComment()}
				/>
			) : null}

			<PostFormDialog
				open={editing}
				title="Sửa bài viết"
				description="Cập nhật nội dung, loại bài viết, nhóm đăng và tag chủ đề."
				form={editForm}
				groups={groups}
				submitting={busy === "edit"}
				submitLabel="Lưu thay đổi"
				onOpenChange={setEditing}
				onFormChange={setEditForm}
				onCancel={() => setEditing(false)}
				onSubmit={() => void updatePost()}
			/>

			<ConfirmDialog
				open={deleting}
				title="Bạn có chắc chắn muốn xóa bài viết này không?"
				description="Bài viết sẽ biến mất khỏi feed chính và trang nhóm."
				confirmLabel="Xóa"
				loading={busy === "delete"}
				onOpenChange={setDeleting}
				onConfirm={() => void deletePost()}
			/>
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
							<AvatarFallback className="bg-cyan-100 text-xs font-semibold text-cyan-700">
								{getInitials(comment.user?.full_name || comment.user?.username || "Bạn đọc")}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 rounded-xl bg-white dark:bg-slate-900/80 px-3 py-2 shadow-sm">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
									{comment.user?.full_name || comment.user?.username || "Bạn đọc"}
								</p>
								<span className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</span>
							</div>
							<p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{comment.content}</p>
						</div>
					</div>
				))
			)}
			<div className="flex gap-3 pt-2">
				<Avatar className="h-9 w-9">
					<AvatarFallback className="bg-cyan-100 text-xs font-semibold text-cyan-700">PT</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<Textarea
						value={commentDraft}
						onChange={(event) => onDraftChange(event.target.value)}
						placeholder="Viết bình luận..."
						className="min-h-16 resize-none rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500"
					/>
					<div className="mt-2 flex justify-end">
						<Button size="sm" disabled={!commentDraft.trim() || busy} onClick={onSubmit}>
							<Send className="mr-2 h-4 w-4" />
							Gửi bình luận
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
	form: PostFormState;
	groups: DiscussionGroup[];
	submitting: boolean;
	submitLabel: string;
	onOpenChange: (open: boolean) => void;
	onFormChange: (form: PostFormState) => void;
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
					<Field label="Tiêu đề bài viết">
						<Input value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} />
					</Field>
					<Field label="Nội dung bài viết">
						<Textarea value={form.content} onChange={(event) => onFormChange({ ...form, content: event.target.value })} className="min-h-32 resize-none" />
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Loại bài viết">
							<Select value={form.post_type} onValueChange={(value) => onFormChange({ ...form, post_type: value })}>
								<SelectTrigger className="h-10 w-full rounded-xl bg-background shadow-none">
									<SelectValue placeholder="Chọn loại bài viết" />
								</SelectTrigger>
								<SelectContent className="rounded-xl shadow-xl">
								{postTypes.map((type) => (
									<SelectItem key={type.value} value={type.value} className="rounded-lg">
										{type.label}
									</SelectItem>
								))}
								</SelectContent>
							</Select>
						</Field>
						<Field label="Chọn nhóm đăng bài">
							<Select value={form.group_id || undefined} onValueChange={(value) => onFormChange({ ...form, group_id: value })}>
								<SelectTrigger className="h-10 w-full rounded-xl bg-background shadow-none">
									<SelectValue placeholder="Chọn nhóm" />
								</SelectTrigger>
								<SelectContent className="rounded-xl shadow-xl">
								{groups.map((group) => (
									<SelectItem key={group.id} value={String(group.id)} className="rounded-lg">
										{group.name}
										{group.membership_status === "pending" ? " (đang chờ duyệt)" : ""}
									</SelectItem>
								))}
								</SelectContent>
							</Select>
						</Field>
					</div>
					<Field label="Tag chủ đề">
						<Input value={form.tags} onChange={(event) => onFormChange({ ...form, tags: event.target.value })} placeholder="Ví dụ: AI, RAG, Review sách" />
					</Field>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onCancel}>
							Hủy
						</Button>
						<Button disabled={submitting} onClick={onSubmit}>
							{submitLabel}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function CreateGroupDialog({
	open,
	form,
	errors,
	submitting,
	onOpenChange,
	onFormChange,
	onCancel,
	onSubmit,
}: {
	open: boolean;
	form: GroupFormState;
	errors: Partial<Record<keyof GroupFormState, string>>;
	submitting: boolean;
	onOpenChange: (open: boolean) => void;
	onFormChange: (form: GroupFormState) => void;
	onCancel: () => void;
	onSubmit: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Tạo nhóm mới</DialogTitle>
					<DialogDescription>Tạo cộng đồng học tập theo chủ đề. Bạn sẽ là quản trị viên của nhóm này.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<Field label="Tên nhóm" error={errors.name}>
						<Input value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} />
					</Field>
					<Field label="Tag/chủ đề nhóm">
						<Input value={form.topic} onChange={(event) => onFormChange({ ...form, topic: event.target.value })} placeholder="Ví dụ: AI, Cybersecurity, CodePTIT" />
					</Field>
					<Field label="Mô tả nhóm" error={errors.description}>
						<Textarea value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} className="min-h-24 resize-none" />
					</Field>
					<Field label="Quy định nhóm">
						<Textarea value={form.rules} onChange={(event) => onFormChange({ ...form, rules: event.target.value })} className="min-h-20 resize-none" />
					</Field>
					<label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-3 text-sm text-slate-700 dark:text-slate-200">
						<input
							type="checkbox"
							checked={form.requires_approval}
							onChange={(event) => onFormChange({ ...form, requires_approval: event.target.checked })}
							className="h-4 w-4 rounded border-slate-300 dark:border-white/15 dark:bg-slate-900/70"
						/>
						Yêu cầu duyệt thành viên trước khi tham gia
					</label>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onCancel}>
							Hủy
						</Button>
						<Button disabled={submitting} onClick={onSubmit}>
							Tạo nhóm
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ExploreGroupsDialog({
	open,
	groups,
	onOpenChange,
	onJoin,
	onLeave,
}: {
	open: boolean;
	groups: DiscussionGroup[];
	onOpenChange: (open: boolean) => void;
	onJoin: (group: DiscussionGroup) => void;
	onLeave: (group: DiscussionGroup) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Khám phá nhóm</DialogTitle>
					<DialogDescription>Chọn cộng đồng phù hợp để theo dõi thảo luận, hỏi đáp và chia sẻ tài liệu.</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					{groups.map((group) => (
						<div key={group.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/40 dark:hover:border-cyan-500/30 dark:hover:bg-cyan-500/8 sm:flex-row sm:items-start sm:justify-between">
							<Link href={`/user/social/groups/${group.id}`} className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-semibold text-slate-950 hover:text-cyan-700 dark:text-slate-50 dark:hover:text-cyan-300">{group.name}</p>
									{group.requires_approval ? <Badge variant="outline">Cần duyệt</Badge> : null}
									{group.is_group_admin ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Quản trị viên</Badge> : null}
								</div>
								<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{(group.member_count || 0).toLocaleString("vi-VN")} thành viên</p>
								<p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{group.description}</p>
							</Link>
							<GroupActionButton group={group} onJoin={onJoin} onLeave={onLeave} />
						</div>
					))}
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
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Hủy
					</Button>
					<Button variant="destructive" disabled={loading} onClick={onConfirm}>
						<Trash2 className="mr-2 h-4 w-4" />
						{confirmLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SidebarCard({
	icon,
	title,
	action,
	onAction,
	children,
}: {
	icon: ReactNode;
	title: string;
	action?: string;
	onAction?: () => void;
	children: ReactNode;
}) {
	return (
		<Card className="rounded-2xl border-slate-200 dark:border-white/10 shadow-sm dark:bg-slate-950/72">
			<CardContent className="p-4">
				<div className="mb-4 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						{icon}
						<h3 className="font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
					</div>
					{action ? (
						<button type="button" onClick={onAction} className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
							{action}
						</button>
					) : null}
				</div>
				{children}
			</CardContent>
		</Card>
	);
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
	return (
		<div className="space-y-2">
			<label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
			{children}
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
		</div>
	);
}

function EmptyFeed({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/72 p-10 text-center">
			<MessageCircle className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
			<p className="mt-4 font-semibold text-slate-950 dark:text-slate-50">Chưa có bài viết phù hợp</p>
			<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Hãy bắt đầu một cuộc thảo luận mới cho cộng đồng.</p>
			<Button className="mt-4" onClick={onCreate}>
				Tạo bài viết
			</Button>
		</div>
	);
}

function mergeGroup(
	nextGroup: DiscussionGroup,
	setGroups: (updater: (current: DiscussionGroup[]) => DiscussionGroup[]) => void,
	setSidebar: (updater: (current: SocialHubSidebar | null) => SocialHubSidebar | null) => void,
) {
	setGroups((current) => current.map((item) => (item.id === nextGroup.id ? nextGroup : item)));
	setSidebar((current) =>
		current
			? {
					...current,
					featured_groups: current.featured_groups.map((item) => (item.id === nextGroup.id ? nextGroup : item)),
				}
			: current,
	);
}

function postToForm(post: DiscussionPost): PostFormState {
	return {
		title: post.title,
		content: post.content,
		post_type: post.post_type || "discussion",
		group_id: String(post.group_id),
		tags: post.tags || "",
	};
}

function splitTags(tags?: string | null) {
	return (tags || "")
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function postTypeLabel(value: string) {
	return postTypes.find((type) => type.value === value)?.label || "Thảo luận";
}

function getInitials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(-2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

function formatRelativeTime(value: string) {
	const date = new Date(value);
	const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
	if (diffMinutes < 60) return `${diffMinutes} phút trước`;
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours} giờ trước`;
	return date.toLocaleDateString("vi-VN");
}

function slugify(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
}
