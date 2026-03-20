// app/admin/[slug]/page.tsx
import { redirect } from "next/navigation";

export default async function CollectionAdminIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/admin/${slug}/submissions`);
}