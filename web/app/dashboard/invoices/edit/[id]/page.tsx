"use client";

import { useParams } from "next/navigation";
import InvoiceEditor from "@/components/finance/InvoiceEditor";

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  return <InvoiceEditor invoiceId={Number(params.id)} />;
}
