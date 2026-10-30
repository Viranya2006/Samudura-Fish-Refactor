/**
 * Receipt template for 80mm thermal paper (72.1mm printable × 210mm).
 * Fully in Sinhala as per requirements.
 */

/** Minimal item shape for receipt (CartItem or history sale item) */
export interface ReceiptItem {
  product: { name_si: string };
  weightKg: number;
  pricePerKg: number;
  lineDiscount?: number;
  lineTotal: number;
}

export interface ReceiptData {
  receiptNumber: string;
  shopName: string;
  shopNameSi: string;
  address: string | null;
  phone: string | null;
  footer: string | null;
  items: ReceiptItem[];
  subtotal: number;
  lineDiscountTotal?: number;
  discountAmount: number;
  total: number;
  paymentMethod: "cash" | "card";
  cashReceived?: number;
  changeGiven?: number;
  saleType: "retail" | "wholesale";
  date: string;
}

const PAYMENT_LABELS = {
  cash: "මුදල්",
  card: "කාඩ්පත",
} as const;

const SALE_TYPE_LABELS = {
  retail: "සිල්ලර",
  wholesale: "බහුල",
} as const;

export function ReceiptTemplate({ data }: { data: ReceiptData }) {
  const {
    receiptNumber,
    shopNameSi,
    address,
    phone,
    footer,
    items,
    subtotal,
    lineDiscountTotal = 0,
    discountAmount,
    total,
    paymentMethod,
    cashReceived,
    changeGiven,
    saleType,
    date,
  } = data;

  return (
    <div
      className="receipt-print bg-white px-4 pb-4 pt-0 font-sans text-black"
      style={{
        width: "72.1mm",
        maxWidth: "72.1mm",
        fontFamily: "'Noto Sans Sinhala', sans-serif",
      }}
    >
      <div className="text-center">
        <h1 className="text-lg font-bold">{shopNameSi}</h1>
        {address && <p className="text-xs">{address}</p>}
        {phone && <p className="text-xs">{phone}</p>}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex justify-between text-xs">
        <span>බිල්පත් අංකය: {receiptNumber}</span>
        <span>{date}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        වෙලදාම: {SALE_TYPE_LABELS[saleType]}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 text-left">නම</th>
            <th className="py-1 text-right">බර</th>
            <th className="py-1 text-right">මිල</th>
            <th className="py-1 text-right">වට්ටම්</th>
            <th className="py-1 text-right">එකතුව</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-dotted border-gray-400">
              <td className="py-0.5 max-w-[2.2rem] truncate">{item.product.name_si}</td>
              <td className="py-0.5 text-right whitespace-nowrap">{item.weightKg.toFixed(3)}</td>
              <td className="py-0.5 text-right whitespace-nowrap">{item.pricePerKg.toFixed(0)}</td>
              <td className="py-0.5 text-right whitespace-nowrap">
                {(item.lineDiscount ?? 0) > 0 ? item.lineDiscount!.toFixed(0) : ""}
              </td>
              <td className="py-0.5 text-right whitespace-nowrap">{item.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>උප එකතුව</span>
          <span>Rs. {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>මුළු</span>
          <span>Rs. {total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>ගෙවීම</span>
          <span>{PAYMENT_LABELS[paymentMethod]}</span>
        </div>
        {paymentMethod === "cash" && cashReceived != null && (
          <>
            <div className="flex justify-between font-bold">
              <span>ලැබුණු මුදල</span>
              <span>Rs. {cashReceived.toFixed(2)}</span>
            </div>
            {changeGiven != null && changeGiven > 0 && (
              <div className="flex justify-between">
                <span>ඉතිරිය</span>
                <span>Rs. {changeGiven.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
        {(lineDiscountTotal + discountAmount) > 0 && (
          <div className="flex justify-between font-bold">
            <span>ඔබට ලැබුණු ලාබය</span>
            <span>Rs. {(lineDiscountTotal + discountAmount).toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      {footer && (
        <p className="text-center text-xs">{footer}</p>
      )}
      <p className="mt-2 text-center text-xs">ඔබට ස්තූතියි</p>
    </div>
  );
}
