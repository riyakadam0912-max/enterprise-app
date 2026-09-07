import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  ModuleListScreen,
  RecordCard,
} from "@/src/components/ModuleListScreen";
import { apiError } from "@/src/api/client";
import { invoices } from "@/src/api/invoices";

export default function Invoices() {
  return (
    <ModuleListScreen
      title="Invoices"
      subtitle="Customer invoices in your authorized organization scope."
      queryKey={["invoices"]}
      load={invoices}
      headerAction={
        <Link href="/(app)/invoices/add" asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              backgroundColor: "#ea580c",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Create</Text>
          </Pressable>
        </Link>
      }
      renderItem={(item) => (
        <Link
          href={
            {
              pathname: "/invoice/[id]",
              params: { id: String(item.id) },
            } as never
          }
          asChild
        >
          <Pressable accessibilityRole="button">
            <RecordCard
              item={item}
              titleKey="invoiceNo"
              detailKeys={["customer", "totalAmount", "status", "dueDate"]}
            />
          </Pressable>
        </Link>
      )}
    />
  );
}

export function InvoiceLoadError({ error }: { error: unknown }) {
  return (
    <View>
      <Text>{apiError(error)}</Text>
    </View>
  );
}
