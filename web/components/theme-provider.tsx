"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
	theme: ThemeMode;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: ThemeMode) => void;
}

interface Props {
	children: ReactNode;
	defaultTheme?: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "theme";

function getBrowserStorage() {
	if (typeof window === "undefined") return null;
	const storage = window.localStorage;
	if (
		!storage ||
		typeof storage.getItem !== "function" ||
		typeof storage.setItem !== "function"
	) {
		return null;
	}
	return storage;
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
	if (typeof window === "undefined") return "light";
	if (theme !== "system") return theme;
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function applyTheme(theme: ResolvedTheme) {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("dark", theme === "dark");
	document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({
	children,
	defaultTheme = "light",
}: Props) {
	const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const storage = getBrowserStorage();
		const savedTheme = storage?.getItem(THEME_STORAGE_KEY);
		const nextTheme =
			savedTheme === "light" || savedTheme === "dark" || savedTheme === "system"
				? savedTheme
				: defaultTheme;
		const nextResolvedTheme = resolveTheme(nextTheme);
		setThemeState(nextTheme);
		setResolvedTheme(nextResolvedTheme);
		applyTheme(nextResolvedTheme);
		setMounted(true);
	}, [defaultTheme]);

	useEffect(() => {
		if (!mounted || theme !== "system" || typeof window === "undefined") return;
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			const nextResolvedTheme = resolveTheme("system");
			setResolvedTheme(nextResolvedTheme);
			applyTheme(nextResolvedTheme);
		};
		handleChange();
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [mounted, theme]);

	const setTheme = (nextTheme: ThemeMode) => {
		setThemeState(nextTheme);
		const nextResolvedTheme = resolveTheme(nextTheme);
		setResolvedTheme(nextResolvedTheme);
		applyTheme(nextResolvedTheme);
		getBrowserStorage()?.setItem(THEME_STORAGE_KEY, nextTheme);
	};

	const value = useMemo(
		() => ({
			theme,
			resolvedTheme,
			setTheme,
		}),
		[resolvedTheme, theme],
	);

	if (!mounted) {
		return <>{children}</>;
	}

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		return {
			theme: "light" as ThemeMode,
			resolvedTheme: "light" as ResolvedTheme,
			setTheme: () => {},
		};
	}
	return context;
}
