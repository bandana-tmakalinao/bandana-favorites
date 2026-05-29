CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('cuisine', 'format', 'dessert', 'drink');--> statement-breakpoint
CREATE TYPE "public"."comparison_source" AS ENUM('duel', 'up', 'down');--> statement-breakpoint
CREATE TYPE "public"."contender_status" AS ENUM('provisional', 'active', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."place_status" AS ENUM('active', 'closed', 'duplicate');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text,
	"name" text NOT NULL,
	"email" text,
	"phone_e164_hash" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"trust_score" numeric(8, 4) DEFAULT '0.1' NOT NULL,
	"trust_tier" text DEFAULT 'new' NOT NULL,
	"rated_count" integer DEFAULT 0 NOT NULL,
	"is_curator" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_handle_unique" UNIQUE("handle"),
	CONSTRAINT "app_users_email_unique" UNIQUE("email"),
	CONSTRAINT "app_users_phone_e164_hash_unique" UNIQUE("phone_e164_hash")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" DEFAULT 'cuisine' NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subcategory_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"winner_id" uuid NOT NULL,
	"loser_id" uuid NOT NULL,
	"source" "comparison_source" DEFAULT 'duel' NOT NULL,
	"weight" numeric(8, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"subcategory_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"title" text NOT NULL,
	"dish_variant_id" uuid,
	"seed_rank" integer,
	"curator_notes" text,
	"theta" double precision DEFAULT 0 NOT NULL,
	"rd" double precision DEFAULT 350 NOT NULL,
	"weighted_votes" double precision DEFAULT 0 NOT NULL,
	"comparison_count" integer DEFAULT 0 NOT NULL,
	"distinct_opponents" integer DEFAULT 0 NOT NULL,
	"score" numeric(6, 2) DEFAULT '50' NOT NULL,
	"sort_key" double precision DEFAULT 0 NOT NULL,
	"status" "contender_status" DEFAULT 'provisional' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_place_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_place_id" text NOT NULL,
	"last_refreshed" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "photo_vouches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contender_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"content_hash" text,
	"exif_geo" "geography(Point,4326)",
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"vouch_count" integer DEFAULT 0 NOT NULL,
	"placeholder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_overture_enrich" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"overture_id" text,
	"taxonomy_primary" text,
	"taxonomy_hierarchy" text,
	"basic_category" text,
	"website" text,
	"socials" text,
	"brand" text,
	"confidence" numeric(4, 3)
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'dohmh' NOT NULL,
	"camis" text,
	"name" text NOT NULL,
	"address" text,
	"neighborhood" text,
	"borough" text,
	"zip" text,
	"dohmh_cuisine" text,
	"geo" "geography(Point,4326)" NOT NULL,
	"region_id" uuid,
	"status" "place_status" DEFAULT 'active' NOT NULL,
	"merged_into" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_camis_unique" UNIQUE("camis")
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshots" (
	"region_id" uuid NOT NULL,
	"subcategory_id" uuid NOT NULL,
	"contender_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"score" numeric(6, 2) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'city' NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"boundary" "geography(MultiPolygon,4326)",
	"is_live" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"blurb" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"merged_into" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subcategories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subcategory_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subcategory_id" uuid NOT NULL,
	"term" text NOT NULL,
	CONSTRAINT "subcategory_synonyms_term_unique" UNIQUE("term")
);
--> statement-breakpoint
CREATE TABLE "trust_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"weight" numeric(8, 4) NOT NULL,
	"ref_table" text,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contender_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" smallint NOT NULL,
	"weight" numeric(8, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_winner_id_contenders_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."contenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_loser_id_contenders_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."contenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenders" ADD CONSTRAINT "contenders_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenders" ADD CONSTRAINT "contenders_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenders" ADD CONSTRAINT "contenders_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenders" ADD CONSTRAINT "contenders_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_place_refs" ADD CONSTRAINT "external_place_refs_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_vouches" ADD CONSTRAINT "photo_vouches_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_vouches" ADD CONSTRAINT "photo_vouches_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_contender_id_contenders_id_fk" FOREIGN KEY ("contender_id") REFERENCES "public"."contenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploader_id_app_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_overture_enrich" ADD CONSTRAINT "place_overture_enrich_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategory_synonyms" ADD CONSTRAINT "subcategory_synonyms_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_contender_id_contenders_id_fk" FOREIGN KEY ("contender_id") REFERENCES "public"."contenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_comparison_sub" ON "comparisons" USING btree ("subcategory_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contender_place_sub" ON "contenders" USING btree ("place_id","subcategory_id");--> statement-breakpoint
CREATE INDEX "idx_contender_ranklist" ON "contenders" USING btree ("region_id","subcategory_id","sort_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_external_ref" ON "external_place_refs" USING btree ("source","source_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vouch_photo_user" ON "photo_vouches" USING btree ("photo_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_photo_contender" ON "photos" USING btree ("contender_id","status");--> statement-breakpoint
CREATE INDEX "idx_place_region" ON "places" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "idx_snapshot_list" ON "ranking_snapshots" USING btree ("region_id","subcategory_id","rank");--> statement-breakpoint
CREATE INDEX "idx_subcat_category" ON "subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_trust_event_user" ON "trust_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vote_user_contender" ON "votes" USING btree ("contender_id","user_id");