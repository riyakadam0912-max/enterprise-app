import {
  ModuleListScreen,
  RecordCard,
} from "@/src/components/ModuleListScreen";
import { Link } from "expo-router";
import { Pressable, Text } from "react-native";
import { ledgerEntries } from "@/src/api/ledger";

export default function Ledger() {
  return (
    <ModuleListScreen
      title="Ledger"
      subtitle="Organization accounting entries in your authorized scope."
      queryKey={["ledger"]}
      load={ledgerEntries}
      headerAction={
        <Link href="/(app)/ledger/add" asChild>
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
        <RecordCard
          item={item}
          titleKey="description"
          detailKeys={[
            "date",
            "account",
            "debit",
            "credit",
            "balance",
            "reference",
          ]}
        />
      )}
    />
  );
}
