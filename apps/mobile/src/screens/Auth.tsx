import React, { useEffect, useRef, useState } from "react";
import { useSession, useSnapshot } from "../context";
import {
  acceptsRole,
  errorText,
  type Community,
  type Membership,
  type Unit,
} from "../domain";
import {
  sendCode,
  signOutNative,
  saveIdentityName,
  observePhoneSignIn,
  unregisterPush,
} from "../native";
import { PhoneSignInFlow } from "../phone-sign-in";
import {
  Button,
  Card,
  Choice,
  Select,
  Field,
  Heading,
  Icon,
  Loading,
  Page,
  Text,
  colors,
  s,
  useResource,
  showAlert,
} from "../ui";

export function SetupScreen() {
  return (
    <Page>
      <Icon name="home-heart" size={54} />
      <Heading
        title="Your community is not connected yet"
        subtitle="This installation needs your society’s service configuration."
      />
      <Card>
        <Text>
          Connect the API and Firebase, then rebuild the app to sign in and join
          your home.
        </Text>
      </Card>
    </Page>
  );
}
export function LoginScreen() {
  const session = useSession();
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState("");
  const [sent, setSent] = useState(false),
    [requesting, setRequesting] = useState(false),
    [finishing, setFinishing] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true);
  const flow = useRef<PhoneSignInFlow | null>(null);
  if (!flow.current)
    flow.current = new PhoneSignInFlow({
      observe: observePhoneSignIn,
      send: sendCode,
      complete: async (verifiedName, isCurrent) => {
        await saveIdentityName(verifiedName);
        if (isCurrent()) await session.signIn(verifiedName);
      },
      onError: (e) => {
        if (mounted.current) setError(errorText(e));
      },
      onCompleting: (busy) => {
        if (mounted.current) setFinishing(busy);
      },
    });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flow.current?.cancel();
    };
  }, []);
  const submit = async () => {
    if (name.trim().length < 2 || !/^[6-9]\d{9}$/.test(phone))
      throw new Error(
        "Enter your name and a valid 10-digit Indian mobile number.",
      );
    setError("");
    setRequesting(true);
    try {
      if (!sent) {
        const needsCode = await flow.current!.start(name.trim(), phone);
        if (mounted.current) setSent(needsCode);
        return;
      }
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit SMS code.");
      await flow.current!.confirm(code);
    } finally {
      if (mounted.current) setRequesting(false);
    }
  };
  return (
    <Page>
      <Icon name="home-heart" size={54} />
      <Heading
        title="You’re home."
        subtitle="Sign in with your mobile number. Your society administrator approves access to your home."
      />
      <Card>
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          maxLength={100}
          editable={!sent && !requesting && !finishing}
          autoComplete="name"
        />
        <Field
          label="Mobile number · +91"
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
          keyboardType="phone-pad"
          maxLength={10}
          editable={!sent && !requesting && !finishing}
        />
        {sent && (
          <Field
            label="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
          />
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: "#BC4A48" }}>
            {error}
          </Text>
        )}
        <Button
          title={
            finishing
              ? "Signing in…"
              : sent
                ? "Verify & continue"
                : "Send verification code"
          }
          onPress={submit}
          disabled={requesting || finishing}
        />
        {sent && (
          <Button
            secondary
            title="Change number / resend"
            disabled={requesting || finishing}
            onPress={() => {
              flow.current!.cancel();
              setSent(false);
              setCode("");
              setError("");
            }}
          />
        )}
        <Text style={s.muted}>
          Your number is used for secure sign-in and society access. SMS
          verification is provided by Firebase.
        </Text>
      </Card>
    </Page>
  );
}
export function MembershipScreen({ onOpen }: { onOpen?: () => void }) {
  const session = useSession();
  const snapshot = useSnapshot();
  const [search, setSearch] = useState(""),
    [community, setCommunity] = useState(""),
    [unit, setUnit] = useState(""),
    [role, setRole] = useState("owner");
  const list = useResource(async () => {
    const [communities, memberships] = await Promise.all([
      session.request<Community[]>(
        `/v1/onboarding/communities?search=${encodeURIComponent(search)}`,
      ),
      session.request<Membership[]>("/v1/onboarding/memberships"),
    ]);
    return { communities, memberships };
  }, [search]);
  const units = useResource(
    () =>
      community
        ? session.request<Unit[]>(
            `/v1/onboarding/communities/${community}/units`,
          )
        : Promise.resolve([]),
    [community],
  );
  return (
    <Page refresh={list.reload}>
      <Heading
        title="Make yourself at home"
        subtitle={
          session.role === "guard"
            ? "Ask your society administrator to assign guard access to your verified phone number."
            : "Choose your society and request membership. The administrator will review your request."
        }
      />
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <Loading error={list.error} retry={list.reload} />
      ) : (
        <>
          {list.data?.memberships
            .filter((m) => acceptsRole(session.role, m.role))
            .map((m) => (
              <Card key={m.id}>
                <Text style={s.title}>
                  {list.data?.communities.find((c) => c.id === m.community_id)
                    ?.name ?? "Your society"}
                </Text>
                <Text>
                  {m.role} · {m.status}
                </Text>
                {m.status === "approved" && (
                  <Button
                    title="Open"
                    onPress={async () => {
                      await session.selectCommunity(m.community_id);
                      onOpen?.();
                    }}
                  />
                )}
              </Card>
            ))}
          <Button
            secondary
            title="Check approval status"
            onPress={list.reload}
          />
        </>
      )}
      {session.role === "resident" && (
        <Card>
          <Field
            label="Find your society"
            value={search}
            onChangeText={setSearch}
          />
          <Select
            label="Society"
            value={community}
            options={(list.data?.communities ?? []).map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            onChange={(id) => {
              setCommunity(id);
              setUnit("");
            }}
          />
          {community &&
            (units.loading ? (
              <Loading />
            ) : units.error ? (
              <Loading error={units.error} retry={units.reload} />
            ) : (
              <Select
                label="Your flat"
                value={unit}
                options={(units.data ?? []).map((u) => ({
                  value: u.id,
                  label: u.label,
                }))}
                onChange={setUnit}
              />
            ))}
          <Choice
            label="I am an"
            value={role}
            options={["owner", "tenant", "family"]}
            onChange={setRole}
          />
          <Button
            title="Request membership"
            disabled={!unit}
            onPress={async () => {
              await session.request(
                `/v1/communities/${community}/memberships`,
                "POST",
                { unit_id: unit, role },
              );
              await list.reload();
              showAlert(
                "Request sent",
                "Your society administrator will review your request.",
              );
            }}
          />
        </Card>
      )}
      {snapshot.community && (
        <Button title="Back to your community" onPress={() => onOpen?.()} />
      )}
      <Button
        secondary
        title="Sign out"
        onPress={async () => {
          if (!session.isDemo) {
            await unregisterPush(session);
            await signOutNative();
          }
          session.clear();
        }}
      />
    </Page>
  );
}
