import { Link } from "expo-router";
import { Pressable, Text } from "react-native";
import {
  ModuleListScreen,
  RecordCard,
} from "@/src/components/ModuleListScreen";
import { quotes } from "@/src/api/quotes";
import { useAuth } from "@/src/providers/AuthProvider";

export default function Quotes() {
  const { session } = useAuth();
  const canCreate = ["ADMIN", "SUPER_ADMIN"].includes(session?.role ?? "");
  return (
    <ModuleListScreen
      title="Quotes"
      subtitle="Sales quotes in your authorized organization scope."
      queryKey={["quotes"]}
      load={quotes}
      headerAction={
        canCreate ? (
          <Link href="/(app)/quote/add" asChild>
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
        ) : null
      }
      renderItem={(item) => (
        <Link
          href={
            {
              pathname: "/quote/[id]",
              params: { id: String(item.id) },
            } as never
          }
          asChild
        >
          <Pressable accessibilityRole="button">
            <RecordCard
              item={item}
              titleKey="id"
              detailKeys={["total", "status", "validTill"]}
            />
          </Pressable>
        </Link>
      )}
    />
  );
}
