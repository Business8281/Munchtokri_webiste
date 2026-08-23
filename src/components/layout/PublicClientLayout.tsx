"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/layout/Navbar/Navbar";
import Footer from "@/components/layout/Footer/Footer";

export default function PublicClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/login";
    const isDashboardPage = pathname.startsWith("/dashboard");

    return (
        <>
            {!isLoginPage && <Navbar />}
            <div style={{ paddingTop: isLoginPage ? 0 : (pathname === '/' ? '0' : '80px') }}>
                {children}
            </div>
            {!isLoginPage && !isDashboardPage && <Footer />}
        </>
    );
}
