"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FilePlus2,
  PackageSearch,
  Plus,
  Trash2,
} from "lucide-react";
import { getCustomers, type Customer } from "@/api/customersApi";
import { getProducts } from "@/api/productsApi";
import {
  createInvoice,
  getInvoice,
  updateInvoice,
  type InvoiceItemPayload,
} from "@/api/invoicesApi";
import type { Product } from "@/types/entities";
import { useAuthSession } from "@/stores/auth-store";
import { CustomerPickerModal } from "@/components/quotes/CustomerPickerModal";
import { ServicePickerModal } from "@/components/quotes/ServicePickerModal";
import { formatInr } from "@/utils/finance";

type InvoiceItemDraft = InvoiceItemPayload;
type RateMode = "AMOUNT" | "PERCENTAGE";

const DRAFT_KEY = "invoice-editor-draft";
const PAYMENT_METHODS = [
  "Bank Transfer",
  "Card",
  "Cash",
  "Check",
  "Online",
  "UPI",
  "Wallet",
  "Other",
] as const;

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateAfterDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return dateInputValue(result);
}

function emptyItem(): InvoiceItemDraft {
  return {
    name: "",
    unit: "Unit",
    type: "SERVICE",
    quantity: 1,
    price: 0,
    taxRate: 0,
  };
}

function normalizeItem(item: {
  name?: string | null;
  productId?: number | null;
  description?: string | null;
  unit?: string | null;
  type?: string | null;
  quantity?: number | null;
  price?: number | null;
  discountAmount?: number | null;
  taxRate?: number | null;
}): InvoiceItemDraft {
  return {
    name: item.name ?? "",
    productId: item.productId ?? undefined,
    description: item.description ?? "",
    unit: item.unit ?? "Unit",
    type: item.type === "GOODS" ? "GOODS" : "SERVICE",
    quantity: item.quantity ?? 1,
    price: item.price ?? 0,
    discountAmount: item.discountAmount ?? 0,
    taxRate: item.taxRate ?? 0,
  };
}

export default function InvoiceEditor({ invoiceId }: { invoiceId?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useAuthSession();
  const canCreateProduct =
    session.isSuperAdmin ||
    session.role === "ADMIN" ||
    session.permissions.includes("product.create");
  const canEditProduct =
    session.isSuperAdmin ||
    session.isPlatformAdmin ||
    session.role === "ADMIN" ||
    session.permissions.includes("product.update");
  const createdCustomerId = searchParams.get("createdCustomerId");
  const issueDateDefault = dateInputValue(new Date());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [issueDate, setIssueDate] = useState(issueDateDefault);
  const [dueDate, setDueDate] = useState(dateAfterDays(new Date(), 30));
  const [status, setStatus] = useState("DRAFT");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [templateKey, setTemplateKey] = useState("minimal");
  const [notes, setNotes] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [discountType, setDiscountType] = useState<RateMode>("AMOUNT");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountRate, setDiscountRate] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<RateMode>("AMOUNT");
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentRate, setAdjustmentRate] = useState(0);
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [tdsRate, setTdsRate] = useState(0);
  const [tcsEnabled, setTcsEnabled] = useState(false);
  const [tcsRate, setTcsRate] = useState(0);
  const [items, setItems] = useState<InvoiceItemDraft[]>([emptyItem()]);
  const [existingInvoiceHasItems, setExistingInvoiceHasItems] = useState(false);
  const [existingInvoiceHasPayments, setExistingInvoiceHasPayments] =
    useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [productModalIndex, setProductModalIndex] = useState<number | null>(
    null,
  );
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getCustomers(), getProducts()])
      .then(([customerRows, productRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setProducts(productRows);
      })
      .catch((loadError: unknown) => {
        if (active)
          setMetadataError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load customers and items.",
          );
      })
      .finally(() => {
        if (active) setMetadataLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (invoiceId) {
      getInvoice(invoiceId)
        .then((invoice) => {
          setInvoiceNo(invoice.invoiceNo);
          setName(invoice.name ?? "");
          setCustomerId(invoice.customerId ? String(invoice.customerId) : "");
          const savedAddress =
            invoice.customerAddress ??
            (invoice.customerRecord
              ? [
                  invoice.customerRecord.addressLine1,
                  invoice.customerRecord.addressLine2,
                  invoice.customerRecord.city,
                  invoice.customerRecord.state,
                  invoice.customerRecord.zipCode,
                ]
                  .filter(Boolean)
                  .join(", ")
              : "");
          setCustomerAddress(savedAddress);
          setClientEmail(
            invoice.clientEmail ?? invoice.customerRecord?.email ?? "",
          );
          setIssueDate(invoice.issueDate?.slice(0, 10) ?? issueDateDefault);
          setDueDate(
            invoice.dueDate?.slice(0, 10) ?? dateAfterDays(new Date(), 30),
          );
          setStatus(invoice.status === "DRAFT" ? "DRAFT" : "ISSUED");
          setPaymentMethod(invoice.paymentMethod ?? "");
          setTemplateKey(invoice.templateKey ?? "minimal");
          setExistingInvoiceHasItems(Boolean(invoice.items?.length));
          setExistingInvoiceHasPayments(Boolean(invoice.payments?.length));
          setNotes(invoice.notes ?? "");
          setTermsAndConditions(invoice.termsAndConditions ?? "");
          setDiscountType(invoice.discountType ?? "AMOUNT");
          setDiscountAmount(invoice.discount ?? 0);
          setDiscountRate(invoice.discountRate ?? 0);
          setAdjustmentType(invoice.adjustmentType ?? "AMOUNT");
          setAdjustmentAmount(invoice.adjustmentAmount ?? 0);
          setAdjustmentRate(invoice.adjustmentRate ?? 0);
          setTdsEnabled(invoice.tdsEnabled ?? false);
          setTdsRate(invoice.tdsRate ?? 0);
          setTcsEnabled(invoice.tcsEnabled ?? false);
          setTcsRate(invoice.tcsRate ?? 0);
          if (invoice.items?.length) {
            setItems(invoice.items.map((item) => normalizeItem(item)));
          } else {
            const fallbackSubtotal = Math.max(
              0,
              invoice.subtotal ??
                invoice.totalAmount - invoice.taxAmount + invoice.discount,
            );
            const fallbackTaxRate =
              fallbackSubtotal > 0
                ? (invoice.taxAmount / fallbackSubtotal) * 100
                : 0;
            setItems([
              {
                ...emptyItem(),
                name: invoice.name || "Invoice total",
                price: fallbackSubtotal,
                taxRate: fallbackTaxRate,
              },
            ]);
          }
        })
        .catch((loadError: unknown) =>
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load invoice.",
          ),
        )
        .finally(() => setLoading(false));
      return;
    }

    if (!draftRestored) {
      try {
        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved) as Record<string, unknown>;
          if (typeof draft.invoiceNo === "string")
            setInvoiceNo(draft.invoiceNo);
          else
            setInvoiceNo(
              `INV-${dateInputValue(new Date()).replaceAll("-", "")}-${String(Date.now()).slice(-6)}`,
            );
          if (typeof draft.name === "string") setName(draft.name);
          if (typeof draft.customerId === "string")
            setCustomerId(draft.customerId);
          if (typeof draft.customerAddress === "string")
            setCustomerAddress(draft.customerAddress);
          if (typeof draft.clientEmail === "string")
            setClientEmail(draft.clientEmail);
          if (typeof draft.issueDate === "string")
            setIssueDate(draft.issueDate);
          if (typeof draft.dueDate === "string") setDueDate(draft.dueDate);
          if (typeof draft.paymentMethod === "string")
            setPaymentMethod(draft.paymentMethod);
          if (typeof draft.notes === "string") setNotes(draft.notes);
          if (typeof draft.termsAndConditions === "string")
            setTermsAndConditions(draft.termsAndConditions);
          if (typeof draft.discountType === "string")
            setDiscountType(draft.discountType as RateMode);
          if (typeof draft.discountAmount === "number")
            setDiscountAmount(draft.discountAmount);
          if (typeof draft.discountRate === "number")
            setDiscountRate(draft.discountRate);
          if (typeof draft.adjustmentType === "string")
            setAdjustmentType(draft.adjustmentType as RateMode);
          if (typeof draft.adjustmentAmount === "number")
            setAdjustmentAmount(draft.adjustmentAmount);
          if (typeof draft.adjustmentRate === "number")
            setAdjustmentRate(draft.adjustmentRate);
          if (typeof draft.tdsEnabled === "boolean")
            setTdsEnabled(draft.tdsEnabled);
          if (typeof draft.tdsRate === "number") setTdsRate(draft.tdsRate);
          if (typeof draft.tcsEnabled === "boolean")
            setTcsEnabled(draft.tcsEnabled);
          if (typeof draft.tcsRate === "number") setTcsRate(draft.tcsRate);
          if (typeof draft.templateKey === "string")
            setTemplateKey(draft.templateKey);
          if (typeof draft.status === "string") setStatus(draft.status);
          if (Array.isArray(draft.items))
            setItems(
              draft.items.map((item) =>
                normalizeItem(item as Partial<InvoiceItemDraft>),
              ),
            );
          sessionStorage.removeItem(DRAFT_KEY);
        } else {
          setInvoiceNo(
            `INV-${dateInputValue(new Date()).replaceAll("-", "")}-${String(Date.now()).slice(-6)}`,
          );
        }
      } catch {
        sessionStorage.removeItem(DRAFT_KEY);
      }
      setDraftRestored(true);
    }
  }, [createdCustomerId, draftRestored, invoiceId, issueDateDefault]);

  useEffect(() => {
    if (!draftRestored || !createdCustomerId || metadataLoading) return;
    const customer = customers.find(
      (entry) => entry.id === Number(createdCustomerId),
    );
    if (!customer) return;
    selectCustomer(customer);
    router.replace("/dashboard/invoices/add");
  }, [createdCustomerId, customers, draftRestored, metadataLoading, router]);

  const grossSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [items],
  );
  const lineDiscount = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Math.min(item.quantity * item.price, item.discountAmount ?? 0),
        0,
      ),
    [items],
  );
  const subtotal = Math.max(0, grossSubtotal - lineDiscount);
  const documentDiscount =
    discountType === "PERCENTAGE"
      ? (subtotal * discountRate) / 100
      : Math.min(subtotal, discountAmount);
  const taxTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          (Math.max(
            0,
            item.quantity * item.price - (item.discountAmount ?? 0),
          ) *
            (item.taxRate ?? 0)) /
            100,
        0,
      ),
    [items],
  );
  const taxableSubtotal = Math.max(0, subtotal - documentDiscount);
  const tdsAmount = tdsEnabled ? (taxableSubtotal * tdsRate) / 100 : 0;
  const tcsAmount = tcsEnabled ? (taxableSubtotal * tcsRate) / 100 : 0;
  const adjustmentTotal =
    adjustmentType === "PERCENTAGE"
      ? (taxableSubtotal * adjustmentRate) / 100
      : adjustmentAmount;
  const totalAmount =
    taxableSubtotal + taxTotal + tcsAmount - tdsAmount + adjustmentTotal;

  function setItem(
    index: number,
    field: keyof InvoiceItemDraft,
    value: string | number,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function selectCustomer(customer: Customer) {
    setCustomerId(String(customer.id));
    setClientEmail(customer.email ?? "");
    setCustomerAddress(
      [
        customer.addressLine1,
        customer.addressLine2,
        customer.city,
        customer.state,
        customer.zipCode,
      ]
        .filter(Boolean)
        .join(", "),
    );
    setCustomers((current) =>
      current.some((entry) => entry.id === customer.id)
        ? current
        : [...current, customer],
    );
    setCustomerModalOpen(false);
  }

  function selectProduct(index: number, product: Product) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productId: product.id,
              name: product.name,
              description: product.description ?? "",
              unit: product.unit,
              type: product.type,
              price: product.price,
              taxRate: product.taxRate ?? 0,
            }
          : item,
      ),
    );
    setProductModalIndex(null);
  }

  function updateCatalogProduct(product: Product) {
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? product : item)),
    );
  }

  function openNewCustomer() {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        invoiceNo,
        name,
        customerId,
        customerAddress,
        clientEmail,
        issueDate,
        dueDate,
        status,
        paymentMethod,
        templateKey,
        notes,
        termsAndConditions,
        discountType,
        discountAmount,
        discountRate,
        adjustmentType,
        adjustmentAmount,
        adjustmentRate,
        tdsEnabled,
        tdsRate,
        tcsEnabled,
        tcsRate,
        items,
      }),
    );
    setCustomerModalOpen(false);
    router.push(
      "/dashboard/customers/add?returnTo=%2Fdashboard%2Finvoices%2Fadd",
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!invoiceNo.trim()) return setError("Invoice number is required.");
    if (!customerId)
      return setError("Select a customer before saving the invoice.");
    if (!issueDate || !dueDate)
      return setError("Provide both the issue date and due date.");
    if (items.some((item) => !item.name.trim()))
      return setError("Each invoice line item needs a name.");
    if (new Date(dueDate).getTime() < new Date(issueDate).getTime())
      return setError("Due date cannot be earlier than issue date.");

    const payload = {
      invoiceNo: invoiceNo.trim(),
      name: name.trim() || undefined,
      customerId: Number(customerId),
      customer: customers.find((customer) => customer.id === Number(customerId))
        ?.customerName,
      customerAddress: customerAddress || undefined,
      clientEmail: clientEmail.trim() || undefined,
      issueDate,
      dueDate,
      status: status === "DRAFT" || status === "ISSUED" ? status : undefined,
      paymentMethod: paymentMethod || undefined,
      templateKey,
      notes: notes || undefined,
      termsAndConditions: termsAndConditions || undefined,
      discountType,
      discountAmount:
        discountType === "AMOUNT" ? Number(discountAmount) : undefined,
      discountRate:
        discountType === "PERCENTAGE" ? Number(discountRate) : undefined,
      adjustmentType,
      adjustmentAmount:
        adjustmentType === "AMOUNT" ? Number(adjustmentAmount) : undefined,
      adjustmentRate:
        adjustmentType === "PERCENTAGE" ? Number(adjustmentRate) : undefined,
      tdsEnabled,
      tdsRate: tdsEnabled ? Number(tdsRate) : 0,
      tcsEnabled,
      tcsRate: tcsEnabled ? Number(tcsRate) : 0,
      ...(!(invoiceId && existingInvoiceHasPayments && !existingInvoiceHasItems)
        ? {
            items: items.map((item) => ({
              ...item,
              name: item.name.trim(),
              quantity: Number(item.quantity),
              price: Number(item.price),
              discountAmount: Number(item.discountAmount ?? 0),
              taxRate: Number(item.taxRate ?? 0),
            })),
          }
        : {}),
    };

    setSaving(true);
    try {
      if (invoiceId) await updateInvoice(invoiceId, payload);
      else await createInvoice(payload);
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(
        invoiceId ? `/dashboard/invoices/${invoiceId}` : "/dashboard/invoices",
      );
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save invoice.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="p-6 text-sm text-slate-500">Loading invoice…</div>;

  const selectedCustomer = customers.find(
    (customer) => customer.id === Number(customerId),
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex items-start gap-3 border-b border-slate-200 pb-5">
        <Link
          href="/dashboard/invoices"
          aria-label="Back to invoices"
          className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
            Accounts receivable
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            {invoiceId ? "Edit invoice" : "New invoice"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create an itemized invoice with clear billing dates and payment
            terms.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="grid gap-5 border-b border-slate-200 pb-7 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Invoice number
            </span>
            <input
              required
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
              placeholder="INV-2026-001"
              className="h-10 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title{" "}
              <span className="font-normal normal-case text-slate-400">
                (optional)
              </span>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project or service name"
              className="h-10 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customer
            </span>
            <button
              type="button"
              onClick={() => setCustomerModalOpen(true)}
              className="h-10 w-full truncate rounded-md border border-slate-200 px-3 text-left text-slate-700 hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-100"
            >
              {selectedCustomer?.customerName ?? "Choose a customer"}
            </button>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Billing email
            </span>
            <input
              type="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              placeholder="billing@example.com"
              className="h-10 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Issue date
            </span>
            <input
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Due date
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </span>
            {status === "DRAFT" || status === "ISSUED" ? (
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 outline-none focus:border-orange-400"
              >
                <option value="DRAFT">Draft</option>
                <option value="ISSUED">Issued</option>
              </select>
            ) : (
              <p className="flex h-10 items-center text-sm font-medium text-slate-700">
                {status.replaceAll("_", " ")}
              </p>
            )}
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment method
            </span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 outline-none focus:border-orange-400"
            >
              <option value="">Not set</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Billing address
            </span>
            <input
              value={customerAddress}
              onChange={(event) => setCustomerAddress(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-orange-400"
            />
          </label>
        </section>

        <section className="border-b border-slate-200 pb-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Items</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add catalog products or enter custom line items.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setItems((current) => [...current, emptyItem()])}
              aria-label="Add invoice item"
              title="Add invoice item"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {items.map((item, index) => (
              <div
                key={`${index}-${item.productId ?? "custom"}`}
                className="grid gap-3 py-4 md:grid-cols-[minmax(180px,2fr)_90px_120px_120px_40px] md:items-end"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor={`invoice-item-${index}`}
                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Description
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id={`invoice-item-${index}`}
                      value={item.name}
                      onChange={(event) =>
                        setItem(index, "name", event.target.value)
                      }
                      placeholder="Service or product"
                      className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 outline-none focus:border-orange-400"
                    />
                    <button
                      type="button"
                      onClick={() => setProductModalIndex(index)}
                      aria-label="Choose catalog item"
                      title="Choose catalog item"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      <PackageSearch size={16} />
                    </button>
                  </div>
                  <input
                    value={item.description ?? ""}
                    onChange={(event) =>
                      setItem(index, "description", event.target.value)
                    }
                    placeholder="Additional detail (optional)"
                    className="h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-orange-400"
                  />
                </div>
                <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      setItem(index, "quantity", Number(event.target.value))
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-2 text-sm font-normal text-slate-800"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(event) =>
                      setItem(index, "price", Number(event.target.value))
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-2 text-sm font-normal text-slate-800"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tax %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.taxRate ?? 0}
                    onChange={(event) =>
                      setItem(index, "taxRate", Number(event.target.value))
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-2 text-sm font-normal text-slate-800"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) =>
                      current.length === 1
                        ? [emptyItem()]
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label="Remove invoice item"
                  title="Remove invoice item"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 size={16} />
                </button>
                <div className="md:col-start-2 md:col-span-3 md:text-right">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                    Line discount{" "}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discountAmount ?? 0}
                      onChange={(event) =>
                        setItem(
                          index,
                          "discountAmount",
                          Number(event.target.value),
                        )
                      }
                      className="h-8 w-28 rounded-md border border-slate-200 px-2 text-right text-sm text-slate-800"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="ml-auto mt-5 grid max-w-xl gap-2 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <label className="text-slate-600">
              Discount{" "}
              <select
                value={discountType}
                onChange={(event) =>
                  setDiscountType(event.target.value as RateMode)
                }
                className="ml-2 h-9 rounded-md border border-slate-200 bg-white px-2"
              >
                <option value="AMOUNT">Amount</option>
                <option value="PERCENTAGE">Percent</option>
              </select>
            </label>
            <input
              aria-label="Invoice discount"
              type="number"
              min="0"
              step="0.01"
              value={discountType === "AMOUNT" ? discountAmount : discountRate}
              onChange={(event) =>
                discountType === "AMOUNT"
                  ? setDiscountAmount(Number(event.target.value))
                  : setDiscountRate(Number(event.target.value))
              }
              className="h-9 w-32 rounded-md border border-slate-200 px-2 text-right"
            />
            <label className="text-slate-600">
              Adjustment{" "}
              <select
                value={adjustmentType}
                onChange={(event) =>
                  setAdjustmentType(event.target.value as RateMode)
                }
                className="ml-2 h-9 rounded-md border border-slate-200 bg-white px-2"
              >
                <option value="AMOUNT">Amount</option>
                <option value="PERCENTAGE">Percent</option>
              </select>
            </label>
            <input
              aria-label="Invoice adjustment"
              type="number"
              min="0"
              step="0.01"
              value={
                adjustmentType === "AMOUNT" ? adjustmentAmount : adjustmentRate
              }
              onChange={(event) =>
                adjustmentType === "AMOUNT"
                  ? setAdjustmentAmount(Number(event.target.value))
                  : setAdjustmentRate(Number(event.target.value))
              }
              className="h-9 w-32 rounded-md border border-slate-200 px-2 text-right"
            />
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                checked={tdsEnabled}
                onChange={(event) => setTdsEnabled(event.target.checked)}
              />
              TDS{" "}
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={!tdsEnabled}
                value={tdsRate}
                onChange={(event) => setTdsRate(Number(event.target.value))}
                className="h-9 w-20 rounded-md border border-slate-200 px-2 text-right disabled:bg-slate-50"
              />
              %
            </label>
            <span className="text-right text-slate-600">TDS deduction</span>
            <span className="text-right">-{formatInr(tdsAmount)}</span>
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                checked={tcsEnabled}
                onChange={(event) => setTcsEnabled(event.target.checked)}
              />
              TCS{" "}
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={!tcsEnabled}
                value={tcsRate}
                onChange={(event) => setTcsRate(Number(event.target.value))}
                className="h-9 w-20 rounded-md border border-slate-200 px-2 text-right disabled:bg-slate-50"
              />
              %
            </label>
            <span className="text-right text-slate-600">TCS collection</span>
            <span className="text-right">{formatInr(tcsAmount)}</span>
            <span className="text-slate-600">Subtotal</span>
            <span className="text-right tabular-nums">
              {formatInr(subtotal)}
            </span>
            <span className="text-slate-600">Tax</span>
            <span className="text-right tabular-nums">
              {formatInr(taxTotal)}
            </span>
            <span className="border-t border-slate-200 pt-3 font-semibold text-slate-900">
              Total due
            </span>
            <span className="border-t border-slate-200 pt-3 text-right text-lg font-semibold tabular-nums text-slate-950">
              {formatInr(totalAmount)}
            </span>
          </div>
        </section>

        <section className="grid gap-5 border-b border-slate-200 pb-7 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-md border border-slate-200 p-3 outline-none focus:border-orange-400"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Terms and payment instructions
            </span>
            <textarea
              rows={3}
              value={termsAndConditions}
              onChange={(event) => setTermsAndConditions(event.target.value)}
              className="w-full rounded-md border border-slate-200 p-3 outline-none focus:border-orange-400"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              PDF template
            </span>
            <select
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3"
            >
              <option value="minimal">Minimal</option>
              <option value="professional">Professional</option>
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
            </select>
          </label>
        </section>

        {error || metadataError ? (
          <p
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error ?? metadataError}
          </p>
        ) : null}
        <footer className="flex items-center justify-end gap-2 pb-4">
          <Link
            href="/dashboard/invoices"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || metadataLoading}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            <FilePlus2 size={16} />
            {saving ? "Saving…" : invoiceId ? "Save changes" : "Create invoice"}
          </button>
        </footer>
      </form>

      <CustomerPickerModal
        open={customerModalOpen}
        customers={customers}
        selectedId={customerId ? Number(customerId) : undefined}
        loading={metadataLoading}
        error={metadataError}
        onClose={() => setCustomerModalOpen(false)}
        onSelect={selectCustomer}
        onCreateCustomer={openNewCustomer}
      />
      <ServicePickerModal
        open={productModalIndex !== null}
        products={products}
        selectedId={
          productModalIndex === null
            ? undefined
            : items[productModalIndex]?.productId
        }
        canCreate={canCreateProduct}
        canEdit={canEditProduct}
        onClose={() => setProductModalIndex(null)}
        onSelect={(product) =>
          productModalIndex !== null &&
          selectProduct(productModalIndex, product)
        }
        onUpdate={updateCatalogProduct}
        onRemoveSelected={() =>
          productModalIndex !== null &&
          setItems((current) =>
            current.map((item, index) =>
              index === productModalIndex
                ? { ...item, productId: undefined }
                : item,
            ),
          )
        }
      />
    </main>
  );
}
