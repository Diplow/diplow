-- The Hexframe Organization (HEX-139), the same in every environment: its id, fixed, and its star,
-- the Root of its System, by a fixed id too, titled "Hexframe", which Mapping mounts Help and the
-- tutorial under (`hexframeStar`, domains/mapping/entities/system.ts). No member, no admin, no Grant:
-- its first admin is made by hand, and Help and the tutorial are read by Everyone for being shipped.
INSERT INTO "organization" ("id") VALUES ('98c9e80b-a66d-4ad1-84ff-9ed917ef86eb') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "tile" ("id", "owner_id", "parent_id", "direction", "title", "preview", "body")
VALUES ('1444d914-02ce-4951-84f5-5f344fd76718', '98c9e80b-a66d-4ad1-84ff-9ed917ef86eb', NULL, NULL, 'Hexframe', '', '')
ON CONFLICT DO NOTHING;
