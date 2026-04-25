import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Library PTIT",
	description: "Frontend Next.js cho hệ thống quản lý thư viện PTIT",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="vi" suppressHydrationWarning>
			<body className={inter.className} suppressHydrationWarning>
				<Script id="strip-browser-extension-attrs" strategy="beforeInteractive">
					{`(() => {
						const attrs = ["bis_skin_checked"];
						const selector = attrs.map((attr) => "[" + attr + "]").join(",");
						const strip = (node) => {
							if (!node || node.nodeType !== 1) return;
							attrs.forEach((attr) => node.removeAttribute(attr));
							if (!selector) return;
							node.querySelectorAll(selector).forEach((element) => {
								attrs.forEach((attr) => element.removeAttribute(attr));
							});
						};
						const root = document.documentElement;
						if (!root) return;
						strip(root);
						const observer = new MutationObserver((mutations) => {
							for (const mutation of mutations) {
								if (mutation.type === "attributes" && mutation.attributeName) {
									mutation.target.removeAttribute(mutation.attributeName);
								}
								mutation.addedNodes.forEach(strip);
							}
						});
						observer.observe(root, {
							subtree: true,
							childList: true,
							attributes: true,
							attributeFilter: attrs,
						});
						window.addEventListener("load", () => observer.disconnect(), { once: true });
					})();`}
				</Script>
				<ThemeProvider defaultTheme="light">
					<AuthProvider>
						{children}
						<Toaster richColors position="top-right" />
					</AuthProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
