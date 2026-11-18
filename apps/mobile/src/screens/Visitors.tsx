import React, { useEffect, useRef, useState } from "react";
import { Pressable, Share, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";
import { type Routes, useSession, useSnapshot } from "../context";
import { DEMO_PASS_CODE } from "../demo";
import {
  type Page as ResultPage,
  type Visitor,
  type VisitorPass,
  dateText,
  expired,
  formatCode,
  parsePass,
  passPayload,
} from "../domain";
import {
  Button,
  Card,
  Choice,
  Select,
  Empty,
  Field,
  Heading,
  Icon,
  Loading,
  Page,
  Photo,
  Row,
  Text,
  colors,
  confirm,
  pickPhoto,
  showAlert,
  s,
  useResource,
  useDebounced,
  type PhotoAsset,
} from "../ui";

const statusColors: Record<string, [string, string]> = {
  pending: ["#AA6C16", "#FFF4DB"],
  approved: ["#278366", "#EAF5EF"],
  inside: ["#278366", "#EAF5EF"],
  denied: ["#BC4A48", "#FFEEEE"],
  exited: ["#79818A", "#F0F2F4"],
};
export function VisitCard({
  visit: v,
  actions = false,
}: {
  visit: Visitor;
  actions?: boolean;
}) {
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const session = useSession();
  const [color, backgroundColor] = statusColors[v.status];
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open visitor ${v.name}`}
        onPress={() => nav.navigate("Visitor", { id: v.id })}
      >
        <Row>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 15,
              backgroundColor: colors.canvas,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={
                v.type === "delivery"
                  ? "package-variant"
                  : v.type === "cab"
                    ? "taxi"
                    : v.type === "service"
                      ? "tools"
                      : "account-outline"
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{v.name}</Text>
            <Text style={s.muted}>
              {[v.company, v.type, v.unit].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text
            style={{
              color,
              backgroundColor,
              padding: 6,
              borderRadius: 8,
              fontSize: 11,
            }}
          >
            {v.status === "pending" ? "Waiting" : v.status}
          </Text>
        </Row>
        <Text style={[s.muted, { marginTop: 9 }]}>
          {dateText(v.created_at)}
        </Text>
      </Pressable>
      {actions && <VisitActions visit={v} />}
    </Card>
  );
}
export function VisitActions({
  visit: v,
  done,
}: {
  visit: Visitor;
  done?: () => Promise<unknown>;
}) {
  const session = useSession();
  const act = async (status: string) => {
    if (
      status === "denied" &&
      !(await confirm(
        "Deny this visitor?",
        `Security will be told not to let ${v.name} in.`,
      ))
    )
      return;
    await session.transition(v.id, status);
    await done?.();
  };
  return (
    <Row style={{ flexWrap: "wrap" }}>
      {session.role === "resident" && v.status === "pending" && (
        <>
          <View style={{ flex: 1 }}>
            <Button secondary title="Deny" onPress={() => act("denied")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Approve entry" onPress={() => act("approved")} />
          </View>
        </>
      )}
      {session.role === "guard" && v.status === "approved" && (
        <Button title="Record entry" onPress={() => act("inside")} />
      )}
      {session.role === "guard" && v.status === "inside" && (
        <Button title="Check out" onPress={() => act("exited")} />
      )}
    </Row>
  );
}
export function VisitorsScreen() {
  const session = useSession();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [type, setType] = useState(""),
    [today, setToday] = useState("");
  const searchTerm = useDebounced(search);
  const [items, setItems] = useState<Visitor[]>([]),
    [cursor, setCursor] = useState<string | null>();
  const epoch = useRef(0);
  const query = () => {
    const params = new URLSearchParams({
      limit: "50",
      ...(searchTerm ? { search: searchTerm } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    });
    if (today) {
      const a = new Date();
      a.setHours(0, 0, 0, 0);
      const b = new Date(a);
      b.setDate(b.getDate() + 1);
      params.set("from", a.toISOString());
      params.set("until", b.toISOString());
    }
    return params;
  };
  const resource = useResource(async () => {
    const v = ++epoch.current;
    const result = await session.request<ResultPage<Visitor>>(
      `${session.base}/visitor-entries?${query()}`,
    );
    if (v === epoch.current) {
      setItems(result.items);
      setCursor(result.next_cursor);
    }
    return result;
  }, [searchTerm, status, type, today]);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  return (
    <Page refresh={resource.reload}>
      <Heading
        title="Your visitor book"
        subtitle="Every arrival, every goodbye. All in one place."
      />
      <Field
        label="Search visitors"
        placeholder="Name, phone, company or flat"
        value={search}
        onChangeText={setSearch}
      />
      <Choice
        value={status}
        options={["", "pending", "approved", "denied", "inside", "exited"]}
        onChange={setStatus}
      />
      <Choice
        value={type}
        options={["", "guest", "delivery", "cab", "service"]}
        onChange={setType}
      />
      <Choice
        value={today}
        options={[
          { value: "", label: "All dates" },
          { value: "today", label: "Today" },
        ]}
        onChange={setToday}
      />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Loading error={resource.error} retry={resource.reload} />
      ) : (
        <>
          {items.length ? (
            items.map((v) => <VisitCard key={v.id} visit={v} />)
          ) : (
            <Empty
              title="No visitors found"
              message="Try a different filter, or invite your first visitor."
            />
          )}
          {cursor && (
            <Button
              secondary
              title="Load more"
              onPress={async () => {
                const v = epoch.current;
                const p = query();
                p.set("cursor", cursor);
                const next = await session.request<ResultPage<Visitor>>(
                  `${session.base}/visitor-entries?${p}`,
                );
                if (v === epoch.current) {
                  setItems((old) => [
                    ...old,
                    ...next.items.filter(
                      (n) => !old.some((o) => o.id === n.id),
                    ),
                  ]);
                  setCursor(next.next_cursor);
                }
              }}
            />
          )}
        </>
      )}
    </Page>
  );
}
export function VisitorScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Visitor">) {
  const session = useSession();
  const snapshot = useSnapshot();
  const resource = useResource(
    () =>
      session.request<Visitor>(
        `${session.base}/visitor-entries/${route.params.id}`,
      ),
    [route.params.id, snapshot.entries],
  );
  const v = resource.data;
  return (
    <Page refresh={resource.reload}>
      {resource.error ? (
        <Loading error={resource.error} retry={resource.reload} />
      ) : !v ? (
        <Loading />
      ) : (
        <>
          <Heading title={v.name} subtitle={`${v.type} · ${v.unit}`} />
          {v.photo_url && <Photo uri={v.photo_url} />}
          <Card>
            <Text>+91 {v.phone}</Text>
            <Text>
              {v.company || v.type} · {v.people} person(s)
            </Text>
            {!!v.purpose && <Text>{v.purpose}</Text>}
            {!!v.vehicle && <Text>Vehicle: {v.vehicle}</Text>}
            <Text>Status: {v.status}</Text>
            <VisitActions visit={v} />
            {session.role === "resident" && v.status === "approved" && (
              <Button
                title="Visitor QR pass"
                onPress={() => navigation.navigate("Pass", { id: v.id })}
              />
            )}
          </Card>
          <Heading title="Visit timeline" />
          {[
            ["Registered", v.created_at],
            ["Approved", v.approved_at],
            ["Denied", v.denied_at],
            ["Entered", v.entered_at],
            ["Exited", v.exited_at],
          ]
            .filter(([, time]) => time)
            .map(([label, time]) => (
              <Card key={label}>
                <Row>
                  <Icon name="check-circle-outline" color={colors.green} />
                  <View>
                    <Text style={s.title}>{label}</Text>
                    <Text style={s.muted}>{dateText(time)}</Text>
                  </View>
                </Row>
              </Card>
            ))}
        </>
      )}
    </Page>
  );
}
export function VisitorFormScreen({
  navigation,
  route,
}: NativeStackScreenProps<Routes, "VisitorForm">) {
  const session = useSession();
  const snapshot = useSnapshot();
  const resident = session.role === "resident";
  const units = resident ? session.ownUnits : snapshot.units;
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [type, setType] = useState<string>(route.params?.type ?? "guest"),
    [unit, setUnit] = useState(units[0]?.id ?? ""),
    [company, setCompany] = useState(""),
    [purpose, setPurpose] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [people, setPeople] = useState("1"),
    [photo, setPhoto] = useState<PhotoAsset>();
  const intent = useRef({ body: "", key: "" });
  const uploaded = useRef({ uri: "", key: "" });
  const submit = async () => {
    if (
      name.trim().length < 2 ||
      !/^[6-9]\d{9}$/.test(phone) ||
      !unit ||
      !Number.isInteger(Number(people)) ||
      Number(people) < 1 ||
      Number(people) > 20
    )
      throw new Error(
        "Enter a name, valid phone number, flat and party size between 1 and 20.",
      );
    if (photo && uploaded.current.uri !== photo.uri)
      uploaded.current = {
        uri: photo.uri,
        key: await session.upload(photo.uri, photo.mimeType),
      };
    const body = {
      name: name.trim(),
      phone,
      type,
      unit_id: unit,
      company,
      purpose,
      vehicle,
      people: Number(people),
      preapproved: resident,
      ...(photo ? { photo_key: uploaded.current.key } : {}),
    };
    const serialized = JSON.stringify(body);
    if (intent.current.body !== serialized)
      intent.current = { body: serialized, key: Crypto.randomUUID() };
    const v = await session.register(body, intent.current.key);
    navigation.replace("Visitor", { id: v.id });
  };
  return (
    <Page>
      <Heading
        title={
          resident
            ? "Good company starts with an invite."
            : "Welcome a new visitor"
        }
        subtitle={
          resident
            ? "Pre-approve your visitor for a smoother arrival."
            : "A few details, and we’ll let the resident know."
        }
      />
      <Card>
        <Choice
          label="Visitor type"
          value={type}
          options={["guest", "delivery", "cab", "service"]}
          onChange={setType}
        />
        <Field
          label="Visitor name"
          value={name}
          onChangeText={setName}
          maxLength={100}
        />
        <Field
          label="Mobile number · +91"
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
          maxLength={10}
          keyboardType="phone-pad"
        />
        <Select
          label="Visiting flat"
          value={unit}
          options={units.map((u) => ({ value: u.id, label: u.label }))}
          onChange={setUnit}
        />
        <Field
          label="Company (optional)"
          value={company}
          onChangeText={setCompany}
        />
        <Field
          label="Purpose (optional)"
          value={purpose}
          onChangeText={setPurpose}
        />
        <Field
          label="Number of people"
          value={people}
          onChangeText={setPeople}
          keyboardType="number-pad"
        />
        <Field
          label="Vehicle (optional)"
          value={vehicle}
          onChangeText={setVehicle}
          autoCapitalize="characters"
        />
        <Button
          secondary
          title={photo ? "Replace photo" : "Add visitor photo"}
          onPress={async () => {
            const p = await pickPhoto(true);
            if (p) setPhoto(p);
          }}
        />
        {photo && (
          <>
            <Photo uri={photo.uri} />
            <Button
              secondary
              title="Remove photo"
              onPress={() => setPhoto(undefined)}
            />
          </>
        )}
        <Button
          title={resident ? "Pre-approve visitor" : "Send approval request"}
          onPress={submit}
        />
        <Text style={s.muted}>
          {resident
            ? "Security will verify your guest at the gate."
            : "The visitor must wait for resident approval before entering."}
        </Text>
      </Card>
    </Page>
  );
}
export function PassScreen({ route }: NativeStackScreenProps<Routes, "Pass">) {
  const session = useSession();
  const id = route.params.id;
  const [hours, setHours] = useState("24"),
    [now, setNow] = useState(Date.now());
  const card = useRef<React.ElementRef<typeof View>>(null);
  const data = useResource(async () => {
    const [visit, pass] = await Promise.all([
      session.request<Visitor>(`${session.base}/visitor-entries/${id}`),
      session.request<VisitorPass | null>(
        `${session.base}/visitor-entries/${id}/pass`,
      ),
    ]);
    return { visit, pass };
  }, [id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const p = data.data?.pass;
  const valid = p && !expired(p, now);
  const eligible =
    session.role === "resident" && data.data?.visit.status === "approved";
  const assertValid = () => {
    if (!p || expired(p))
      throw new Error("This pass has expired. Generate a new pass.");
    return p;
  };
  return (
    <Page refresh={data.reload}>
      <Heading
        title="A warm welcome, ready to share"
        subtitle="Your visitor’s pass to a smoother arrival."
      />
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <Loading error={data.error} retry={data.reload} />
      ) : (
        <>
          <View ref={card} collapsable={false}>
            <Card style={{ alignItems: "center", padding: 28 }}>
              <Icon name="home-heart" size={38} />
              <Text style={s.title}>My Home · Visitor pass</Text>
              {session.isDemo && (
                <Text style={s.muted}>
                  Demo pass · For this sample community only
                </Text>
              )}
              <Text>{session.snapshot.community?.name}</Text>
              <Text style={s.heading}>{data.data?.visit.name}</Text>
              <Text>{data.data?.visit.unit}</Text>
              {valid ? (
                <>
                  <QRCode value={passPayload(p)} size={220} quietZone={12} />
                  <Text
                    selectable
                    style={{
                      fontSize: 23,
                      fontWeight: "800",
                      letterSpacing: 2,
                    }}
                  >
                    {formatCode(p.code)}
                  </Text>
                  <Text style={s.muted}>
                    Valid until {dateText(p.expires_at)}
                  </Text>
                </>
              ) : (
                <Text>
                  {p
                    ? "This pass has expired."
                    : "No active pass. Generate one below."}
                </Text>
              )}
            </Card>
          </View>
          {valid && (
            <>
              <Button
                title="Share pass"
                onPress={async () => {
                  const pass = assertValid();
                  await Share.share({
                    message: `Visitor pass for ${data.data?.visit.name}\n${session.snapshot.community?.name} · ${data.data?.visit.unit}\nCode: ${formatCode(pass.code)}\nValid until ${dateText(pass.expires_at)}\n${passPayload(pass)}`,
                  });
                }}
              />
              <Row>
                <Button
                  secondary
                  title="Copy code"
                  onPress={async () => {
                    await Clipboard.setStringAsync(
                      formatCode(assertValid().code),
                    );
                    showAlert("Copied", "Visitor code copied.");
                  }}
                />
                <Button
                  secondary
                  title="Share QR image"
                  onPress={async () => {
                    assertValid();
                    if (!(await Sharing.isAvailableAsync()))
                      throw new Error(
                        "Image sharing is unavailable on this device.",
                      );
                    const uri = await captureRef(card, {
                      format: "png",
                      quality: 1,
                    });
                    await Sharing.shareAsync(uri, {
                      mimeType: "image/png",
                      UTI: "public.png",
                    });
                  }}
                />
              </Row>
            </>
          )}
          {eligible && (
            <Card>
              <Choice
                label="Pass validity"
                value={hours}
                options={["1", "4", "12", "24", "48"]}
                onChange={setHours}
              />
              <Button
                title={p ? "Replace pass" : "Generate QR pass"}
                onPress={async () => {
                  if (
                    valid &&
                    !(await confirm(
                      "Replace this pass?",
                      "The previous QR and code will stop working. Share the new pass with your visitor.",
                    ))
                  )
                    return;
                  await session.request(
                    `${session.base}/visitor-entries/${id}/pass`,
                    "POST",
                    { hours: Number(hours) },
                  );
                  await data.reload();
                }}
              />
              {p && (
                <Button
                  secondary
                  danger
                  title="Revoke pass"
                  onPress={async () => {
                    if (
                      await confirm(
                        "Revoke visitor pass?",
                        "The QR and code will stop working immediately.",
                      )
                    ) {
                      await session.request(
                        `${session.base}/visitor-entries/${id}/pass`,
                        "DELETE",
                      );
                      await data.reload();
                    }
                  }}
                />
              )}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
export function VerifyScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Verify">) {
  const session = useSession();
  const [input, setInput] = useState(route.params?.code ?? ""),
    [verified, setVerified] = useState<{ code: string; visit: Visitor }>(),
    [scanning, setScanning] = useState(false),
    [permission, requestPermission] = useCameraPermissions();
  const change = (text: string) => {
    setInput(text);
    setVerified(undefined);
  };
  useEffect(() => {
    change(route.params?.code ?? "");
  }, [route.params?.code]);
  const verify = async (text = input) => {
    setVerified(undefined);
    const code = parsePass(text, session.snapshot.community!.id);
    const visit = await session.request<Visitor>(
      `${session.base}/visitor-passes/verify`,
      "POST",
      { code },
    );
    setVerified({ code, visit });
  };
  if (session.role !== "guard")
    return (
      <Page>
        <Empty title="Guard access required" />
      </Page>
    );
  return (
    <Page>
      <Heading
        title="Verify a visitor pass"
        subtitle="Scan a QR code or enter the code printed below it."
      />
      {scanning && permission?.granted ? (
        <View style={{ height: 280, borderRadius: 22, overflow: "hidden" }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              setScanning(false);
              change(data);
              void verify(data).catch((e) =>
                showAlert("Unable to verify", e.message),
              );
            }}
          />
        </View>
      ) : (
        <Button
          secondary
          title="Scan QR code"
          onPress={async () => {
            const p = permission?.granted
              ? permission
              : await requestPermission();
            if (!p.granted)
              throw new Error(
                "Enable camera access in device settings or type the visitor code.",
              );
            setScanning(true);
          }}
        />
      )}
      {scanning && (
        <Button
          secondary
          title="Stop scanning"
          onPress={() => setScanning(false)}
        />
      )}
      <Field
        label="Visitor code"
        value={input}
        onChangeText={change}
        autoCapitalize="characters"
      />
      {session.isDemo && (
        <Button
          secondary
          title="Use sample code"
          onPress={() => change(DEMO_PASS_CODE)}
        />
      )}
      <Button title="Verify pass" onPress={() => verify()} />
      {verified && (
        <>
          <VisitCard visit={verified.visit} />
          <Text>Confirm the visitor’s identity before recording entry.</Text>
          <Button
            title="Record entry"
            onPress={async () => {
              if (
                parsePass(input, session.snapshot.community!.id) !==
                verified.code
              )
                throw new Error("Verify this code again.");
              const visit = await session.request<Visitor>(
                `${session.base}/visitor-passes/check-in`,
                "POST",
                { code: verified.code },
              );
              setVerified(undefined);
              await session.refresh();
              navigation.replace("Visitor", { id: visit.id });
            }}
          />
        </>
      )}
    </Page>
  );
}
