"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	BookOpen,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	FileClock,
	Info,
	LayoutDashboard,
	MessageSquareMore,
	Sparkles,
	ShoppingBasket,
	Users,
	UsersRound,
	X,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { ChatSidebarHistory } from "@/components/chat/sidebar-history";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminLinks = [
	{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/admin/platform", label: "Nền tảng số", icon: Sparkles },
	{ href: "/admin/library-info", label: "Thông tin thư viện", icon: Info },
	{
		href: "/admin/books",
		label: "Qu\u1ea3n l\u00fd s\u00e1ch",
		icon: BookOpen,
	},
	{ href: "/admin/users", label: "\u0110\u1ed9c gi\u1ea3", icon: Users },
	{ href: "/admin/borrows", label: "M\u01b0\u1ee3n tr\u1ea3", icon: FileClock },
];

const userLinks = [
	{ href: "/user/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/user/books", label: "Danh s\u00e1ch s\u00e1ch", icon: BookOpen },
	{ href: "/user/wishlist", label: "Gi\u1ecf m\u01b0\u1ee3n", icon: ShoppingBasket },
	{ href: "/user/borrows", label: "Phi\u1ebfu m\u01b0\u1ee3n", icon: FileClock },
	{ href: "/user/chatbot", label: "Chatbot AI", icon: MessageSquareMore },
	{ href: "/user/social", label: "Cộng đồng", icon: UsersRound },
	{ href: "/user/events", label: "Sự kiện & Lab", icon: CalendarDays },
	{ href: "/user/library-info", label: "Thông tin", icon: Info },
];

interface SidebarProps {
	collapsed: boolean;
	mobileOpen: boolean;
	onCollapsedChange: (collapsed: boolean) => void;
	onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
	collapsed,
	mobileOpen,
	onCollapsedChange,
	onMobileOpenChange,
}: SidebarProps) {
	const pathname = usePathname();
	const { user } = useAuth();
	const links = user?.role === "admin" ? adminLinks : userLinks;

	return (
		<>
			<div
				className={cn(
					"fixed inset-0 z-30 bg-black/45 transition-opacity duration-300 lg:hidden",
					mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				onClick={() => onMobileOpenChange(false)}
				aria-hidden="true"
			/>

			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col overflow-hidden border-r bg-card/95 shadow-2xl backdrop-blur transition-[transform,width] duration-300 ease-in-out lg:static lg:z-auto lg:shadow-sm",
					mobileOpen ? "translate-x-0" : "-translate-x-full",
					"lg:translate-x-0",
					collapsed ? "lg:w-20" : "lg:w-72",
				)}
			>
				<div className="flex h-[72px] items-center border-b px-4">
					<Link
						href={user?.role === "admin" ? "/admin/dashboard" : "/user/dashboard"}
						className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden"
						onClick={() => onMobileOpenChange(false)}
					>
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
							<LayoutDashboard className="h-5 w-5" />
						</div>
						<div
							className={cn(
								"min-w-0 max-w-40 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200",
								collapsed && "lg:pointer-events-none lg:max-w-0 lg:opacity-0",
							)}
						>
							<p className="truncate text-sm font-semibold text-muted-foreground">
								Library PTIT
							</p>
							<p className="truncate text-base font-semibold">
								{user?.role === "admin" ? "Admin Console" : "Reader Workspace"}
							</p>
						</div>
					</Link>

					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => onMobileOpenChange(false)}
						className="h-9 w-9 shrink-0 lg:hidden"
					>
						<X className="h-4 w-4" />
					</Button>

					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => onCollapsedChange(!collapsed)}
						className="hidden h-9 w-9 shrink-0 lg:inline-flex"
					>
						{collapsed ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
					</Button>
				</div>

				<nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
					<p
						className={cn(
							"px-3 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-opacity duration-200",
							collapsed && "lg:px-0 lg:text-center",
						)}
					>
						{collapsed ? "Menu" : "\u0110i\u1ec1u h\u01b0\u1edbng"}
					</p>
					{links.map((item) => {
						const Icon = item.icon;
						const active = pathname === item.href;

						return (
							<div key={item.href}>
								<Link
									href={item.href}
									className={cn(
										"group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200",
										active
											? "bg-primary text-primary-foreground shadow-sm"
											: "text-muted-foreground hover:bg-primary/5 hover:text-primary",
										collapsed && "lg:justify-center lg:px-2",
									)}
									title={collapsed ? item.label : undefined}
									onClick={() => onMobileOpenChange(false)}
								>
									<Icon className="h-4 w-4 shrink-0" />
									<span
										className={cn(
											"max-w-40 overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-200",
											collapsed && "lg:pointer-events-none lg:max-w-0 lg:opacity-0",
										)}
									>
										{item.label}
									</span>
								</Link>
								{item.href === "/user/chatbot" && active && user?.role !== "admin" ? (
									<ChatSidebarHistory collapsed={collapsed} />
								) : null}
							</div>
						);
					})}
				</nav>

				<div className="border-t p-4">
					<div
						className={cn(
							"flex items-center gap-3 rounded-2xl bg-muted/70 p-3",
							collapsed && "lg:justify-center",
						)}
					>
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
							{(user?.full_name || user?.username || "U").charAt(0).toUpperCase()}
						</div>
						<div
							className={cn(
								"min-w-0 max-w-40 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200",
								collapsed && "lg:pointer-events-none lg:max-w-0 lg:opacity-0",
							)}
						>
							<p className="truncate font-medium">{user?.full_name || user?.username}</p>
							<p className="truncate text-xs text-muted-foreground">
								{user?.role === "admin"
									? "Qu\u1ea3n tr\u1ecb vi\u00ean"
									: "\u0110\u1ed9c gi\u1ea3"}
							</p>
						</div>
					</div>
				</div>
			</aside>
		</>
	);
}
