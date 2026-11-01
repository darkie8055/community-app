import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Database } from "./database";
export const DEMO = {
  community: "937540ee-54e4-424f-85c6-a4db3d06a18a",
  unit: "4060fc1c-f148-4e50-8cde-1671ea052607",
  admin: "07f8e074-4aa1-44cc-ae58-a98cd36de908",
  resident: "af7c9031-9705-489c-a68b-ef1866851902",
  guard: "f448840e-be71-45ae-be19-3fc41a25b55d",
  pending: "a73ee8db-ad2c-4e11-97b1-02179ad74881",
};
export async function seed(db: Database) {
  const password = await hash(
    process.env.DEMO_ADMIN_PASSWORD || "Community@123",
    12,
  );
  await db.internal(async (sql) => {
    if (
      (await sql.query("SELECT id FROM users WHERE id=$1", [DEMO.admin])).rows
        .length
    )
      return;
    await sql.query("BEGIN");
    try {
      for (const [id, name, phone, email, platformAdmin] of [
        [
          DEMO.admin,
          "Priya Menon",
          "9876543200",
          "admin@mycommunity.local",
          true,
        ],
        [DEMO.resident, "Aarav Sharma", "9876543201", null, false],
        [DEMO.guard, "Rajesh Kumar", "9876543202", null, false],
        [DEMO.pending, "Neha Kapoor", "9876543203", null, false],
      ])
        await sql.query(
          "INSERT INTO users(id,name,phone,email,password_hash,is_platform_admin) VALUES($1,$2,$3,$4,$5,$6)",
          [
            id,
            name,
            phone,
            email,
            id === DEMO.admin ? password : null,
            platformAdmin,
          ],
        );
      await sql.query(
        "INSERT INTO communities(id,name,address,city) VALUES($1,$2,$3,$4)",
        [DEMO.community, "Palm Meadows", "Whitefield Main Road", "Bengaluru"],
      );
      const unitIds: string[] = [];
      for (const [blockName, floorNumbers] of [
        ["A", [11, 12]],
        ["B", [7, 8]],
        ["C", [3, 4]],
        ["D", [1, 2]],
      ] as const) {
        const block = randomUUID();
        await sql.query(
          "INSERT INTO blocks(id,community_id,name) VALUES($1,$2,$3)",
          [block, DEMO.community, blockName],
        );
        for (const number of floorNumbers) {
          const floor = randomUUID();
          await sql.query(
            "INSERT INTO floors(id,community_id,block_id,number) VALUES($1,$2,$3,$4)",
            [floor, DEMO.community, block, number],
          );
          for (let door = 1; door <= 5; door++) {
            const label = `${blockName}-${number}${String(door).padStart(2, "0")}`;
            const unit = label === "A-1204" ? DEMO.unit : randomUUID();
            unitIds.push(unit);
            await sql.query(
              "INSERT INTO units(id,community_id,floor_id,label) VALUES($1,$2,$3,$4)",
              [unit, DEMO.community, floor, label],
            );
          }
        }
      }
      for (const [user, unit, role, status] of [
        [DEMO.admin, null, "admin", "approved"],
        [DEMO.guard, null, "guard", "approved"],
        [DEMO.resident, DEMO.unit, "owner", "approved"],
        [DEMO.pending, unitIds[0], "tenant", "pending"],
      ]) {
        await sql.query(
          "INSERT INTO memberships(community_id,user_id,unit_id,role,status) VALUES($1,$2,$3,$4,$5)",
          [DEMO.community, user, unit, role, status],
        );
      }
      for (const [name, type, status, company, minutes] of [
        ["Rahul Kumar", "delivery", "pending", "Amazon", 2],
        ["Ananya Sharma", "guest", "inside", "", 32],
        ["Vikram Singh", "cab", "exited", "Uber", 75],
        ["Suresh Patel", "service", "exited", "Urban Company", 120],
      ] as const) {
        const visitor = randomUUID();
        await sql.query(
          "INSERT INTO visitors(id,community_id,name,phone) VALUES($1,$2,$3,$4)",
          [visitor, DEMO.community, name, "9876543210"],
        );
        const created = new Date(Date.now() - minutes * 60000);
        await sql.query(
          "INSERT INTO visitor_entries(community_id,visitor_id,unit_id,guard_id,created_by,type,status,company,idempotency_key,created_at,approved_at,entered_at,exited_at) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            DEMO.community,
            visitor,
            DEMO.unit,
            DEMO.guard,
            type,
            status,
            company,
            randomUUID(),
            created,
            status === "pending" ? null : new Date(+created + 10000),
            status === "pending" ? null : new Date(+created + 20000),
            status === "exited" ? new Date(+created + 600000) : null,
          ],
        );
      }
      await sql.query("COMMIT");
    } catch (error) {
      await sql.query("ROLLBACK");
      throw error;
    }
  });
  await db.internal(async (sql) => {
    if ((await sql.query("SELECT id FROM community_items LIMIT 1")).rows.length)
      return;
    await sql.query("BEGIN");
    try {
      const samples = [
        [
          "property",
          "A bright 3 BHK to call home",
          "Sunlit rooms, two balconies and a view of the gardens. Semi-furnished. Arrange a visit with the owner.",
          "Rent",
          42000,
          "house",
        ],
        [
          "property",
          "Garden-facing 2 BHK apartment",
          "A thoughtfully planned home with covered parking and access to the community gardens.",
          "Buy",
          9200000,
          "house",
        ],
        [
          "listing",
          "A comfortable accent chair",
          "Well cared for, one year old. Pick up within the society.",
          "Furniture",
          2500,
          "chair",
        ],
        [
          "listing",
          "Three-seater fabric sofa",
          "Moving homes. Clean fabric sofa with removable covers.",
          "Furniture",
          8500,
          "sofa",
        ],
        [
          "listing",
          "City bicycle, ready for a new ride",
          "Seven-speed bicycle, serviced recently. Helmet included.",
          "Vehicles",
          4500,
          "bicycle",
        ],
        [
          "listing",
          "Handmade wall decor",
          "A set of two hand-painted pieces made by a neighbour.",
          "Home Decor",
          750,
          "decor",
        ],
        [
          "listing",
          "Desk chair, free to a neighbour",
          "A functional office chair. Collect from Tower B this weekend.",
          "Free",
          0,
          "chair",
        ],
        [
          "service",
          "Home deep cleaning",
          "Kitchen, bathrooms and living spaces. Submit your preferred date; the management team will confirm availability.",
          "Cleaning",
          2499,
          "cleaning",
        ],
        [
          "service",
          "AC service and repair",
          "Inspection, filter cleaning and servicing. Any parts are quoted separately before work begins.",
          "Appliance Repair",
          599,
          "ac",
        ],
        [
          "service",
          "Packers and movers",
          "Plan your move with the society desk. Pricing starts at the displayed estimate; the final quote depends on your requirements.",
          "Moving",
          3500,
          "moving",
        ],
        [
          "service",
          "Fresh walls, fresh beginnings",
          "Book an inspection for home painting. The displayed amount is an inspection estimate.",
          "Painting",
          499,
          "painting",
        ],
        [
          "post",
          "Sunday morning, a little greener",
          "Join your neighbours for a garden clean-up this Sunday at 8 AM. Meet by the clubhouse. Everyone is welcome.",
          "Community",
          0,
          "community",
        ],
        [
          "post",
          "Anyone up for a weekend book swap?",
          "I have a few novels looking for their next reader. Leave a comment if you would like to join a book exchange in the clubhouse.",
          "Community",
          0,
          "community",
        ],
        [
          "notice",
          "Water tank cleaning · Sunday",
          "The water supply will be paused between 10 AM and 12 PM while the maintenance team cleans the overhead tank. Please plan accordingly.",
          "Maintenance",
          0,
          "community",
        ],
      ];
      for (const [kind, title, description, category, price, asset] of samples)
        await sql.query(
          `INSERT INTO community_items(community_id,author_id,kind,title,description,category,price,image_asset,unit_id,listing_type,bedrooms,available_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            DEMO.community,
            DEMO.admin,
            kind,
            title,
            description,
            category,
            price,
            asset,
            kind === "property" ? DEMO.unit : null,
            kind === "property"
              ? category === "Rent"
                ? "rent"
                : "sell"
              : null,
            kind === "property" ? (category === "Rent" ? 3 : 2) : null,
            kind === "property" ? new Date().toISOString().slice(0, 10) : null,
          ],
        );
      await sql.query("COMMIT");
    } catch (e) {
      await sql.query("ROLLBACK");
      throw e;
    }
  });
}
