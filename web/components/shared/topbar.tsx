"use client";

import { AlertTriangle, Bell, LogOut, Menu, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dashboardApi } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { DashboardAlert, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const titleMap: Record<string, { title: string; description: string }> = {
	"/admin/dashboard": {
		title: "Dashboard qu\u1ea3n tr\u1ecb",
		description: "Theo d\u00f5i s\u1ed1 li\u1ec7u v\u00e0 c\u00e1c phi\u1ebfu m\u01b0\u1ee3n g\u1ea7n \u0111\u00e2y.",
	},
	"/admin/books": {
		title: "Qu\u1ea3n l\u00fd s\u00e1ch",
		description: "Th\u00eam, s\u1eeda, x\u00f3a \u0111\u1ea7u s\u00e1ch v\u00e0 c\u1eadp nh\u1eadt PDF.",
	},
	"/admin/platform": {
		title: "N\u1ec1n t\u1ea3ng s\u1ed1 th\u01b0 vi\u1ec7n",
		description: "Qu\u1ea3n tr\u1ecb social hub, digital resources, events v\u00e0 news.",
	},
	"/admin/users": {
		title: "Qu\u1ea3n l\u00fd \u0111\u1ed9c gi\u1ea3",
		description: "Ki\u1ec3m so\u00e1t t\u00e0i kho\u1ea3n ng\u01b0\u1eddi d\u00f9ng v\u00e0 quy\u1ec1n truy c\u1eadp.",
	},
	"/admin/borrows": {
		title: "Qu\u1ea3n l\u00fd m\u01b0\u1ee3n tr\u1ea3",
		description: "Duy\u1ec7t phi\u1ebfu m\u01b0\u1ee3n, gia h\u1ea1n v\u00e0 x\u00e1c nh\u1eadn tr\u1ea3 s\u00e1ch.",
	},
	"/user/dashboard": {
		title: "Dashboard",
		description: "T\u1ed5ng quan ho\u1ea1t \u0111\u1ed9ng m\u01b0\u1ee3n s\u00e1ch v\u00e0 l\u1eddi nh\u1eafc c\u1ee7a b\u1ea1n.",
	},
	"/user/books": {
		title: "Danh s\u00e1ch s\u00e1ch",
		description: "T\u00ecm ki\u1ebfm \u0111\u1ea7u s\u00e1ch, xem chi ti\u1ebft v\u00e0 th\u00eam v\u00e0o gi\u1ecf m\u01b0\u1ee3n.",
	},
	"/user/wishlist": {
		title: "Gi\u1ecf m\u01b0\u1ee3n",
		description: "Chu\u1ea9n b\u1ecb phi\u1ebfu m\u01b0\u1ee3n tr\u01b0\u1edbc khi g\u1eedi cho th\u1ee7 th\u01b0.",
	},
	"/user/borrows": {
		title: "Phi\u1ebfu m\u01b0\u1ee3n",
		description: "Theo d\u00f5i tr\u1ea1ng th\u00e1i, gia h\u1ea1n ho\u1eb7c \u0111\u00e1nh gi\u00e1 s\u00e1ch.",
	},
	"/user/chatbot": {
		title: "Chatbot AI",
		description: "H\u1ecfi \u0111\u00e1p v\u1ec1 s\u00e1ch trong th\u01b0 vi\u1ec7n PTIT.",
	},
	"/user/discovery": {
		title: "Tra c\u1ee9u & T\u00e0i nguy\u00ean s\u1ed1",
		description: "Smart Catalog, Digital Library v\u00e0 g\u1ee3i \u00fd AI.",
	},
	"/user/social": {
		title: "Library Social Hub",
		description: "Nh\u00f3m th\u1ea3o lu\u1eadn, review s\u00e1ch v\u00e0 reading challenges.",
	},
	"/user/events": {
		title: "S\u1ef1 ki\u1ec7n & Lab",
		description: "Workshop, innovation lab, tutorials v\u00e0 recorded events.",
	},
	"/user/library-info": {
		title: "Th\u00f4ng tin th\u01b0 vi\u1ec7n",
		description: "Gi\u1edd m\u1edf c\u1eeda, tin t\u1ee9c, feedback v\u00e0 volunteer.",
	},
};

interface TopbarProps {
	onMenuClick: () => void;
}

function notificationTone(severity?: string) {
	if (severity === "high") return "bg-rose-50 text-rose-600 dark:bg-rose-950/40";
	if (severity === "medium") return "bg-amber-50 text-amber-600 dark:bg-amber-950/40";
	return "bg-primary/10 text-primary";
}

function notificationHref(item: DashboardAlert, role?: UserRole) {
	return item.ctaUrl || item.url || (role === "admin" ? "/admin/dashboard" : "/user/dashboard");
}

export function Topbar({ onMenuClick }: TopbarProps) {
	const pathname = usePathname();
	const { user, logout } = useAuth();
	const [notifications, setNotifications] = useState<DashboardAlert[]>([]);
	const [notificationsLoading, setNotificationsLoading] = useState(false);
	const [notificationsError, setNotificationsError] = useState("");
	const current =
		titleMap[pathname] || {
			title: "Library PTIT",
			description: "Kh\u00f4ng gian l\u00e0m vi\u1ec7c c\u1ee7a b\u1ea1n.",
		};
	const notificationTotal = useMemo(() => {
		if (user?.role !== "admin") return notifications.length;
		return notifications.reduce((total, item) => total + (item.count || 1), 0);
	}, [notifications, user?.role]);
	const visibleNotifications = notifications.slice(0, 5);
	const notificationTitle =
		user?.role === "admin" ? "Th\u00f4ng b\u00e1o qu\u1ea3n tr\u1ecb" : "L\u1eddi nh\u1eafc & th\u00f4ng b\u00e1o";

	useEffect(() => {
		if (!user?.role) {
			setNotifications([]);
			return;
		}

		let ignore = false;
		const role = user.role;

		async function loadNotifications() {
			setNotificationsLoading(true);
			setNotificationsError("");
			try {
				if (role === "admin") {
					const overview = await dashboardApi.adminOverview();
					if (!ignore) setNotifications(overview.alerts);
				} else {
					const overview = await dashboardApi.userOverview();
					if (!ignore) setNotifications(overview.reminders);
				}
			} catch {
				if (!ignore) {
					setNotifications([]);
					setNotificationsError("Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c th\u00f4ng b\u00e1o.");
				}
			} finally {
				if (!ignore) setNotificationsLoading(false);
			}
		}

		void loadNotifications();

		return () => {
			ignore = true;
		};
	}, [user?.role]);

	return (
		<header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
			<div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<div className="flex min-w-0 items-center gap-3">
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={onMenuClick}
						className="h-10 w-10 shrink-0 lg:hidden"
					>
						<Menu className="h-4 w-4" />
					</Button>
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold text-foreground">
							{current.title}
						</p>
						<p className="truncate text-sm text-muted-foreground">
							{current.description}
						</p>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-3">
					<ThemeToggle />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="relative h-10 gap-2 rounded-full px-2 sm:px-3"
							>
								<Bell className="h-[1.2rem] w-[1.2rem]" />
								<span className="hidden text-sm font-medium sm:inline">
									{"Th\u00f4ng b\u00e1o"}
								</span>
								{notificationTotal > 0 ? (
									<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-none text-destructive-foreground">
										{notificationTotal > 99 ? "99+" : notificationTotal}
									</span>
								) : null}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[340px] p-0">
							<DropdownMenuLabel className="flex items-center justify-between gap-3 px-4 py-3">
								<span>{notificationTitle}</span>
								<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
									{notificationTotal}
								</span>
							</DropdownMenuLabel>
							<DropdownMenuSeparator className="m-0" />
							<div className="max-h-[360px] overflow-y-auto p-2">
								{notificationsLoading ? (
									<p className="px-3 py-6 text-center text-sm text-muted-foreground">
										{"\u0110ang t\u1ea3i th\u00f4ng b\u00e1o..."}
									</p>
								) : notificationsError ? (
									<p className="px-3 py-6 text-center text-sm text-muted-foreground">
										{notificationsError}
									</p>
								) : visibleNotifications.length === 0 ? (
									<p className="px-3 py-6 text-center text-sm text-muted-foreground">
										{"Ch\u01b0a c\u00f3 th\u00f4ng b\u00e1o m\u1edbi."}
									</p>
								) : (
									visibleNotifications.map((item, index) => (
										<DropdownMenuItem
											key={`${item.title}-${index}`}
											asChild
											className="cursor-pointer rounded-md p-0"
										>
											<Link
												href={notificationHref(item, user?.role)}
												className="flex w-full items-start gap-3 px-3 py-3"
											>
												<span
													className={cn(
														"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
														notificationTone(item.severity),
													)}
												>
													<AlertTriangle className="h-4 w-4" />
												</span>
												<span className="min-w-0 flex-1">
													<span className="line-clamp-1 text-sm font-medium">
														{item.title}
													</span>
													<span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
														{item.message ||
															item.ctaLabel ||
															(user?.role === "admin"
																? "Nh\u1ea5n \u0111\u1ec3 x\u1eed l\u00fd ngay"
																: "Nh\u1ea5n \u0111\u1ec3 xem chi ti\u1ebft")}
													</span>
													<span className="mt-1 block text-xs text-muted-foreground">
														{item.time ? formatDate(item.time) : item.count ? `${item.count} m\u1ee5c` : ""}
													</span>
												</span>
											</Link>
										</DropdownMenuItem>
									))
								)}
							</div>
							<DropdownMenuSeparator className="m-0" />
							<DropdownMenuItem asChild className="cursor-pointer rounded-none px-4 py-3">
								<Link href={user?.role === "admin" ? "/admin/dashboard" : "/user/dashboard"}>
									{"Xem t\u1ea5t c\u1ea3 tr\u00ean dashboard"}
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-10 rounded-full px-2">
								<Avatar className="h-8 w-8">
									<AvatarFallback>
										{(user?.full_name || user?.username || "U")
											.charAt(0)
											.toUpperCase()}
									</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-64">
							<DropdownMenuLabel className="space-y-1">
								<p className="font-medium">
									{user?.full_name || user?.username || "Ng\u01b0\u1eddi d\u00f9ng"}
								</p>
								<p className="text-xs font-normal text-muted-foreground">
									{user?.email}
								</p>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem disabled>
								<ShieldCheck className="mr-2 h-4 w-4" />
								{user?.role === "admin"
									? "Qu\u1ea3n tr\u1ecb vi\u00ean"
									: "\u0110\u1ed9c gi\u1ea3"}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={logout}>
								<LogOut className="mr-2 h-4 w-4" />
								Đăng xuất
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
