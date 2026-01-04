// src/ui/app/header/AppHeader.tsx
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/src/ui/Container";
import { SearchBox } from "./SearchBox";
import { HeaderClient } from "./HeaderClient";

export default function AppHeader() {
  return (
   <header className="sticky top-0 z-85 border-b border-border/60 bg-background/75 backdrop-blur-md">
      <Container className="flex h-16 items-center gap-3">
        {/* Left: brand */}
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/DECENT-ICON.png"
            alt="Decentroneum"
            width={34}
            height={34}
            priority
          />
          <span className="hidden sm:inline text-sm font-semibold tracking-tight">
            Panthart
          </span>
        </Link>

        {/* Center: search (desktop only) */}
        <div className="hidden lg:flex flex-1 justify-center">
          <SearchBox />
        </div>

        {/* Right: actions */}
        <div className="ml-auto flex items-center gap-2">
          <HeaderClient />
        </div>
      </Container>

      {/* Mobile search row */}
      <div className="lg:hidden border-t border-border/60">
        <Container className="py-2">
          <SearchBox />
        </Container>
      </div>
    </header>
  );
}
