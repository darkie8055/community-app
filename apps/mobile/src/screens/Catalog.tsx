import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { Section, StoryHeader, TextAction } from "../resident/components";
import { samplePhotos } from "../resident/samplePhotos";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { type Routes, useSession } from "../context";
import {
  type Item,
  type Kind,
  type Page as ResultPage,
  type Activity,
  categories,
  money,
} from "../domain";
import {
  Button,
  Card,
  Choice,
  Select,
  DateField,
  Empty,
  Field,
  Heading,
  Loading,
  Page,
  Photo,
  Row,
  Text,
  colors,
  pickPhoto,
  s,
  useResource,
  useDebounced,
  showAlert,
  type PhotoAsset,
} from "../ui";

export function ItemCard({ item }: { item: Item }) {
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      onPress={() => nav.navigate("Item", { id: item.id })}
    >
      <Card>
        {!["post", "notice"].includes(item.kind) && (
          <Photo uri={item.photo_url} />
        )}
        <Text style={s.muted}>
          {item.category} · {item.author}
        </Text>
        <Text style={s.title}>{item.title}</Text>
        {["post", "notice"].includes(item.kind) ? (
          <Text numberOfLines={3}>{item.description}</Text>
        ) : (
          <Text style={s.title}>
            {money(item.price)}
            {item.listing_type === "rent" ? " / month" : ""}
          </Text>
        )}
        {item.unit && (
          <Text style={s.muted}>
            {item.unit} {item.bedrooms ? `· ${item.bedrooms} BHK` : ""}
          </Text>
        )}
        <Text style={s.muted}>
          {item.status === "published" ? "View details" : item.status}
          {item.saved ? " · Saved" : ""}
        </Text>
      </Card>
    </Pressable>
  );
}
const titleFor = (kind: Kind) =>
  ({
    property: "Homes",
    listing: "Buy & Sell",
    service: "Stores",
    notice: "Notice Board",
    post: "Community Posts",
  })[kind];

const catalogHeaders = {
  property: {
    caption: "Society properties",
    photo: "sample:apartment",
    results: "Property listings",
  },
  listing: {
    caption: "Neighbourhood market",
    photo: "sample:chair",
    results: "Marketplace listings",
  },
  service: {
    caption: "Local services",
    photo: "sample:cleaning",
    results: "Available services",
  },
};
export function CatalogScreen({ kind }: { kind: Kind }) {
  const session = useSession();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const focused = useIsFocused();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(kind === "property" ? "Rent" : ""),
    [filter, setFilter] = useState("all");
  const [items, setItems] = useState<Item[]>([]),
    [cursor, setCursor] = useState<string | null>();
  const generation = useRef(0);
  const searchTerm = useDebounced(search);
  const query = () =>
    new URLSearchParams({
      kind,
      limit: "50",
      ...(searchTerm ? { search: searchTerm } : {}),
      ...(category ? { category } : {}),
      ...(filter === "saved" ? { saved: "true" } : {}),
      ...(filter === "mine" ? { mine: "true" } : {}),
    });
  const resource = useResource(async () => {
    const v = ++generation.current;
    const result = await session.request<ResultPage<Item>>(
      `${session.base}/items?${query()}`,
    );
    if (v === generation.current) {
      setItems(result.items);
      setCursor(result.next_cursor);
    }
    return result;
  }, [kind, searchTerm, category, filter, focused]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const canCreate =
    session.role === "resident" &&
    (kind === "listing" || kind === "property" || kind === "post");
  const header =
    kind === "notice" || kind === "post" ? undefined : catalogHeaders[kind];
  const createAction = canCreate ? (
    <TextAction
      label={
        {
          property: "Post your property",
          listing: "Sell something",
          post: "New community post",
        }[kind]
      }
      onPress={() => nav.navigate("Editor", { kind })}
    />
  ) : undefined;
  return (
    <Page refresh={resource.reload}>
      {header ? (
        <StoryHeader
          title={titleFor(kind)}
          subtitle={header.caption}
          art={samplePhotos[header.photo]}
        />
      ) : (
        <Heading title={titleFor(kind)} />
      )}
      <Field
        label={`Search ${titleFor(kind).toLowerCase()}`}
        placeholder={
          kind === "property"
            ? "Try a flat or number of bedrooms"
            : "Search by name or keyword"
        }
        value={search}
        onChangeText={setSearch}
      />
      {!["post", "notice"].includes(kind) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Choice
            value={category}
            options={[
              "",
              ...(kind === "property"
                ? ["Rent", "Buy"]
                : kind === "service"
                  ? ["Cleaning", "Appliance Repair", "Moving", "Painting"]
                  : categories),
            ]}
            onChange={setCategory}
          />
        </ScrollView>
      )}
      <Choice
        value={filter}
        options={[
          { value: "all", label: "Explore" },
          { value: "saved", label: "Saved" },
          ...(canCreate ? [{ value: "mine", label: "My listings" }] : []),
        ]}
        onChange={setFilter}
      />
      {(header || createAction) && (
        <Section
          title={header?.results ?? "Neighbour posts"}
          action={createAction}
        />
      )}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Loading error={resource.error} retry={resource.reload} />
      ) : (
        <>
          {items.length ? (
            items.map((i) => <ItemCard key={i.id} item={i} />)
          ) : (
            <Empty
              title="Nothing here yet"
              message="Published items from your community will appear here."
            />
          )}
          {cursor && (
            <Button
              secondary
              title="Load more"
              onPress={async () => {
                const v = generation.current;
                const p = query();
                p.set("cursor", cursor);
                const next = await session.request<ResultPage<Item>>(
                  `${session.base}/items?${p}`,
                );
                if (v === generation.current) {
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
function validDate(value: string) {
  const d = new Date(`${value}T12:00:00`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(d.getTime()) &&
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` ===
      value
  );
}
export function ItemScreen({ route }: NativeStackScreenProps<Routes, "Item">) {
  const session = useSession();
  const id = route.params.id;
  const resource = useResource(
    () => session.request<Item>(`${session.base}/items/${id}`),
    [id],
  );
  const item = resource.data;
  const [message, setMessage] = useState(""),
    [scheduled, setScheduled] = useState(""),
    [unit, setUnit] = useState(session.ownUnits[0]?.id ?? "");
  const act = async (action: string, body?: object) => {
    await session.request(
      `${session.base}/items/${id}/${action}`,
      "POST",
      body,
    );
    await resource.reload();
  };
  return (
    <Page refresh={resource.reload}>
      {resource.error ? (
        <Loading error={resource.error} retry={resource.reload} />
      ) : !item ? (
        <Loading />
      ) : (
        <>
          {!["post", "notice"].includes(item.kind) && (
            <Photo uri={item.photo_url} height={250} />
          )}
          <Card>
            <Heading title={item.title} />
            <Button
              secondary
              title={item.saved ? "Remove from saved" : "Save item"}
              onPress={() => act("bookmark")}
            />
            {!["post", "notice"].includes(item.kind) && (
              <Text style={s.heading}>
                {money(item.price)}
                {item.listing_type === "rent" ? " / month" : ""}
              </Text>
            )}
            <Text style={s.muted}>
              {item.author} · {item.community}
            </Text>
            {item.unit && (
              <Text>
                {item.unit}
                {item.bedrooms ? ` · ${item.bedrooms} BHK` : ""}
              </Text>
            )}
            {item.available_on && (
              <Text>Available from {item.available_on.slice(0, 10)}</Text>
            )}
            <Text>{item.description}</Text>
            {item.author_id === session.snapshot.user?.sub && (
              <Button
                secondary
                title={
                  item.status === "published"
                    ? "Mark unavailable"
                    : "Publish listing"
                }
                onPress={() =>
                  act("status", {
                    status:
                      item.status === "published" ? "closed" : "published",
                  })
                }
              />
            )}
            {item.status === "published" &&
              (item.author_id !== session.snapshot.user?.sub ||
                ["post", "notice"].includes(item.kind)) && (
                <>
                  {item.kind === "service" && (
                    <>
                      <Select
                        label="Your home"
                        value={unit}
                        options={session.ownUnits.map((u) => ({
                          value: u.id,
                          label: u.label,
                        }))}
                        onChange={setUnit}
                      />
                      <DateField
                        label="Preferred date"
                        value={scheduled}
                        onChange={setScheduled}
                        maxDays={180}
                      />
                      <Text style={s.muted}>
                        Your society team confirms the date and final price. No
                        payment is collected here.
                      </Text>
                    </>
                  )}
                  <Field
                    label={
                      item.kind === "service"
                        ? "Service requirements"
                        : ["post", "notice"].includes(item.kind)
                          ? "Your comment"
                          : "Your enquiry"
                    }
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={1000}
                  />
                  <Button
                    title={
                      item.kind === "service"
                        ? "Request a service"
                        : ["post", "notice"].includes(item.kind)
                          ? "Add a comment"
                          : "Contact seller"
                    }
                    onPress={async () => {
                      if (item.kind === "service") {
                        if (!unit || !validDate(scheduled))
                          throw new Error(
                            "Select your home and enter a valid date.",
                          );
                        await act("requests", {
                          unit_id: unit,
                          scheduled_on: scheduled,
                          note: message.trim(),
                        });
                        showAlert(
                          "Request submitted",
                          "Your society team will confirm availability.",
                        );
                      } else {
                        if (message.trim().length < 2)
                          throw new Error("Please write a message.");
                        const comment = ["post", "notice"].includes(item.kind);
                        await act(comment ? "comments" : "inquiries", {
                          message: message.trim(),
                        });
                        if (!comment)
                          showAlert(
                            "Enquiry sent",
                            "View replies in Your activity.",
                          );
                      }
                      setMessage("");
                    }}
                  />
                </>
              )}
          </Card>
          {["post", "notice"].includes(item.kind) && (
            <>
              <Heading title="Conversation" />
              {item.comments?.map((c) => (
                <Card key={c.id}>
                  <Text style={s.title}>{c.author}</Text>
                  <Text>{c.body}</Text>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </Page>
  );
}
export function EditorScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Editor">) {
  const kind = route.params.kind;
  const session = useSession();
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState("0"),
    [category, setCategory] = useState(
      kind === "post" ? "Community" : "Furniture",
    ),
    [listingType, setListingType] = useState("rent"),
    [unit, setUnit] = useState(session.ownUnits[0]?.id ?? ""),
    [date, setDate] = useState(""),
    [bedrooms, setBedrooms] = useState("2"),
    [photo, setPhoto] = useState<PhotoAsset>(),
    [preview, setPreview] = useState(false);
  const save = async (draft: boolean) => {
    if (title.trim().length < 3 || description.trim().length < 3)
      throw new Error("Add a title and description of at least 3 characters.");
    const n = Number(price);
    if (!Number.isInteger(n) || n < 0 || n > 2000000000)
      throw new Error("Enter a valid whole-rupee price.");
    if (kind === "property" && (!unit || !validDate(date)))
      throw new Error("Select your property and a valid available date.");
    const photo_key = photo
      ? await session.upload(photo.uri, photo.mimeType)
      : undefined;
    await session.request(`${session.base}/items`, "POST", {
      kind,
      title: title.trim(),
      description: description.trim(),
      price: n,
      category:
        kind === "property"
          ? listingType === "rent"
            ? "Rent"
            : "Buy"
          : category,
      status: draft ? "draft" : "published",
      ...(photo_key ? { photo_key } : {}),
      ...(kind === "property"
        ? {
            unit_id: unit,
            listing_type: listingType,
            bedrooms: Number(bedrooms),
            available_on: date,
          }
        : {}),
    });
    showAlert(
      draft ? "Draft saved" : "Published",
      draft ? "Find it in My listings." : "Your post is published.",
    );
    navigation.goBack();
  };
  if (session.role !== "resident")
    return (
      <Page>
        <Empty title="Resident access required" />
      </Page>
    );
  return (
    <Page>
      <Heading
        title={
          kind === "property"
            ? "Post your property"
            : kind === "post"
              ? "New community post"
              : "New listing"
        }
        subtitle="A little detail helps your neighbours find what they need."
      />
      <Card>
        {kind === "property" && (
          <>
            <Text style={s.muted}>
              Only properties linked to your approved owner membership can be
              listed.
            </Text>
            <Select
              label="Property"
              value={unit}
              options={session.ownUnits.map((u) => ({
                value: u.id,
                label: u.label,
              }))}
              onChange={setUnit}
            />
            <Choice
              label="Listing type"
              value={listingType}
              options={[
                { value: "rent", label: "Rent out" },
                { value: "sell", label: "Sell" },
              ]}
              onChange={setListingType}
            />
            <DateField label="Available from" value={date} onChange={setDate} />
            <Choice
              label="Bedrooms"
              value={bedrooms}
              options={["1", "2", "3", "4", "5", "6"]}
              onChange={setBedrooms}
            />
          </>
        )}
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          maxLength={3000}
          multiline
        />
        {kind !== "post" && (
          <>
            <Field
              label="Price in rupees (0 for free)"
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
            />
            {kind === "listing" && (
              <Choice
                label="Category"
                value={category}
                options={categories}
                onChange={setCategory}
              />
            )}
            <Button
              secondary
              title={photo ? "Replace photo" : "Upload your photo"}
              onPress={async () => {
                const p = await pickPhoto();
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
          </>
        )}
        {preview && (
          <Card style={{ backgroundColor: colors.canvas }}>
            {photo && <Photo uri={photo.uri} />}
            <Text style={s.title}>{title}</Text>
            <Text>{description}</Text>
            {kind !== "post" && <Text>{money(Number(price))}</Text>}
          </Card>
        )}
        <Button
          secondary
          title={preview ? "Hide preview" : "Preview"}
          onPress={() => setPreview(!preview)}
        />
        <Row>
          <Button secondary title="Save draft" onPress={() => save(true)} />
          <Button title="Publish" onPress={() => save(false)} />
        </Row>
      </Card>
    </Page>
  );
}
export function ActivityScreen() {
  const session = useSession();
  const [tab, setTab] = useState("requests");
  const data = useResource(
    () =>
      session.request<Activity[]>(
        `${session.base}/${tab === "requests" ? "service-requests" : "inquiries"}`,
      ),
    [tab],
  );
  return (
    <Page refresh={data.reload}>
      <Heading
        title="Your activity"
        subtitle="Service requests, listing enquiries and replies."
      />
      <Choice
        value={tab}
        options={[
          { value: "requests", label: "Requests" },
          { value: "inquiries", label: "Enquiries" },
        ]}
        onChange={setTab}
      />
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <Loading error={data.error} retry={data.reload} />
      ) : data.data?.length ? (
        data.data.map((row) => (
          <ActivityCard
            key={row.id}
            row={row}
            requests={tab === "requests"}
            reload={data.reload}
          />
        ))
      ) : (
        <Empty message="Your service requests and conversations will appear here." />
      )}
    </Page>
  );
}
function ActivityCard({
  row,
  requests,
  reload,
}: {
  row: Activity;
  requests: boolean;
  reload: () => Promise<void>;
}) {
  const session = useSession();
  const [reply, setReply] = useState("");
  return (
    <Card>
      <Text style={s.title}>{row.title}</Text>
      {requests ? (
        <>
          <Text>
            {row.unit} · {row.scheduled_on?.slice(0, 10)}
          </Text>
          <Text>Status: {row.status}</Text>
          {["requested", "accepted"].includes(row.status ?? "") && (
            <Button
              secondary
              title="Cancel request"
              onPress={async () => {
                await session.request(
                  `${session.base}/service-requests/${row.id}/status`,
                  "POST",
                  { status: "cancelled" },
                );
                await reload();
              }}
            />
          )}
        </>
      ) : (
        <>
          <Text style={s.muted}>
            {row.sender} → {row.recipient}
          </Text>
          <Text>{row.message}</Text>
          {row.reply && <Text>Reply: {row.reply}</Text>}
          {row.recipient_id === session.snapshot.user?.sub && (
            <>
              <Field
                label="Reply to enquiry"
                value={reply}
                onChangeText={setReply}
                maxLength={1000}
              />
              <Button
                secondary
                title="Send reply"
                onPress={async () => {
                  if (reply.trim().length < 2)
                    throw new Error("Please write a reply.");
                  await session.request(
                    `${session.base}/inquiries/${row.id}/reply`,
                    "POST",
                    { message: reply.trim() },
                  );
                  setReply("");
                  await reload();
                }}
              />
            </>
          )}
        </>
      )}
    </Card>
  );
}
