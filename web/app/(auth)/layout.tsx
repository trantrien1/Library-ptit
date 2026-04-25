import { GuestOnly } from "@/components/providers/auth-provider";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <GuestOnly>{children}</GuestOnly>;
}
