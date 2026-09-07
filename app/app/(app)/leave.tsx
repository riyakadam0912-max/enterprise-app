import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiError } from "@/src/api/client";
import { applyLeave, leaveBalance, leaveHistory } from "@/src/api/leave";
import { Dropdown } from "@/src/components/Dropdown";

export default function Leave() {
  const client = useQueryClient();
  const [leaveType, setLeaveType] = useState("PAID");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const balance = useQuery({
    queryKey: ["leave", "balance"],
    queryFn: leaveBalance,
  });
  const history = useQuery({
    queryKey: ["leave", "history"],
    queryFn: leaveHistory,
  });
  const mutation = useMutation({
    mutationFn: () =>
      applyLeave({
        leaveType,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      setStartDate("");
      setEndDate("");
      setReason("");
      void client.invalidateQueries({ queryKey: ["leave"] });
      Alert.alert(
        "Leave submitted",
        "Your request was submitted for approval.",
      );
    },
    onError: (error) => Alert.alert("Unable to submit leave", apiError(error)),
  });
  const submit = () => {
    if (!startDate || !endDate) {
      Alert.alert("Dates required", "Enter start and end dates as YYYY-MM-DD.");
      return;
    }
    mutation.mutate();
  };
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        backgroundColor: "#f8fafc",
        flexGrow: 1,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#172033" }}>
        Leave
      </Text>
      <Text style={{ color: "#64748b", marginTop: 5, marginBottom: 18 }}>
        Apply and follow requests from the ERP workflow.
      </Text>
      <View
        style={{ backgroundColor: "#ecfdf5", borderRadius: 14, padding: 16 }}
      >
        <Text style={{ color: "#047857", fontWeight: "700" }}>
          Leave balance
        </Text>
        <Text
          style={{
            color: "#065f46",
            fontSize: 24,
            fontWeight: "800",
            marginTop: 5,
          }}
        >
          {balance.data?.balance ?? 0} days
        </Text>
        <Text style={{ color: "#047857", marginTop: 4 }}>
          {balance.data?.year ?? new Date().getFullYear()} · Taken{" "}
          {balance.data?.daysTaken ?? 0} of {balance.data?.totalAllocation ?? 0}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          padding: 16,
          marginTop: 18,
        }}
      >
        <Text style={{ color: "#172033", fontWeight: "700", fontSize: 18 }}>
          New request
        </Text>
        <Dropdown label="Leave type" value={leaveType} options={["PAID", "SICK", "UNPAID", "OTHER"]} onChange={setLeaveType} />
        <TextInput
          value={startDate}
          onChangeText={setStartDate}
          placeholder="Start date (YYYY-MM-DD)"
          style={{
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 10,
            padding: 12,
            marginTop: 10,
          }}
        />
        <TextInput
          value={endDate}
          onChangeText={setEndDate}
          placeholder="End date (YYYY-MM-DD)"
          style={{
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 10,
            padding: 12,
            marginTop: 10,
          }}
        />
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason (optional)"
          multiline
          style={{
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 10,
            padding: 12,
            marginTop: 10,
            minHeight: 72,
            textAlignVertical: "top",
          }}
        />
        <Pressable
          disabled={mutation.isPending}
          onPress={submit}
          style={{
            backgroundColor: mutation.isPending ? "#fdba74" : "#ea580c",
            padding: 15,
            borderRadius: 11,
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {mutation.isPending ? "Submitting..." : "Submit request"}
          </Text>
        </Pressable>
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "800",
          color: "#172033",
          marginTop: 24,
          marginBottom: 10,
        }}
      >
        Request history
      </Text>
      {history.data?.map((item) => (
        <Link
          key={item.id}
          href={{ pathname: "/leave/[id]", params: { id: String(item.id) } }}
          asChild
        >
          <Pressable
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              padding: 16,
              marginBottom: 10,
            }}
          >
            <>
              <Text style={{ color: "#172033", fontWeight: "700" }}>
                {item.leaveType} · {item.status}
              </Text>
              <Text style={{ color: "#64748b", marginTop: 5 }}>
                {item.startDate} to {item.endDate} · {item.days} days
              </Text>
              {item.reason ? (
                <Text style={{ color: "#64748b", marginTop: 5 }}>
                  {item.reason}
                </Text>
              ) : null}
            </>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
