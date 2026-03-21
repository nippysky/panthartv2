import { notFound } from "next/navigation";

import WarpoolAdminAccessGate from "@/src/features/admin/warpool/WarpoolAdminAccessGate";
import {
  getAllowedWarpoolAdminWallets,
  isAllowedWarpoolAdminSlug,
} from "@/src/features/admin/warpool/admin-access";

type Props = {
  children: React.ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export default async function WarpoolLayout({ children, params }: Props) {
  const { slug } = await params;

  if (!isAllowedWarpoolAdminSlug(slug)) {
    notFound();
  }

  const allowedWallets = getAllowedWarpoolAdminWallets();

  return (
    <WarpoolAdminAccessGate allowedWallets={allowedWallets}>
      {children}
    </WarpoolAdminAccessGate>
  );
}