"use client";

import { useState } from "react";

import { ProtectedRoute } from "@/components/providers/auth-provider";
import { Sidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<ProtectedRoute>
			<div className="flex min-h-screen overflow-hidden bg-muted/40">
				<Sidebar
					collapsed={collapsed}
					mobileOpen={mobileOpen}
					onCollapsedChange={setCollapsed}
					onMobileOpenChange={setMobileOpen}
				/>
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<Topbar onMenuClick={() => setMobileOpen(true)} />
					<main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
						<div className="mx-auto w-full max-w-7xl">{children}</div>
					</main>
				</div>
			</div>
		</ProtectedRoute>
	);
}
