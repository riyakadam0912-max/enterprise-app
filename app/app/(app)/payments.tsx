import {
  ModuleListScreen,
  RecordCard,
} from "@/src/components/ModuleListScreen";
import { payments } from "@/src/api/payments";
import { Link } from "expo-router";
import { Pressable, Text } from "react-native";

export default function Payments() {
  return (
    <ModuleListScreen
      title="Payments"
      subtitle="Recorded invoice payments in your authorized scope."
      queryKey={["payments"]}
      load={payments}
      headerAction={
        <Link href="/(app)/payment/add" asChild>
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
              params: { id: String(item.invoiceId) },
            } as never
          }
          asChild
        >
          <Pressable accessibilityRole="button">
            <RecordCard
              item={item}
              titleKey="amount"
              detailKeys={[
                "paymentDate",
                "paymentMethod",
                "status",
                "transactionId",
              ]}
            />
          </Pressable>
        </Link>
      )}
    />
  );
}
