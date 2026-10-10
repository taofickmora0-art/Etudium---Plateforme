"use client";

import { useState } from "react";
import { Pagination } from "@/components/ui/Pagination";

/** Pagination compacte : « Page 2 sur 5 » à gauche des boutons. */
export function PagesDemo() {
  const [page, setPage] = useState(2);
  return <Pagination page={page} pageCount={5} onPageChange={setPage} label={`Page ${page} sur 5`} className="justify-start gap-4" />;
}
