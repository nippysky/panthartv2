// app/admin/[slug]/layout.tsx
import AdminShell from "@/src/components/admin/AdminShell";
import type { ReactNode } from "react";


export default async function CollectionAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <AdminShell slug={slug}>{children}</AdminShell>;
}