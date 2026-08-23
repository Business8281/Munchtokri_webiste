import React from "react";
import PublicClientLayout from "@/components/layout/PublicClientLayout";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PublicClientLayout>
            {children}
        </PublicClientLayout>
    );
}
