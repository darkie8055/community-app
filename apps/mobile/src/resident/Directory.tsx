import React, { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { type Routes, useSession } from "../context";
import type { Directory } from "../domain";
import {
  Card,
  Choice,
  Empty,
  Field,
  Heading,
  Icon,
  Loading,
  Page,
  Row,
  Text,
  colors,
  s,
  useResource,
} from "../ui";

export function DirectoryScreen({
  route,
}: NativeStackScreenProps<Routes, "Directory">) {
  const session = useSession();
  const [group, setGroup] = useState(route.params?.group ?? "Residents");
  const [query, setQuery] = useState("");
  const resource = useResource(
    () => session.request<Directory>(session.base + "/directory"),
    [session],
  );
  const people =
    resource.data?.people.filter((person) => {
      const staff = ["guard", "admin"].includes(person.role);
      return (
        staff === (group === "Society team") &&
        [person.name, person.unit, person.role]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    }) ?? [];
  return (
    <Page refresh={resource.reload}>
      <Heading
        title="Resident directory"
        subtitle={session.snapshot.community?.name}
      />
      <Choice
        value={group}
        options={["Residents", "Society team"]}
        onChange={(value) => setGroup(value as typeof group)}
      />
      <Field
        label="Search directory"
        placeholder="Name or flat number"
        value={query}
        onChangeText={setQuery}
      />
      {resource.loading || resource.error ? (
        <Loading error={resource.error} retry={resource.reload} />
      ) : people.length ? (
        people.map((person, i) => (
          <Card key={person.name + i}>
            <Row>
              <Icon
                name="account-circle-outline"
                size={35}
                color={colors.jade}
              />
              <View>
                <Text style={s.title}>{person.name}</Text>
                <Text style={s.muted}>
                  {[person.unit, person.role, person.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </Row>
          </Card>
        ))
      ) : (
        <Empty title="No matching people" />
      )}
    </Page>
  );
}
