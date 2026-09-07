import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  ClipboardCheck,
  ReceiptIndianRupee,
  WalletCards,
} from "@/src/components/icons";
import { useAuth } from "@/src/providers/AuthProvider";
export default function Finance() {
  const { session } = useAuth();
  const canViewInvoices = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(
    session?.role ?? "",
  );
  const canViewAccounting = ["ADMIN", "SUPER_ADMIN", "HR", "MANAGER"].includes(
    session?.role ?? "",
  );
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        backgroundColor: "#f8fafc",
        flexGrow: 1,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#172033" }}>
        Finance
      </Text>
      <Text style={{ color: "#64748b", marginTop: 5, marginBottom: 20 }}>
        Submit and review financial workflows.
      </Text>
      <Link href="/(app)/expenses" asChild>
        <Pressable
          accessibilityRole="button"
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 18,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <>
            <View
              style={{
                backgroundColor: "#eff6ff",
                padding: 12,
                borderRadius: 12,
              }}
            >
              <ReceiptIndianRupee color="#2563eb" size={22} />
            </View>
            <View>
              <Text
                style={{ fontWeight: "700", color: "#172033", fontSize: 16 }}
              >
                Expenses
              </Text>
              <Text style={{ color: "#64748b", marginTop: 4 }}>
                Create and track expense claims.
              </Text>
            </View>
          </>
        </Pressable>
      </Link>
      {canViewInvoices ? (
        <Link href="/(app)/invoices" asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 18,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <>
              <View
                style={{
                  backgroundColor: "#f0fdf4",
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                <ClipboardCheck color="#16a34a" size={22} />
              </View>
              <View>
                <Text
                  style={{ fontWeight: "700", color: "#172033", fontSize: 16 }}
                >
                  Invoices
                </Text>
                <Text style={{ color: "#64748b", marginTop: 4 }}>
                  Review customer invoices and payments.
                </Text>
              </View>
            </>
          </Pressable>
        </Link>
      ) : null}
      {canViewAccounting ? (
        <>
          <Link href="/(app)/payments" asChild>
            <Pressable
              accessibilityRole="button"
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <>
                <View
                  style={{
                    backgroundColor: "#fef3c7",
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <WalletCards color="#b45309" size={22} />
                </View>
                <View>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: "#172033",
                      fontSize: 16,
                    }}
                  >
                    Payments
                  </Text>
                  <Text style={{ color: "#64748b", marginTop: 4 }}>
                    Track recorded invoice payments.
                  </Text>
                </View>
              </>
            </Pressable>
          </Link>
          <Link href="/(app)/ledger" asChild>
            <Pressable
              accessibilityRole="button"
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <>
                <View
                  style={{
                    backgroundColor: "#f0fdfa",
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <ClipboardCheck color="#0f766e" size={22} />
                </View>
                <View>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: "#172033",
                      fontSize: 16,
                    }}
                  >
                    Ledger
                  </Text>
                  <Text style={{ color: "#64748b", marginTop: 4 }}>
                    Review organization accounting entries.
                  </Text>
                </View>
              </>
            </Pressable>
          </Link>
        </>
      ) : null}
      <Link href="/(app)/payslips" asChild>
        <Pressable
          accessibilityRole="button"
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <>
            <View
              style={{
                backgroundColor: "#fef3c7",
                padding: 12,
                borderRadius: 12,
              }}
            >
              <WalletCards color="#b45309" size={22} />
            </View>
            <View>
              <Text
                style={{ fontWeight: "700", color: "#172033", fontSize: 16 }}
              >
                Payslips
              </Text>
              <Text style={{ color: "#64748b", marginTop: 4 }}>
                View your generated payroll statements.
              </Text>
            </View>
          </>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
